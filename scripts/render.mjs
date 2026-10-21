#!/usr/bin/env node
// heptareel · render.mjs — storyboard stills, contact sheets, determinism checks and the final MP4
// for one-file seek(t) canvas compositions. Run without arguments for usage.

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const USAGE = `heptareel render tool

  node render.mjs doctor [--fix]             check (and install) ffmpeg, Playwright, a browser
  node render.mjs check  comp.html [--palette #hex,#hex,...]
                                             contract, determinism, safe zones, palette, audio
  node render.mjs stills comp.html --at 0.6,2.4,4.8,7.5 [--out dir]
  node render.mjs sheet  comp.html [--out file.png] [--at t,t,...] [--cols n]
  node render.mjs audio  comp.html [--out file.m4a|.wav]       (+ waveform graph with beat lines)
  node render.mjs video  comp.html [--out file.mp4] [--from s] [--to s]
                                   [--workers n] [--crf 16] [--preset medium] [--no-audio] [--no-sheet]
  any command: --gpu   GPU canvas raster: faster, but pixels can differ between pages and runs

Outputs default to the composition's folder: storyboard/, contact-sheet.png, renders/.
Contract: window.COMP {width,height,fps,duration,beats:[{t,label}],palette?}, window.seek(t) paints
canvas#stage, optional window.ready (Promise) and window.renderAudio() (-> AudioBuffer).`;

const CACHE = path.join(os.homedir(), '.cache', 'heptareel');
const SAFE = { top: 250, bottom: 400 }; // Reels UI bands: no text in the top 250px / bottom 400px
// LRA is set wide on purpose: loudnorm only applies a clean linear gain when the measured loudness
// range is under this target, and a short reel that goes from quiet foley into a full groove measures high.
const LOUD = { I: -14, TP: -1, LRA: 30 };
const MIN_TEXT_PX = 60;

const say = {
  ok: (s) => console.log(`✓ ${s}`),
  warn: (s) => console.log(`! ${s}`),
  info: (s) => console.log(`· ${s}`),
  bad: (s) => console.log(`✗ ${s}`),
};

// ── arguments ────────────────────────────────────────────────────────────────
const [cmd, ...rest] = process.argv.slice(2);
const opt = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (!a.startsWith('--')) { args.push(a); continue; }
  const eq = a.indexOf('=');
  if (eq > 0) opt[a.slice(2, eq)] = a.slice(eq + 1);
  else if (rest[i + 1] !== undefined && !rest[i + 1].startsWith('--')) opt[a.slice(2)] = rest[++i];
  else opt[a.slice(2)] = true;
}

const rel = (p) => path.relative(process.cwd(), p) || '.';
const sha = (buf) => createHash('sha1').update(buf).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const int = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && v !== true && v !== undefined ? Math.min(hi, Math.max(lo, n)) : dflt;
};

function run(bin, argv) {
  const r = spawnSync(bin, argv, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.error) throw new Error(`${bin}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${bin} failed: ${(r.stderr || '').trim().split('\n').slice(-6).join('\n')}`);
  return r;
}

function compPath() {
  if (!args[0]) throw new Error(`missing composition file\n\n${USAGE}`);
  const abs = path.resolve(args[0]);
  if (!fs.existsSync(abs)) throw new Error(`no such file: ${args[0]}`);
  return abs;
}

function parseTimes(s) {
  if (!s || s === true) return null;
  const ts = String(s).split(',').map((x) => parseFloat(x)).filter(Number.isFinite);
  return ts.length ? ts : null;
}

// ── Playwright + browser ─────────────────────────────────────────────────────
let pwFrom = '';
let pwDir = '';
let browserFrom = '';

async function loadPlaywright() {
  const pick = (m) => (m && m.chromium ? m : m && m.default && m.default.chromium ? m.default : null);
  for (const name of ['playwright', 'playwright-core']) {
    try {
      const pw = pick(await import(name));
      if (pw) { pwFrom = `${name} next to the script`; return pw; }
    } catch { /* try the next location */ }
  }
  const roots = [['project', process.cwd()], ['heptareel cache', CACHE]];
  const g = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' });
  if (g.status === 0 && g.stdout.trim()) roots.push(['global npm', path.dirname(g.stdout.trim())]);
  for (const [where, root] of roots) {
    for (const name of ['playwright', 'playwright-core']) {
      try {
        const main = createRequire(path.join(root, 'noop.js')).resolve(name);
        const pw = pick(await import(pathToFileURL(main).href));
        if (pw) { pwFrom = `${name} from ${where}`; pwDir = path.dirname(main); return pw; }
      } catch { /* not installed here */ }
    }
  }
  return null;
}

// Canvas raster runs on the CPU unless --gpu: Chrome moves 2D canvases between GPU and CPU raster
// (startup timing, readback heuristics), and the two paths draw gradients, text, blur and clips a few
// levels apart. Then frames depend on seek order and parallel workers disagree. CPU raster is identical
// everywhere and costs little, except for per-frame blur filters (bake those as sprites).
async function launch(pw) {
  const flags = ['--force-color-profile=srgb', '--disable-lcd-text', '--hide-scrollbars', '--mute-audio'];
  if (!opt.gpu) flags.push('--disable-accelerated-2d-canvas');
  const errors = [];
  for (const [label, extra] of [['Playwright Chromium', {}], ['Google Chrome', { channel: 'chrome' }], ['Microsoft Edge', { channel: 'msedge' }]]) {
    try {
      const browser = await pw.chromium.launch({ headless: true, args: flags, ...extra });
      browserFrom = `${label} ${browser.version()}`;
      return browser;
    } catch (e) {
      errors.push(`${label}: ${String(e.message).split('\n')[0]}`);
    }
  }
  throw new Error(`no browser could be launched\n  ${errors.join('\n  ')}\n  fix: node render.mjs doctor --fix`);
}

// Runs in the page before any composition script. Marks render mode; in probe mode it also counts
// clock/random/timer use inside seek() and records text drawn on the stage canvas: strings with
// 2+ letters/digits, plus single letters at 40px+ (slammed-in letters). Small single glyphs such as
// ASCII-art cells are ignored.
function initScript({ probe }) {
  window.__HEPTAREEL_RENDER__ = true;
  if (!probe) return;
  const P = (window.__hrProbe = { inSeek: false, stage: null, counts: { random: 0, clock: 0, timers: 0 }, texts: [] });
  const wrap = (obj, key, bucket) => {
    const orig = obj[key];
    if (typeof orig !== 'function') return;
    obj[key] = function (...a) { if (P.inSeek) P.counts[bucket]++; return orig.apply(this, a); };
  };
  wrap(Math, 'random', 'random');
  wrap(Date, 'now', 'clock');
  wrap(performance, 'now', 'clock');
  wrap(window, 'setTimeout', 'timers');
  wrap(window, 'setInterval', 'timers');
  wrap(window, 'requestAnimationFrame', 'timers');
  const C2D = CanvasRenderingContext2D.prototype;
  for (const key of ['fillText', 'strokeText']) {
    const orig = C2D[key];
    C2D[key] = function (text, x, y, ...more) {
      const s = String(text);
      if (P.inSeek && this.canvas === P.stage && this.globalAlpha > 0.05) {
        const alnum = (s.match(/[\p{L}\p{N}]/gu) || []).length;
        const T = this.getTransform();
        const size = parseFloat((/(\d+(?:\.\d+)?)px/.exec(this.font) || [])[1] || '0') * Math.hypot(T.c, T.d);
        if (alnum >= 2 || (alnum === 1 && size >= 40)) {
          const m = this.measureText(s);
          const l = x - m.actualBoundingBoxLeft, r = x + m.actualBoundingBoxRight;
          const t = y - m.actualBoundingBoxAscent, b = y + m.actualBoundingBoxDescent;
          const ys = [[l, t], [r, t], [l, b], [r, b]].map(([px, py]) => T.b * px + T.d * py + T.f);
          P.texts.push({ text: s.trim().slice(0, 40), top: Math.min(...ys), bottom: Math.max(...ys), size });
        }
      }
      return orig.call(this, text, x, y, ...more);
    };
  }
}

async function openPage(browser, file, probe) {
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await context.addInitScript(initScript, { probe });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.COMP && typeof window.seek === 'function', null, { timeout: 15000 });
  } catch {
    throw new Error(`window.COMP and window.seek(t) not found${errors[0] ? ` — page error: ${errors[0]}` : ''}`);
  }
  await page.evaluate(async () => { if (window.ready) await window.ready; await document.fonts.ready; });
  const meta = await page.evaluate(() => {
    const c = window.COMP;
    const stage = document.querySelector('canvas#stage') || document.querySelector('canvas');
    window.__hr = { stage, async frame(t) { await window.seek(t); return stage.toDataURL('image/png'); } };
    return {
      width: c.width, height: c.height, fps: c.fps, duration: c.duration,
      beats: (Array.isArray(c.beats) ? c.beats : []).map((b) => ({ t: Number(b.t), label: String(b.label ?? '') })),
      palette: Array.isArray(c.palette) ? c.palette.map(String) : null,
      canvas: stage ? [stage.width, stage.height] : null,
      audio: typeof window.renderAudio === 'function',
    };
  });
  if (!meta.canvas) throw new Error('no <canvas> in the page (expected canvas#stage)');
  for (const k of ['width', 'height', 'fps', 'duration']) {
    if (!(meta[k] > 0)) throw new Error(`COMP.${k} must be a positive number (got ${meta[k]})`);
  }
  return { context, page, meta, errors };
}

async function session(file, { probe = false } = {}) {
  const pw = await loadPlaywright();
  if (!pw) throw new Error('Playwright not found — run: node render.mjs doctor --fix');
  const browser = await launch(pw);
  const pages = [];
  // each page gets its own context, hence its own renderer process: workers really run in parallel
  const add = async () => {
    try {
      pages.push(await openPage(browser, file, probe));
    } catch (e) {
      await browser.close();
      throw e;
    }
  };
  await add();
  return { pages, meta: pages[0].meta, add, close: () => browser.close() };
}

async function grab(page, t) {
  const url = await page.evaluate((tt) => window.__hr.frame(tt), t);
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

const frameTime = (meta, t) => Math.min(Math.max(0, Math.round(t * meta.fps)), Math.round(meta.duration * meta.fps) - 1) / meta.fps;

// A custom time only borrows a beat's label when it is that beat's frame; otherwise the time stands alone.
function labelAt(meta, t) {
  const hit = meta.beats.find((b) => Math.abs(frameTime(meta, b.t) - t) < 0.5 / meta.fps);
  return hit ? hit.label : '';
}

function spread(meta, n) {
  const beats = [...meta.beats].sort((x, y) => x.t - y.t);
  if (beats.length >= n) return Array.from({ length: n }, (_, i) => beats[Math.round((i * (beats.length - 1)) / (n - 1))].t);
  return Array.from({ length: n }, (_, i) => ((i + 0.5) * meta.duration) / n);
}

const autoCols = (n) => (n <= 4 ? n : n <= 8 ? 4 : n <= 15 ? 5 : 6);

// Contact sheet drawn inside the page: one cell per time, label underneath, red safe-zone lines.
async function contactSheet(page, times, labels, { cols, cellW = 270, guides = true }) {
  const b64 = await page.evaluate(async ({ times, labels, cols, cellW, guides, safe }) => {
    const s = window.__hr.stage;
    const cw = cellW, ch = Math.round((cellW * s.height) / s.width), pad = 14, lab = 30;
    const rows = Math.ceil(times.length / cols);
    const c = document.createElement('canvas');
    c.width = pad + cols * (cw + pad);
    c.height = pad + rows * (ch + lab + pad);
    const g = c.getContext('2d');
    g.fillStyle = '#141416';
    g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < times.length; i++) {
      const x = pad + (i % cols) * (cw + pad), y = pad + Math.floor(i / cols) * (ch + lab + pad);
      await window.seek(times[i]);
      g.drawImage(s, x, y, cw, ch);
      if (guides) { // red/white dashes stay visible on any background
        g.lineWidth = 1;
        g.setLineDash([5, 5]);
        g.beginPath();
        for (const yy of [safe.top, s.height - safe.bottom]) {
          const ly = Math.round(y + (ch * yy) / s.height) + 0.5;
          g.moveTo(x, ly);
          g.lineTo(x + cw, ly);
        }
        g.strokeStyle = 'rgba(255,40,40,0.95)';
        g.lineDashOffset = 0;
        g.stroke();
        g.strokeStyle = 'rgba(255,255,255,0.95)';
        g.lineDashOffset = 5;
        g.stroke();
        g.setLineDash([]);
      }
      g.textBaseline = 'top';
      g.fillStyle = '#ececec';
      g.font = '600 15px Menlo, Consolas, monospace';
      g.fillText(`${times[i].toFixed(2)}s`, x, y + ch + 8);
      const label = String(labels[i] || '');
      const room = Math.floor((cw - 64) / 8.6);
      g.fillStyle = '#9b9ba3';
      g.font = '14px Menlo, Consolas, monospace';
      g.fillText(label.length > room ? `${label.slice(0, room - 1)}…` : label, x + 62, y + ch + 9);
    }
    const url = c.toDataURL('image/png');
    return url.slice(url.indexOf(',') + 1);
  }, { times, labels, cols, cellW, guides, safe: SAFE });
  return Buffer.from(b64, 'base64');
}

// Render window.renderAudio() to a 32-bit float WAV (keeps headroom for the loudness pass).
async function writeWav(page, out) {
  const b64 = await page.evaluate(async () => {
    const buf = window.__hrAudio || (window.__hrAudio = await window.renderAudio());
    const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
    const data = new Float32Array(n * ch);
    const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
    for (let i = 0, k = 0; i < n; i++) for (let c = 0; c < ch; c++) data[k++] = chans[c][i];
    const h = new DataView(new ArrayBuffer(44));
    const tag = (o, s) => { for (let i = 0; i < 4; i++) h.setUint8(o + i, s.charCodeAt(i)); };
    tag(0, 'RIFF'); h.setUint32(4, 36 + data.byteLength, true); tag(8, 'WAVE');
    tag(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 3, true); h.setUint16(22, ch, true);
    h.setUint32(24, sr, true); h.setUint32(28, sr * ch * 4, true); h.setUint16(32, ch * 4, true); h.setUint16(34, 32, true);
    tag(36, 'data'); h.setUint32(40, data.byteLength, true);
    const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(new Blob([h.buffer, data.buffer])); });
    return url.slice(url.indexOf(',') + 1);
  });
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
}

// The agent can't listen, so it looks: waveform (grey = peak, white = RMS) on a 0.5 s grid with a
// dashed red line per COMP.beats entry. Hits that belong to a beat should start on its line.
async function audioGraph(page, meta, out, { from = 0, to = null } = {}) {
  const b64 = await page.evaluate(async ({ beats, from, to }) => {
    const buf = window.__hrAudio || (window.__hrAudio = await window.renderAudio());
    const sr = buf.sampleRate, t0 = from, t1 = to ?? buf.duration;
    const W = 1600, H = 360, top = 44, bottom = 28, amp = (H - top - bottom) / 2, mid = top + amp;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#141416';
    g.fillRect(0, 0, W, H);
    const chans = Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i));
    const a0 = Math.floor(t0 * sr), a1 = Math.min(buf.length, Math.floor(t1 * sr));
    let peak = 1e-9;
    for (const d of chans) for (let i = a0; i < a1; i++) peak = Math.max(peak, Math.abs(d[i]));
    const x = (t) => ((t - t0) / (t1 - t0)) * W;
    g.strokeStyle = '#2a2a30'; g.fillStyle = '#6b6b75'; g.font = '12px Menlo, monospace'; g.lineWidth = 1;
    for (let s = Math.ceil(t0 * 2) / 2; s <= t1 + 1e-9; s += 0.5) {
      const xx = Math.round(x(s)) + 0.5;
      g.beginPath(); g.moveTo(xx, top - 6); g.lineTo(xx, H - bottom); g.stroke();
      g.fillText(`${s.toFixed(1)}s`, xx + 3, H - 9);
    }
    const per = (a1 - a0) / W;
    for (let px = 0; px < W; px++) {
      let pk = 0, ss = 0, n = 0;
      for (const d of chans) {
        for (let i = Math.floor(a0 + px * per); i < Math.floor(a0 + (px + 1) * per); i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; ss += v * v; n++; }
      }
      const rms = Math.sqrt(ss / Math.max(1, n));
      g.fillStyle = '#585862'; g.fillRect(px, mid - (pk / peak) * amp, 1, (2 * pk * amp) / peak);
      g.fillStyle = '#e8e8e8'; g.fillRect(px, mid - (rms / peak) * amp, 1, (2 * rms * amp) / peak);
    }
    g.setLineDash([4, 3]); g.strokeStyle = 'rgba(255,70,70,0.95)'; g.fillStyle = '#ff7070'; g.font = '13px Menlo, monospace';
    beats.filter((b) => b.t >= t0 && b.t <= t1).forEach((b, i) => {
      const xx = Math.round(x(b.t)) + 0.5;
      g.beginPath(); g.moveTo(xx, top - 8); g.lineTo(xx, H - bottom); g.stroke();
      g.fillText(b.label.slice(0, 20), xx + 3, 15 + (i % 2) * 16);
    });
    const url = c.toDataURL('image/png');
    return url.slice(url.indexOf(',') + 1);
  }, { beats: meta.beats, from, to });
  fs.writeFileSync(out, Buffer.from(b64, 'base64'));
}

// Renders the soundtrack twice and compares. Chrome's ConvolverNode wobbles by ~1e-7 between runs
// (inaudible), so "deterministic" means the runs differ by less than 1e-4 (-80 dB); unseeded noise
// differs by roughly the size of the signal.
async function audioCheck(page) {
  return page.evaluate(async () => {
    const a = await window.renderAudio();
    const b = await window.renderAudio();
    let peak = 0, diff = 0;
    for (let c = 0; c < a.numberOfChannels; c++) {
      const x = a.getChannelData(c);
      const y = c < b.numberOfChannels ? b.getChannelData(c) : new Float32Array(x.length);
      for (let i = 0; i < x.length; i++) {
        const v = Math.abs(x[i]);
        if (v > peak) peak = v;
        const d = Math.abs(x[i] - (y[i] || 0));
        if (d > diff) diff = d;
      }
    }
    if (a.length !== b.length) diff = Infinity;
    return { duration: a.duration, rate: a.sampleRate, channels: a.numberOfChannels, peak, diff };
  });
}

// EBU R128 normalisation to -14 LUFS with true peak under -1 dBTP. loudnorm only applies a clean
// linear gain when the peaks leave room for it; a punchy synth mix usually doesn't, so such mixes are
// brick-wall limited first. AAC then adds its own overshoot (band-limiting rings on hard edges such as
// square waves and bitcrush), so the true peak is measured again after encoding and fixed if needed.
function normalize(inWav, out, { from = 0, dur = null } = {}) {
  const tp = LOUD.TP - 0.5;
  const base = `loudnorm=I=${LOUD.I}:TP=${tp}:LRA=${LOUD.LRA}`;
  const wavOut = /\.wav$/i.test(out);
  const trim = [...(from > 0 ? ['-ss', from.toFixed(4)] : []), ...(dur ? ['-t', dur.toFixed(4)] : [])];
  const measure = (file) => {
    const p = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `${base}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' });
    const blocks = (p.stderr || '').match(/\{[^{}]*"input_i"[^{}]*\}/g);
    if (!blocks) throw new Error(`loudness analysis failed: ${(p.stderr || '').trim().slice(-300)}`);
    return JSON.parse(blocks[blocks.length - 1]);
  };
  const encode = (src, extra = []) => run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, ...extra, ...trim,
    '-ar', '48000', ...(wavOut ? ['-c:a', 'pcm_s24le'] : ['-c:a', 'aac', '-b:a', '192k']), out]);
  let src = inWav;
  let m = measure(src);
  const measured = +m.input_i;
  if (!Number.isFinite(measured) || measured < -70) {
    encode(inWav);
    return 'soundtrack is silent, not normalized';
  }
  let limited = '';
  const gain = LOUD.I - measured;
  if (+m.input_tp + gain > tp) {
    // Limit at 4x oversampling so inter-sample peaks are caught too, and nudge the pre-gain until the
    // limited mix already sits at the target: the loudness pass then only trims, which stays linear.
    src = inWav.replace(/\.wav$/i, '') + '-limited.wav';
    const ceiling = (10 ** ((tp - 1) / 20)).toFixed(4);
    const help = spawnSync('ffmpeg', ['-hide_banner', '-h', 'filter=alimiter'], { encoding: 'utf8' }).stdout || '';
    const latency = /\blatency\b/.test(help) ? ':latency=true' : ''; // undo the 5 ms lookahead delay
    let pre = gain + 0.5;
    for (let i = 0; i < 3; i++) {
      run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', inWav, '-af',
        `volume=${pre.toFixed(2)}dB,aresample=192000,alimiter=limit=${ceiling}:attack=5:release=60:level=false${latency},aresample=48000`,
        '-c:a', 'pcm_f32le', src]);
      m = measure(src);
      const miss = LOUD.I - +m.input_i;
      if (Math.abs(miss) <= 0.3) break;
      pre += miss;
    }
    limited = 'peak-limited, then ';
  }
  const norm = inWav.replace(/\.wav$/i, '') + '-norm.wav';
  const af = `${base}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`;
  const p2 = run('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', src, '-af', af, '-ar', '48000', '-c:a', 'pcm_f32le', norm]);
  const b2 = (p2.stderr || '').match(/\{[^{}]*"normalization_type"[^{}]*\}/g);
  const note = `${limited}${b2 ? JSON.parse(b2[b2.length - 1]).normalization_type : 'unknown'} normalization from ${measured.toFixed(1)} LUFS`;
  let headroom = 0;
  for (let i = 0; i < 4; i++) {
    encode(norm, headroom ? ['-af', `volume=${headroom.toFixed(2)}dB`] : []);
    const L = loudness(out);
    if (!(L.TP > LOUD.TP)) break;
    headroom -= L.TP - LOUD.TP + 0.3;
  }
  return headroom ? `${note}, ${(-headroom).toFixed(1)} dB pulled back after encoding to keep the true peak under ${LOUD.TP} dBTP` : note;
}

function loudness(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr || '';
  const sum = s.slice(s.lastIndexOf('Summary:'));
  const num = (re) => { const m = re.exec(sum); return m ? parseFloat(m[1]) : NaN; };
  return { I: num(/I:\s+(-?[\d.]+)\s+LUFS/), TP: num(/Peak:\s+(-?[\d.]+)\s+dBFS/) };
}

const fmtLoud = (L) => `${L.I.toFixed(1)} LUFS integrated, true peak ${L.TP.toFixed(1)} dBTP`;
const loudOk = (L) => Math.abs(L.I - LOUD.I) <= 1 && L.TP <= LOUD.TP + 0.05;

// Render frames with N pages in parallel; sink() receives PNG buffers strictly in frame order.
async function renderFrames(pages, frames, fps, sink, progress) {
  let next = 0, written = 0, failed = null, chain = Promise.resolve();
  const ready = new Map();
  const drain = async () => {
    while (ready.has(written)) {
      const buf = ready.get(written);
      ready.delete(written);
      await sink(buf);
      written++;
      progress(written);
    }
  };
  const worker = async (page) => {
    while (!failed) {
      const i = next++;
      if (i >= frames.length) return;
      while (i - written > 24 && !failed) await sleep(3); // bound memory
      if (failed) return;
      ready.set(i, await grab(page, frames[i] / fps));
      chain = chain.then(drain).catch((e) => { failed = failed || e; });
    }
  };
  await Promise.all(pages.map((p) => worker(p).catch((e) => { failed = failed || e; })));
  await chain;
  if (failed) throw failed;
}

// ── commands ─────────────────────────────────────────────────────────────────
async function doctor() {
  const fix = Boolean(opt.fix);
  let problems = 0;
  const P = (m) => { problems++; say.bad(m); };
  const ffHint = process.platform === 'darwin' ? 'brew install ffmpeg'
    : process.platform === 'win32' ? 'winget install Gyan.FFmpeg' : 'sudo apt-get install -y ffmpeg';

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 18) say.ok(`node ${process.versions.node}`);
  else P(`node ${process.versions.node} — need 18 or newer`);

  const ffOk = () => ['ffmpeg', 'ffprobe'].every((b) => spawnSync(b, ['-version'], { stdio: 'ignore' }).status === 0);
  if (!ffOk() && fix) {
    if (process.platform === 'darwin' && spawnSync('brew', ['--version'], { stdio: 'ignore' }).status === 0) {
      say.info('installing ffmpeg with Homebrew …');
      spawnSync('brew', ['install', 'ffmpeg'], { stdio: 'inherit' });
    } else say.info(`install ffmpeg yourself: ${ffHint}`);
  }
  if (!ffOk()) P(`ffmpeg/ffprobe not found — ${ffHint}`);
  else {
    const enc = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' }).stdout || '';
    const fil = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout || '';
    const missing = [['libx264', enc], ['aac', enc], ['loudnorm', fil], ['ebur128', fil]]
      .filter(([k, s]) => !new RegExp(`\\s${k}\\s`).test(s)).map(([k]) => k);
    if (missing.length) P(`ffmpeg lacks ${missing.join(', ')} — install a full build (${ffHint})`);
    else say.ok((spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).stdout || 'ffmpeg').split('\n')[0]);
  }

  let pw = await loadPlaywright();
  if (!pw && fix) {
    say.info(`installing playwright into ${CACHE} …`);
    fs.mkdirSync(CACHE, { recursive: true });
    const r = spawnSync('npm', ['install', '--prefix', CACHE, '--no-audit', '--no-fund', '--loglevel=error', 'playwright'], { stdio: 'inherit' });
    if (r.status === 0) pw = await loadPlaywright();
  }
  if (!pw) P(`Playwright not found — rerun with --fix (installs it into ${CACHE})`);
  else {
    say.ok(`playwright (${pwFrom})`);
    let browser = null, launchError = null;
    try { browser = await launch(pw); } catch (e) { launchError = e; }
    if (!browser && fix) {
      say.info('installing Playwright Chromium …');
      if (pwDir) spawnSync(process.execPath, [path.join(pwDir, 'cli.js'), 'install', 'chromium'], { stdio: 'inherit' });
      else spawnSync('npx', ['-y', 'playwright', 'install', 'chromium'], { stdio: 'inherit' });
      try { browser = await launch(pw); } catch (e) { launchError = e; }
    }
    if (browser) { say.ok(`browser: ${browserFrom}`); await browser.close(); }
    else P(String(launchError.message).split('\n').slice(0, 4).join('\n  '));
  }
  console.log(problems ? `✗ ${problems} problem(s)${fix ? '' : ' — rerun with --fix to install what is missing'}` : '✓ ready to render');
  process.exitCode = problems ? 1 : 0;
}

async function check() {
  const file = compPath();
  const s = await session(file, { probe: true });
  let bad = 0, warns = 0;
  const B = (m) => { bad++; say.bad(m); };
  const Wn = (m) => { warns++; say.warn(m); };
  try {
    const { page, meta, errors } = s.pages[0];
    const [cw, chh] = meta.canvas;
    if (cw !== meta.width || chh !== meta.height) B(`canvas is ${cw}x${chh} but COMP says ${meta.width}x${meta.height}`);
    if (meta.width !== 1080 || meta.height !== 1920) Wn(`COMP is ${meta.width}x${meta.height}; the base block wants 1080x1920`);
    if (meta.fps !== 30) Wn(`fps is ${meta.fps}; the base block wants 30`);
    if (meta.duration >= 10) Wn(`duration is ${meta.duration}s; keep it under 10 s`);
    const strayBeats = meta.beats.filter((b) => !(b.t >= 0 && b.t < meta.duration));
    if (strayBeats.length) B(`COMP.beats outside [0, duration): ${strayBeats.map((b) => b.t).join(', ')}`);
    if (meta.beats.length < 3) Wn(`COMP.beats has ${meta.beats.length} entries; add one per beat-map row (the contact sheet renders them)`);
    if (!bad) say.ok(`contract: ${meta.width}x${meta.height} @${meta.fps}fps, ${meta.duration}s, ${meta.beats.length} beats`);

    // Determinism: render sample frames ascending, then again descending with a decoy seek before
    // each one. A pure seek(t) produces identical pixels; anything stateful shows up as a diff.
    await page.evaluate(() => {
      const P = window.__hrProbe;
      P.stage = window.__hr.stage;
      const orig = window.seek;
      window.seek = function (t) {
        P.inSeek = true;
        let r;
        try { r = orig.call(this, t); } catch (e) { P.inSeek = false; throw e; }
        if (r && typeof r.then === 'function') return r.finally(() => { P.inSeek = false; });
        P.inSeek = false;
        return r;
      };
    });
    const times = [...new Set([0, ...meta.beats.map((b) => b.t), ...Array.from({ length: 10 }, (_, i) => ((i + 0.5) * meta.duration) / 10), meta.duration]
      .map((t) => frameTime(meta, t)))].sort((x, y) => x - y);
    const first = new Map();
    let ms = 0;
    for (const t of times) {
      const t0 = performance.now();
      first.set(t, sha(await grab(page, t)));
      ms += performance.now() - t0;
    }
    const changed = [];
    const back = [...times].reverse();
    for (let i = 0; i < back.length; i++) {
      await grab(page, times[(i * 5 + 3) % times.length]);
      if (sha(await grab(page, back[i])) !== first.get(back[i])) changed.push(back[i]);
    }
    if (changed.length) {
      B(`seek(t) is not pure: ${changed.length}/${times.length} frames change with seek order (t = ${changed.sort((x, y) => x - y).map((t) => t.toFixed(2)).join(', ')}). `
        + 'Usual causes: Math.random/Date.now in seek, state carried between calls (x += v, particles, trails), '
        + 'canvas state not reset, assets still loading. Bake stateful systems at load (references/engine.md).');
    } else say.ok(`deterministic: ${times.length} frames identical in two seek orders`);

    const probe = await page.evaluate(() => ({ counts: window.__hrProbe.counts, texts: window.__hrProbe.texts }));
    if (probe.counts.random) B(`Math.random() called ${probe.counts.random}x inside seek(); use rand(...keys) (counter-based)`);
    if (probe.counts.clock) B(`Date.now()/performance.now() called ${probe.counts.clock}x inside seek(); derive everything from t`);
    if (probe.counts.timers) Wn(`timers/requestAnimationFrame scheduled ${probe.counts.timers}x inside seek(); they never run in render order`);

    const byText = new Map();
    for (const r of probe.texts) {
      const e = byText.get(r.text);
      if (!e) byText.set(r.text, { ...r });
      else { e.top = Math.min(e.top, r.top); e.bottom = Math.max(e.bottom, r.bottom); e.size = Math.min(e.size, r.size); }
    }
    // typed-on text shows up as growing prefixes ("MADE W", "MADE WITH", ...): fold them into the full string
    for (const [k, e] of [...byText]) {
      const full = [...byText.values()].find((o) => o !== e && o.text.length > k.length && o.text.startsWith(k));
      if (full && k.length >= 2) {
        full.top = Math.min(full.top, e.top); full.bottom = Math.max(full.bottom, e.bottom); full.size = Math.min(full.size, e.size);
        byText.delete(k);
      }
    }
    const lo = SAFE.top, hi = meta.height - SAFE.bottom;
    const unsafe = [...byText.values()].filter((e) => e.top < lo - 0.5 || e.bottom > hi + 0.5);
    for (const e of unsafe) Wn(`text "${e.text}" reaches y=${Math.round(e.top < lo ? e.top : e.bottom)}; keep text within y ${lo}-${hi} (Reels UI)`);
    if (byText.size && !unsafe.length) say.ok(`text: ${byText.size} string(s) seen, all inside the safe zone (y ${lo}-${hi})`);
    if (!byText.size) {
      say.info('no text seen on the stage. Bitmap, path or offscreen-canvas text is invisible to this check: '
        + 'report it with markText(text, x, y, w, h) (template) or check it against the dashed lines on the contact sheet');
    }
    const small = [...byText.values()].filter((e) => e.size > 0 && e.size < MIN_TEXT_PX);
    if (small.length) {
      say.info(`text under ${MIN_TEXT_PX}px (fine for captions/HUD; main words should be bigger): `
        + small.slice(0, 6).map((e) => `"${e.text}" ${Math.round(e.size)}px`).join(', ') + (small.length > 6 ? ' …' : ''));
    }

    const minAlpha = await page.evaluate(async (t) => {
      await window.seek(t);
      const st = window.__hr.stage;
      const c = document.createElement('canvas');
      c.width = st.width; c.height = st.height;
      const g = c.getContext('2d');
      g.drawImage(st, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let m = 255;
      for (let i = 3; i < d.length; i += 4) if (d[i] < m) m = d[i];
      return m;
    }, times[Math.floor(times.length / 2)]);
    if (minAlpha < 255) Wn(`frame has transparent pixels (min alpha ${minAlpha}); paint the full background every frame`);

    // Strict-palette styles declare COMP.palette (or pass --palette): measure how much of each frame
    // stays within RGB distance 40 of those colours (overlays like scanlines blend only slightly).
    const palette = typeof opt.palette === 'string' ? opt.palette.split(',').map((x) => x.trim()) : meta.palette;
    if (palette && palette.length) {
      const shares = [];
      for (const t of times.filter((_, i) => i % 2 === 0)) {
        shares.push([t, await page.evaluate(async ({ tt, pal, tol }) => {
          await window.seek(tt);
          const st = window.__hr.stage, w = 270, h = Math.round((270 * st.height) / st.width);
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const g = c.getContext('2d');
          g.imageSmoothingEnabled = false;
          g.drawImage(st, 0, 0, w, h);
          const d = g.getImageData(0, 0, w, h).data;
          const rgb = pal.map((hex) => { const n = parseInt(hex.replace('#', ''), 16); return [n >> 16, (n >> 8) & 255, n & 255]; });
          let inside = 0;
          for (let i = 0; i < d.length; i += 4) {
            for (const [r, gg, b] of rgb) {
              const dr = d[i] - r, dg = d[i + 1] - gg, db = d[i + 2] - b;
              if (dr * dr + dg * dg + db * db < tol * tol) { inside++; break; }
            }
          }
          return inside / (d.length / 4);
        }, { tt: t, pal: palette, tol: 40 })]);
      }
      const worst = shares.reduce((a, b) => (b[1] < a[1] ? b : a));
      const avg = shares.reduce((sum, x) => sum + x[1], 0) / shares.length;
      if (worst[1] < 0.9) Wn(`palette: only ${(worst[1] * 100).toFixed(0)}% of pixels at t=${worst[0].toFixed(2)} are on ${palette.join(' ')} (average ${(avg * 100).toFixed(0)}%)`);
      else say.ok(`palette: ${(avg * 100).toFixed(0)}% of pixels on the ${palette.length} declared colours (worst frame ${(worst[1] * 100).toFixed(0)}% at ${worst[0].toFixed(2)}s)`);
    }
    if (opt.gpu) say.info('raster: GPU (--gpu), so the determinism result above is unreliable: GPU raster can differ between pages and runs');

    const perFrame = ms / times.length;
    say.info(`~${Math.round(perFrame)} ms per frame -> about ${Math.ceil((perFrame * meta.duration * meta.fps) / 1000)} s of capture on one worker`);

    if (!meta.audio) Wn('no window.renderAudio(); the base block wants a synthesized soundtrack');
    else {
      const a = await audioCheck(page);
      if (Math.abs(a.duration - meta.duration) > 1 / meta.fps) Wn(`soundtrack is ${a.duration.toFixed(3)}s but the video is ${meta.duration}s`);
      if (a.peak < 1e-4) Wn('soundtrack is silent');
      else if (a.diff > 1e-4) Wn(`renderAudio() differs between runs (max diff ${a.diff.toFixed(4)}); seed every noise source, no Math.random`);
      else say.ok(`audio: ${a.duration.toFixed(2)}s, ${a.channels}ch @${a.rate}Hz, peak ${(20 * Math.log10(a.peak)).toFixed(1)} dBFS, deterministic`);
    }
    if (errors.length) B(`page errors: ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
  } finally {
    await s.close();
  }
  console.log(bad ? `✗ check failed: ${bad} error(s), ${warns} warning(s)` : `✓ check passed${warns ? ` with ${warns} warning(s)` : ''}`);
  process.exitCode = bad ? 1 : 0;
}

async function stills() {
  const file = compPath();
  const s = await session(file);
  try {
    const { page, meta } = s.pages[0];
    const times = (parseTimes(opt.at) || spread(meta, 4)).map((t) => frameTime(meta, t));
    const dir = path.resolve(typeof opt.out === 'string' ? opt.out : path.join(path.dirname(file), 'storyboard'));
    fs.mkdirSync(dir, { recursive: true });
    for (const [i, t] of times.entries()) fs.writeFileSync(path.join(dir, `still-${i + 1}-${t.toFixed(2)}s.png`), await grab(page, t));
    const sheetPath = path.join(dir, 'storyboard.png');
    fs.writeFileSync(sheetPath, await contactSheet(page, times, times.map((t) => labelAt(meta, t)), { cols: autoCols(times.length), cellW: 360 }));
    say.ok(`${times.length} stills -> ${rel(dir)}/still-*.png`);
    say.ok(`storyboard sheet -> ${rel(sheetPath)}`);
  } finally {
    await s.close();
  }
}

async function sheet() {
  const file = compPath();
  const s = await session(file);
  try {
    const { page, meta } = s.pages[0];
    const custom = parseTimes(opt.at);
    const times = (custom || meta.beats.map((b) => b.t)).map((t) => frameTime(meta, t));
    if (!times.length) throw new Error('COMP.beats is empty and no --at times were given');
    const labels = custom ? times.map((t) => labelAt(meta, t)) : meta.beats.map((b) => b.label);
    const out = path.resolve(typeof opt.out === 'string' ? opt.out : path.join(path.dirname(file), 'contact-sheet.png'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await contactSheet(page, times, labels, { cols: int(opt.cols, 1, 12, autoCols(times.length)), guides: !opt['no-guides'] }));
    say.ok(`contact sheet (${times.length} frames) -> ${rel(out)}`);
  } finally {
    await s.close();
  }
}

async function audio() {
  const file = compPath();
  const s = await session(file);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'heptareel-'));
  try {
    const { page, meta } = s.pages[0];
    if (!meta.audio) throw new Error('window.renderAudio() not found');
    const raw = path.join(tmp, 'raw.wav');
    await writeWav(page, raw);
    const out = path.resolve(typeof opt.out === 'string' ? opt.out : path.join(path.dirname(file), 'renders', 'soundtrack.m4a'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const note = normalize(raw, out);
    const L = loudness(out);
    say.ok(`soundtrack -> ${rel(out)}`);
    (loudOk(L) ? say.ok : say.warn)(`loudness ${fmtLoud(L)} (${note})`);
    const graph = `${out.replace(/\.[a-z0-9]+$/i, '')}-graph.png`;
    await audioGraph(page, meta, graph);
    say.ok(`audio graph -> ${rel(graph)}  (hits should start on the red beat lines)`);
  } finally {
    await s.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function video() {
  const file = compPath();
  const name = path.basename(file, path.extname(file));
  const out = path.resolve(typeof opt.out === 'string' ? opt.out : path.join(path.dirname(file), 'renders', `${name}.mp4`));
  const crf = int(opt.crf, 0, 51, 16);
  const preset = typeof opt.preset === 'string' ? opt.preset : 'medium'; // 'slow' is ~2.5x slower for ~3% smaller files
  const started = Date.now();
  const s = await session(file);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'heptareel-'));
  try {
    const { meta } = s;
    const fps = meta.fps;
    const total = Math.round(meta.duration * fps);
    const f0 = int(opt.from !== undefined ? Number(opt.from) * fps : 0, 0, total - 1, 0);
    const f1 = int(opt.to !== undefined ? Number(opt.to) * fps : total, f0 + 1, total, total);
    const frames = Array.from({ length: f1 - f0 }, (_, i) => f0 + i);
    const partial = f0 > 0 || f1 < total;
    fs.mkdirSync(path.dirname(out), { recursive: true });

    // --workers wins; otherwise go parallel only when capture is heavy enough to repay opening more pages
    let workers = int(opt.workers, 1, 8, 0);
    if (!workers) {
      const probe = [0.25, 0.5, 0.75].map((k) => frameTime(meta, meta.duration * k));
      const t0 = performance.now();
      for (const t of probe) await grab(s.pages[0].page, t);
      const estimate = (((performance.now() - t0) / probe.length) * frames.length) / 1000;
      workers = estimate > 8 ? Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2))) : 1;
    }
    while (s.pages.length < workers) await s.add();

    const vtmp = path.join(tmp, 'video.mp4');
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', preset, '-crf', String(crf),
      '-x264-params', 'colorprim=bt709:transfer=bt709:colormatrix=bt709', // tagged, so players decode the palette hex codes correctly
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', vtmp], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', (d) => { ffErr += d; });
    ff.stdin.on('error', () => { /* reported through ffDone */ });
    const ffDone = new Promise((res, rej) => {
      ff.on('error', (e) => rej(new Error(`ffmpeg: ${e.message}`)));
      ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg (video) failed: ${ffErr.trim().slice(-600)}`))));
    });
    ffDone.catch(() => {});
    let shown = 0;
    await renderFrames(s.pages.map((p) => p.page), frames, fps,
      async (buf) => { if (!ff.stdin.write(buf)) await Promise.race([once(ff.stdin, 'drain'), ffDone]); },
      (done) => {
        const q = Math.floor((done / frames.length) * 4);
        if (q > shown && q < 4) { shown = q; say.info(`frames ${done}/${frames.length} · ${((Date.now() - started) / 1000).toFixed(0)}s`); }
      });
    ff.stdin.end();
    await ffDone;

    let audioNote = null;
    let graphPath = null;
    if (meta.audio && !opt['no-audio']) {
      const raw = path.join(tmp, 'raw.wav');
      await writeWav(s.pages[0].page, raw);
      const atmp = path.join(tmp, 'audio.m4a');
      audioNote = normalize(raw, atmp, { from: f0 / fps, dur: partial ? frames.length / fps : null });
      run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', vtmp, '-i', atmp,
        '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-t', (frames.length / fps).toFixed(4), '-movflags', '+faststart', out]);
      graphPath = `${out.replace(/\.mp4$/i, '')}-audio.png`;
      await audioGraph(s.pages[0].page, meta, graphPath, { from: f0 / fps, to: f1 / fps });
    } else fs.copyFileSync(vtmp, out);

    let sheetPath = null;
    const beats = meta.beats.filter((b) => b.t >= f0 / fps && b.t < f1 / fps);
    if (!opt['no-sheet'] && beats.length) {
      sheetPath = `${out.replace(/\.mp4$/i, '')}-sheet.png`;
      fs.writeFileSync(sheetPath, await contactSheet(s.pages[0].page, beats.map((b) => frameTime(meta, b.t)), beats.map((b) => b.label), { cols: autoCols(beats.length) }));
    }

    const info = JSON.parse(run('ffprobe', ['-v', 'error', '-show_entries',
      'stream=codec_type,codec_name,width,height,avg_frame_rate,nb_frames:format=duration', '-of', 'json', out]).stdout);
    const v = info.streams.find((x) => x.codec_type === 'video');
    const a = info.streams.find((x) => x.codec_type === 'audio');
    const [rn, rd] = String(v.avg_frame_rate).split('/').map(Number);
    say.ok(`video -> ${rel(out)}  ${v.width}x${v.height} ${+(rn / (rd || 1)).toFixed(2)}fps ${(+info.format.duration).toFixed(2)}s, ${v.nb_frames} frames, ${v.codec_name}${a ? `+${a.codec_name}` : ''}`);
    if (a) {
      const L = loudness(out);
      (loudOk(L) ? say.ok : say.warn)(`loudness ${fmtLoud(L)} (${audioNote})`);
      say.ok(`audio graph -> ${rel(graphPath)}  (hits should start on the red beat lines)`);
    } else say.warn(opt['no-audio'] ? 'rendered without audio (--no-audio)' : 'no soundtrack: window.renderAudio() is missing');
    if (sheetPath) say.ok(`contact sheet -> ${rel(sheetPath)}  (open it and review every beat before showing the user)`);
    say.info(`${frames.length} frames in ${((Date.now() - started) / 1000).toFixed(1)}s with ${workers} worker(s)${partial ? ` · partial render ${(f0 / fps).toFixed(2)}-${(f1 / fps).toFixed(2)}s` : ''}`);
  } finally {
    await s.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const COMMANDS = { doctor, check, stills, sheet, audio, video };
if (!COMMANDS[cmd]) {
  console.log(USAGE);
  process.exitCode = cmd && !['help', '--help', '-h'].includes(cmd) ? 1 : 0;
} else {
  try {
    await COMMANDS[cmd]();
  } catch (e) {
    say.bad(e.message);
    process.exitCode = 1;
  }
}
