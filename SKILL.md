---
name: heptareel
description: Use when the user wants a short vertical motion graphic, animated reel or showreel clip (under ~10 s, 1080x1920, for Reels/TikTok/Shorts) made entirely in code, with no After Effects and no keyframes, a synthesized soundtrack, and an MP4 at the end. Also use when they name or paste one of these styles - one continuous line graph, one-ball showreel, ASCII terminal, pixel dither / Game Boy, risograph cutout / paper stop motion, Renaissance codex / Da Vinci notebook, ink in water / particles into text - or mention the "Claude motion videos" tutorial (@janustiu), its base block, seek(t) canvas rendering, a storyboard -> contact sheet -> MP4 loop, or fixing such a render (text too small, music off the beat, loop jumps, looks too digital). Indonesian - "bikin video motion", "animasi reels", "motion graphic pakai Claude".
---

# Heptareel

Seven code-built motion reel styles, plus the loop that makes them: **storyboard → build → self-review → iterate → export**. Every video is one self-contained HTML file whose canvas frame is a pure function of time, `seek(t)`. Music and every sound effect are synthesized in code, and Playwright + ffmpeg render it to MP4. The output is this plain canvas file plus `render.mjs`, not Remotion, HyperFrames or After Effects. Adapted from @janustiu's free tutorial "Claude motion videos, step by step" (see NOTICE.md).

`<skill>` below means this skill's directory. The render tool is `node <skill>/scripts/render.mjs`.

## The base block: the spec for every video

Apply it even when the user only pastes a style prompt; the style prompts assume it.

```text
FORMAT: 1080x1920 vertical, 30fps, under 10 seconds.
BUILD: one self-contained HTML file. Every frame is drawn on canvas as a pure function of time (seek(t)). No timers, no CSS transitions, seeded randomness only. Render to MP4 with Playwright + ffmpeg.
SOUND: synthesize the music and every sound effect in code. Lock every hit to the visual beat. Mix to -14 LUFS and mux into the MP4.
PROCESS: show me the storyboard first: a beat map with timestamps and 4 key stills as PNGs. Stop and wait for my approval before you build anything. After rendering, export a contact sheet (one frame per beat), review it yourself, fix anything weak, then show me the final.
RULES: keep text out of the top 250px and bottom 400px (Reels UI). No crossfades, no generic gradients, no glow spam, nothing that looks like a template.
```

## Pick the style

| # | Style | Reference | Length | Motion feel | Sound | Level |
|---|---|---|---|---|---|---|
| 01 | One-line graph | references/styles/01-one-line-graph.md | 8 s | Continuous, the pen never lifts | Marimba, pen scratch | Medium |
| 02 | One-ball showreel | references/styles/02-one-ball-showreel.md | 8 s | Hard snaps, short holds | 128 BPM electronic | Easy |
| 03 | ASCII terminal | references/styles/03-ascii-terminal.md | 8 s | Smooth 3D in a rigid grid | Minimal techno, key clicks | Medium |
| 04 | Pixel dither | references/styles/04-pixel-dither.md | 8 s | Stepped, animated on twos | 8-bit chiptune | Easy |
| 05 | Risograph cutout | references/styles/05-risograph-cutout.md | 9 s | Stop motion on threes | Toy piano, paper foley | Medium |
| 06 | Renaissance codex | references/styles/06-renaissance-codex.md | 9 s | Hand rhythm, one fast flight | Lute, quill scratch | Hard |
| 07 | Ink in water | references/styles/07-ink-in-water.md | 9 s | Slow motion, organic | Ambient piano, no drums | Hard |

Read the chosen style file in full: it holds the verbatim prompt, what the original render looked like, the known fix, and build notes on implementing it in `seek(t)`.

- **Where to start:** pixel dither and the one-ball showreel work in one or two rounds. Renaissance codex and ink in water are hard, so tell the user to expect 2–3 rounds.
- **Remix (the usual case):** keep the preset's LOOK, MOTION and SOUND, and replace the IDEA, the BEATS and the final word. "MOTION" in every preset is a placeholder for the user's word or brand.
- **No preset fits:** write a new style prompt with references/prompt-anatomy.md (opening line, IDEA, BEATS, LOOK, MOTION, SOUND).
- **A reference image or video frame from the user:** read it and match its look.

## Workflow

### 0. Setup, once per machine

Run `node <skill>/scripts/render.mjs doctor`. If it reports something missing (ffmpeg, Playwright, a Chromium/Chrome), tell the user what it will install, then run `doctor --fix`. Polish comes from the model checking its own frames, so recommend `/effort high` or above (max lasts one session).

### 1. Project folder

One folder per video, e.g. `motion-01/`:
- `comp.html`, copied from `<skill>/assets/template.html`
- `prompt.md`, holding the full style prompt as used (preset, adapted) with the base block under it, so the style can be remixed later
- `storyboard/` and `renders/`, which render.mjs fills

### 2. Storyboard, then stop

1. Write the beat map: a table with one row per time range, `time | on screen | motion | sound hit`, matching the prompt's BEATS.
2. Make 4 key stills. In `comp.html`, set `COMP`, `PAL` and fonts. Then make `SCENES` one static scene per still, each covering the time range around its still, and draw the four defining moments (hook, turn, climax, landing) with the real palette and type. No transitions or soundtrack yet. Fill `COMP.beats` with at least one entry per beat-map row.
3. Run `node <skill>/scripts/render.mjs stills motion-01/comp.html --at t1,t2,t3,t4`, which writes `storyboard/still-*.png` and `storyboard/storyboard.png`. `check` can already run at this stage; "soundtrack is silent" is expected.
4. Open `storyboard.png` yourself (Read) and fix anything obviously off.
5. Show the beat map and the still paths, list any assumptions (e.g. the credit or stamp text that replaces "MADE WITH CLAUDE" when the user gave none), then **stop and wait** for approval or redirection. Don't animate or score anything until the user approves.

If the user pre-approved the storyboard or asked to skip it, still make the beat map and the stills, because they're the cheapest review you get. Just don't stop. Redirecting a storyboard costs one message; redirecting a finished render costs a rebuild.

### 3. Build

- Implement every beat in `comp.html`. Keep the template's KEEP sections and rewrite its EDIT sections (`CUE`, `PAL`, scenes, score).
- Put every timed event in `CUE`, wrapped in `snap()`. Scenes and the score both read it, which is what keeps every hit on its frame.
- Engine rules are in references/engine.md: purity, randomness, baking simulations, stepped motion, textures, text and fonts. Instruments, foley, music/sfx buses, sync and mix are in references/sound.md.
- Strict-palette styles (pixel dither, ASCII, the showreel's flat colours) set `COMP.palette`. Text that isn't `fillText` on the stage (bitmap fonts, paths, particles, offscreen plates) gets a `markText(text, x, y, w, h)` call, so `check` can see it.
- Run `node <skill>/scripts/render.mjs check motion-01/comp.html` until it reports no ✗. It covers determinism, the contract, text vs safe zones, palette coverage, and soundtrack presence and determinism.

### 4. Render and review it yourself

`node <skill>/scripts/render.mjs video motion-01/comp.html --out motion-01/renders/v1.mp4` writes three files:
- the MP4 (H.264 + AAC, −14 LUFS, true peak under −1 dBTP)
- `v1-sheet.png`, a contact sheet with one frame per `COMP.beats` entry, where dashed lines mark the safe zone
- `v1-audio.png`, the soundtrack waveform with a red line per beat

You can't listen, so the graph is how you check sync: each hit should start on its beat line.

Open the contact sheet and check each cell:
1. It matches the approved still and beat map at that timestamp.
2. Colours come from the style's palette only, with no generic gradients, glow spam, crossfades or template look.
3. Text stays between the dashed lines, is readable on a phone (main words ≥ 60 px), and is spelled right.
4. The frame is filled; no beat uses half the screen by accident.
5. The first second works with the sound off.
6. The style's own invariant holds (see its build notes): one unbroken line, the ball in every shot, glyphs only, 4 colours, two inks, drawing order, a readable word.

Fix weak beats and re-render as v2, v3… Use `--from s --to s` to re-render only a section while iterating. Then present the MP4 path, the contact sheet path, the loudness line from the render summary, and two or three lines on what you fixed. On macOS, offer `open <mp4>`.

### 5. Iterate

The user points at timestamps ("at 3s the top half is empty"). Edit the same `comp.html`; never start over. references/fixes.md maps common complaints to exact changes. A new concept keeps the style and goes back to step 2.

### 6. Export

Do a final render into the project folder (`motion-01/motion-01.mp4`), then go through the before-you-post checklist in references/fixes.md: watch it on a phone, first second works muted, no text under the Reels buttons, prompt saved.

## render.mjs

| Command | What it does |
|---|---|
| `doctor [--fix]` | Checks Node 18+, ffmpeg (libx264, loudnorm), Playwright and a browser; `--fix` installs what's missing |
| `check comp.html [--palette #a,#b]` | Contract, determinism (frames rendered in two seek orders must match), Math.random/clock use inside `seek()`, text vs safe zones, palette coverage (`COMP.palette`), transparency, soundtrack |
| `stills comp.html --at a,b,c,d [--out dir]` | Full-resolution PNGs plus a `storyboard.png` strip |
| `sheet comp.html [--out file] [--at …]` | Contact sheet of `COMP.beats` (or given times) |
| `audio comp.html [--out file.m4a\|.wav]` | Soundtrack only, normalized, plus its beat-line graph; quick for score iteration |
| `video comp.html [--out file] [--from s --to s] [--workers n] [--crf n] [--preset p] [--no-audio] [--no-sheet]` | MP4 + contact sheet + audio graph + summary (size, fps, duration, LUFS, true peak) |

Canvas raster runs on the CPU, which keeps frames identical across seek orders, workers and runs. `--gpu` on any command is faster, but GPU raster can differ between pages, so only use it for drafts.

## Mistakes that cost a round

- Building before the storyboard is approved.
- Calling `Math.random`/`Date.now` inside `seek()`, or integrating particles or physics inside it. Frames then depend on render order. Bake at load instead (engine.md §6).
- Writing a "one continuous line" word with `fillText`. Font glyphs are separate contours, so author a single centreline path (style 01).
- Using additive (`'lighter'`) blending on a white background, where the ink vanishes. Use `multiply` (style 07).
- Typing audio cue times separately from the visual timings. They drift, so keep one `CUE` table.
- Using `ctx.filter = 'blur(…)'` on many elements every frame, which is slow on the CPU raster. Bake blurred shadow and glow sprites at load instead.
- Using `stepped(t, 12)` or `stepped(t, 8)` for "on twos"/"on threes". Those rates come from 24 fps; at 30 fps use 15 and 10 (engine.md §4).
- Crossfading between scenes. Cut on the beat, wipe, match-cut or morph instead.
- Starting a new file for a revision instead of editing `comp.html`.
- Leaving the preset word "MOTION" or the "MADE WITH CLAUDE" credit when the user gave their own.
