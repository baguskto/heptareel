# Engine: building a seek(t) composition

1. The contract · 2. What "pure function of time" requires · 3. Randomness · 4. Time, easing, stepped motion · 5. Scenes and cuts · 6. Stateful systems: bake them · 7. Recurring techniques · 8. Text and safe zones · 9. Fonts · 10. Performance

## 1. The contract

`scripts/render.mjs` drives the page through four globals. `assets/template.html` already wires them.

| Global | Required | Meaning |
|---|---|---|
| `window.COMP` | yes | `{ width: 1080, height: 1920, fps: 30, duration, beats: [{ t, label }], palette? }`. `beats` has at least one entry per beat-map row; the contact sheet and the audio graph mark exactly these times. `palette` (optional, hex strings) makes `check` measure how much of each frame stays on those colours. |
| `window.seek(t)` | yes | Paint the frame at `t` seconds onto `canvas#stage`. Synchronous, or return a Promise. |
| `window.ready` | no | Promise for fonts, baked textures and baked simulations. Capture starts after it resolves. |
| `window.renderAudio()` | no* | `async () => AudioBuffer` from an `OfflineAudioContext` exactly `duration` long. *The base block requires a soundtrack. |

While rendering, `window.__HEPTAREEL_RENDER__ === true`: the preview player doesn't start, and nothing draws guides. Frames are captured with `canvas.toDataURL()`, so CSS scaling in the preview never affects the render. Use `getContext('2d', { alpha: false })` (as the template does) and paint the full background every frame.

## 2. What "pure function of time" requires

`render.mjs check` seeks sample frames in two different orders and compares pixels, and it counts `Math.random`/`Date.now`/`performance.now` calls inside `seek()`. These break purity:

- `Math.random()`, `Date.now()`, `performance.now()` or `new Date()` inside `seek()`.
- State carried between calls: `x += vx`, `frame++`, trails that accumulate, particles integrated per call, "previous frame" reads (motion blur by not clearing).
- Canvas state leaking between frames. The template's `seek()` calls `ctx.reset()` first; keep that.
- CSS animations and transitions, timers, `requestAnimationFrame`, `<video>`, or images still decoding when the frame is captured.

Rule of thumb: if a value can't be computed from `t` alone, compute it once at load (section 6) and look it up in `seek()`. Trails are re-drawn from positions computed at `t − k·dt`, never accumulated.

Purity is also what makes rendering fast: `video` captures frames out of order in parallel workers, and `--from/--to` re-renders a section without playing the film from 0.

**The renderer side of purity.** Chrome moves 2D canvases between GPU and CPU raster (startup timing, readback heuristics), and the two paths draw gradients, text, blur and clipped paths a few levels apart. That can make a pure composition fail `check` and make parallel workers disagree. `render.mjs` therefore launches Chrome with CPU canvas raster, which draws identically everywhere, so you don't need `willReadFrequently` hacks. `--gpu` trades that for speed (drafts only). The preview in a normal browser uses the GPU, which is fine for watching.

## 3. Randomness

- **Inside `seek()`:** `rand(...keys)` from the template is counter-based. The same keys give the same number regardless of call order. Key by what the number belongs to: `rand(particleIndex, 1)`, `rand(shapeId, step, 2)`. Use the trailing integer to get independent channels.
- **At load:** `mulberry32(SEED)` is a seeded stream, fine for building textures, layouts or baked simulations in a fixed order. Never consume a stream inside `seek()`, because the result would depend on how many frames were drawn before.
- **Noise:** `perlin3(x, y, z)` is smooth seeded noise in about [−1, 1], used for wobble, boil and flow fields. For wobble that shouldn't swim, key it to arc length or position, not to `t`.
- `SEED` re-rolls the whole film. The audio uses a seeded stream too, so the soundtrack is identical every render.

## 4. Time, easing, stepped motion

- `prog(t, a, b)` → 0..1 through a window; compose with `ease.*`. Snaps are 2–4 frames (`3 / FPS`), holds are readable (≥ 0.3 s).
- `spring(t, freq, damping)` gives a closed-form overshoot for landings and pops, with no state.
- Bounces: closed-form parabolic segments with restitution (see the template's `ballY`). Impacts are known times, so they go straight into `CUE`.
- **On twos / on threes:** quantize time, not frames, and compute the animated values from `tq`; the video still renders at 30 fps. At 30 fps, twos is `tq = stepped(t, 15)` (each drawing held 2 frames) and threes is `stepped(t, 10)` (3 frames). The prompts' "12fps" and "8fps" come from 24 fps animation. `stepped(t, 12)` at 30 fps holds unevenly (3-2-3-2) and drifts off the beat grid. Pick a tempo whose frames-per-beat divides by the hold: 150 BPM = 12 frames = 6 twos, 100 BPM = 18 frames = 6 threes, 120 BPM = 15 frames = 5 threes.
- **One timing table:** every event time lives in `CUE`, wrapped in `snap()` so it sits on a frame. Scenes and the score both read it, which is how "every hit lands on the exact frame the motion lands" holds by construction.
- **Frame-exact tempo:** at 30 fps a beat is `1800 / bpm` frames. 100, 112.5, 120, 128.57, 150 BPM give whole frames (18, 16, 15, 14, 12). Nudging 110 → 112.5 or 128 → 128.57 is inaudible and puts every downbeat on a frame. Otherwise `snap()` each hit.

## 5. Scenes and cuts

`SCENES` is a list of `{ from, to, draw(ctx, localT, t) }`, and `seek()` paints exactly one per frame, so cuts are hard by construction. "No crossfades" means scenes never blend opacity into each other. Hand over with a cut on the beat, a wipe (a shape that covers the frame), a match cut (the same object in both scenes), or a morph (one shape becoming the next). Within a scene, fading a single caption up is fine.

## 6. Stateful systems: bake them

Particles, physics, cloth, flocking and anything else integrated over time get simulated once in `window.ready` and stored per frame:

```js
const N = 30000, FRAMES = Math.round(COMP.duration * FPS), SUB = 2, dt = 1 / FPS / SUB;
const SWIRL = 90, DRAG = 0.9, GRAVITY = 25;               // px/s², 1/s, px/s²
const POS = new Float32Array(FRAMES * N * 2);            // x, y of every particle on every frame

// curl of a noise potential: a divergence-free swirl direction, roughly unit size
const curl = (x, y, z, e = 0.01) => [
  (perlin3(x, y + e, z) - perlin3(x, y - e, z)) / (2 * e),
  -(perlin3(x + e, y, z) - perlin3(x - e, y, z)) / (2 * e),
];

function bake() {
  const rnd = mulberry32(SEED);
  const x = new Float32Array(N), y = new Float32Array(N), vx = new Float32Array(N), vy = new Float32Array(N);
  for (let i = 0; i < N; i++) {                          // a drop: small disc, plunging, slightly spreading
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 24;
    x[i] = 540 + Math.cos(a) * r; y[i] = 330 + Math.sin(a) * r;
    vx[i] = Math.cos(a) * r * 2.5; vy[i] = 260 + rnd() * 160;
  }
  for (let f = 0; f < FRAMES; f++) {
    for (let s = 0; s < SUB; s++) {
      const time = (f * SUB + s) * dt;
      for (let i = 0; i < N; i++) {
        const [cx, cy] = curl(x[i] * 0.01, y[i] * 0.01, time * 0.2);   // ~100 px eddies: smaller than the cloud, so it tears into tendrils
        vx[i] += (cx * SWIRL - vx[i] * DRAG) * dt;
        vy[i] += (cy * SWIRL + GRAVITY - vy[i] * DRAG) * dt;
        x[i] += vx[i] * dt;
        y[i] += vy[i] * dt;
      }
    }
    const o = f * N * 2;
    for (let i = 0; i < N; i++) { POS[o + 2 * i] = x[i]; POS[o + 2 * i + 1] = y[i]; }
  }
}

window.ready = (async () => { await document.fonts.ready; bake(); })();
// in seek(t): const o = Math.min(FRAMES - 1, Math.round(t * FPS)) * N * 2;  particle i is at POS[o + 2*i], POS[o + 2*i + 1]
```

Drawn as 16 px soft sprites (radial gradient, alpha ≈ 0.05) with `multiply` on `#FAFAFA`, this plunges, forms a mushroom cap by ~2 s and curls into tendrils: a working start for style 07, measured at ~77 ms per frame. Memory is N × 2 × frames × 4 bytes (30k particles × 270 frames ≈ 65 MB), which is fine. Baking takes a few seconds and `render.mjs` waits for `window.ready`. Forces that change over the film (attraction to letter targets, a second drop) are functions of the step's `time` inside the bake. Camera moves that "follow" something are computed from baked or closed-form positions (e.g. the average over the last 0.5 s), never smoothed incrementally.

## 7. Recurring techniques

- **Draw-on strokes:** precompute cumulative arc length for each polyline and stroke the prefix up to `L(t)`. The pen tip is the point at `L(t)`. For several strokes in a hand rhythm, schedule start/end times at load (style 06).
- **Morphing shapes:** resample both shapes to the same N points by arc length, then interpolate point by point (stagger along the path for an "unravel"). Never cross-fade two outlines.
- **Low-res pixel art:** draw into a small offscreen canvas, quantize to the palette with a Bayer matrix, then `imageSmoothingEnabled = false` and `drawImage` up to 1080×1920 (style 04).
- **Glyph grids (ASCII):** compute a brightness per cell (raymarch SDFs or rasterize geometry at grid resolution), map to a character ramp, and draw rows with `fillText` (style 03).
- **Print textures** (paper, grain, parchment, halftone): bake into offscreen canvases in `window.ready` and composite each frame. Ink plates go on with `multiply`, and misregistration is a plate offset (style 05).
- **Glow, sparingly:** one blurred copy of the bright layer (`ctx.filter = 'blur(6px)'`, `'lighter'`, low alpha) per frame. Per-element `shadowBlur` is slow and reads as "glow spam".
- **Dark vs light grounds:** additive (`'lighter'`) builds colour on dark backgrounds; on light ones it washes out to white. Use `multiply` there (style 07).
- **WebGL:** if you need it, render into an offscreen WebGL canvas created with `preserveDrawingBuffer: true` and `drawImage` it onto the 2D stage inside `seek()`.

## 8. Text and safe zones

- Reels/TikTok UI covers the top 250 px and the bottom 400 px. All text (titles, captions, HUD, labels) stays in **y 250–1520**. `check` measures every string drawn on the stage (and single letters ≥ 40 px) and warns when one leaves that band. The preview's "safe zone" toggle (key `g`) shades the bands.
- Main words at least 60 px tall at 1080 wide. Captions and HUD can be smaller, but check them on a phone.
- Typing effect: `chars = Math.floor(prog(t, a, b) * text.length)` (linear) or one character per frame, `Math.floor((t − a) * FPS)`.
- Letters animated one by one: measure each glyph with `measureText` once, lay them out, then transform each glyph around its own centre.
- Text that must be a single continuous stroke (style 01) or pixel-exact (style 04) is not a font: author it as a path or a bitmap.
- `check` measures `fillText`/`strokeText` on the stage only. For text drawn any other way (bitmap fonts, stroked paths, particles that settle into a word, text on an offscreen plate), call `markText(text, x, y, w, h)` from `seek()` with its box in stage pixels. It's a no-op outside `check`. Otherwise check it by eye against the dashed lines on the contact sheet.

## 9. Fonts

The output is one self-contained HTML file, so prefer system fonts with fallbacks: heavy grotesque `"Arial Black", "Helvetica Neue", Arial, sans-serif`; mono `Menlo, "DejaVu Sans Mono", Consolas, monospace`; serif/calligraphic `"Snell Roundhand", "Apple Chancery", "Zapfino", serif` (macOS). For an exact typeface, embed it as a base64 `@font-face` and `await document.fonts.load('900 300px "Name"')` in `window.ready` before the first frame, since canvas doesn't wait for fonts.

## 10. Performance

- `check` prints milliseconds per frame. Under ~20 ms is comfortable, and 30–80 ms is fine for heavy styles. `video` goes parallel automatically when capture would take more than ~8 s, and `--workers n` forces it.
- Precompute anything that doesn't depend on `t`: layouts, glyph metrics, paths, textures, the arc-length tables.
- Reuse offscreen canvases; don't create canvases inside `seek()`.
- `getImageData` is fine at low resolution (135×240) and expensive at 1080×1920. Avoid it per frame on the full stage.
- `ctx.filter = 'blur(…)'` is the expensive operation on the CPU raster: one per-shape blur per frame took a riso composition from ~70 to ~335 ms per frame. Bake blurred shadow and glow sprites per shape at load and `drawImage` them, or blur one combined layer once per frame.
