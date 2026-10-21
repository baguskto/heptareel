# 04 · Pixel dither

> A smooth sphere collapses into Game Boy pixels, then bounces through a dithered world.

| Length | Motion feel | Sound | Level | Palette |
|---|---|---|---|---|
| 8 s | Stepped, animated on twos | 8-bit chiptune | Easy | `#0F380F` · `#306230` · `#8BAC0F` · `#9BBC0F` |

**Reference frame (author's render, ~3 s):** a lime Game Boy screen with pixel clouds in the sky, a dithered pixel ball mid-bounce, and parallax pixel hills and bushes with a dark ground strip. Shading comes only from ordered-dither patterns in the four greens.

## The prompt (verbatim; paste the base block under it)

```text
An 8-second vertical motion graphic in low-resolution pixel art with dithering, like a lost Game Boy demo.

IDEA: a smooth, high-res object collapses into pixels, then everything after is pure pixel art. The resolution itself is the effect.

TECH: render the pixel scenes at 135x240, then upscale to 1080x1920 with nearest-neighbour. No anti-aliasing. Use ordered Bayer dithering for all shading. Strict 4-colour palette.

0-1.2s: a smooth, shiny 3D sphere floats in the centre at full resolution.
1.2-2.4s: the resolution steps down on the beat: 1080 → 270 → 68 → 135x240 grid. The sphere becomes a dithered pixel ball.
2.4-4.0s: the pixel ball bounces across a scrolling pixel landscape with parallax hills. Each bounce kicks up 2x2 pixel dust.
4.0-5.2s: glitch: horizontal pixel-sort smears tear across the screen for half a second, then snap clean.
5.2-6.6s: the ball explodes into individual pixels that swarm and reassemble into the chunky pixel word "MOTION".
6.6-8.0s: "MOTION" bounces once, a blinking cursor appears, and "PRESS START" blinks below in tiny pixel font. Hold.

LOOK: Game Boy palette only: #0F380F, #306230, #8BAC0F, #9BBC0F. Thin scanline overlay at low opacity and a faint LCD pixel grid. No gradients except dithering.
MOTION: stepped and chunky. Animate on twos (12fps feel) inside the 30fps render. Snaps are instant, holds are short.
SOUND: 8-bit chiptune around 140 BPM made from square and triangle waves plus a noise channel. A blip on each resolution step, a boing on each bounce, a crunchy bitcrushed burst on the glitch, a rising arpeggio as the pixels reassemble, and a classic coin chime on "PRESS START". No narration.
```

## If it goes wrong

The best first test. Pixel art hides small flaws, so it usually works in one or two rounds.

## Build notes (heptareel additions, not part of the original prompt)

- **Two buffers.** Draw every pixel scene into a 135×240 offscreen canvas (`getContext('2d', { willReadFrequently: true })`). Then put it on the stage with `ctx.imageSmoothingEnabled = false; ctx.drawImage(lo, 0, 0, 1080, 1920)`, so each game pixel is 8×8.
- **Shade in luminance, then quantize every pixel.** Bayer 4×4 = `[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]`. Index = `clamp(round(lum·3 + (B[y&3][x&3] + 0.5)/16 − 0.5), 0, 3)` → palette. `getImageData`/`putImageData` at 135×240 is cheap.
- **0–1.2 s is the one smooth moment:** shade the sphere continuously, but only with colours interpolated between the four greens. The specular highlight is `#9BBC0F`.
- **The step-down:** render the sphere into buffers of width 1080 → 270 → 68 → 135 (height by 16:9), each upscaled nearest-neighbour, one per beat, with a blip each. Dithering applies from the first low-res step on. 68 doesn't divide 1080 (15.9 px blocks, uneven); 72 gives exact 15 px blocks if you want them even.
- **On twos at 30 fps:** compute all pixel-scene motion from `tq = stepped(t, 15)`, holding each drawing 2 frames, while the stage still renders at 30 fps. The prompt's "12fps feel" is the 24 fps number; 12 at 30 fps holds unevenly and drifts off the beat. Snaps happen on the step.
- **Landscape:** bake 2–3 hill height arrays at load (perlin), scroll each by `speed_i · tq` with wrap. Clouds are fixed pixel bitmaps.
- **Bounces and dust:** closed-form bounce (see template). Dust = 2×2 pixel puffs whose positions are functions of `(t − impact)`, gone after ~0.4 s.
- **Pixel-sort glitch:** on the low-res buffer, for rows picked by `rand(row, step)`, sort a run of pixels by luminance or smear one pixel across the run. Snap clean on a step.
- **Explode → word:** each lit pixel of the ball is a particle at `mix(burst(t), target, ease)`. Targets are the lit pixels of "MOTION" drawn with a **hand-made bitmap font** (5×7 or 6×8 glyph arrays). Anti-aliased fonts break the 4-colour rule, so never use `fillText` on the low-res buffer. Bitmap text is invisible to `check`'s text probe, so call `markText(word, x·8, y·8, w·8, h·8)` with its box in stage pixels.
- **The blinking cursor:** a full-height block right after the last letter reads as one more letter in a bold pixel font ("SPROUT█" reads as "SPROUTI"). Use an underscore cursor or leave a full glyph gap, and centre word + cursor as one group.
- **Overlays:** after the upscale, add 1 px dark scanlines every 8 px at ~8–12% alpha plus a faint vertical LCD grid. They're the only pixels outside the palette.
- **Prove the palette:** set `COMP.palette = ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F']` and `check` reports how much of each frame stays on it. Expect ~99% with the overlays.
- **Chiptune:** the template kit has it all: `pulse` (lead, duty 0.125/0.25/0.5), `tri` (bass), `chipNoise` (drums), `crush` (the glitch burst), `arp` (the reassembly), `coin` (PRESS START), `boing` (bounces), `blip` (resolution steps). Use 150 BPM rather than ~140: it's frame-exact at 30 fps (12 frames per beat = 6 drawings on twos). Keep generated hard-edged sounds lowpassed (~8 kHz), because full-scale square edges overshoot the true peak after AAC.
