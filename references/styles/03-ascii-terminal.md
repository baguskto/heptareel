# 03 · ASCII terminal

> A 3D head built only from text characters, spinning inside a terminal. It looks like Claude Code is drawing it.

| Length | Motion feel | Sound | Level | Palette |
|---|---|---|---|---|
| 8 s | Smooth 3D in a rigid grid | Minimal techno, key clicks | Medium | `#000000` black · `#33FF66` phosphor green |

**Reference frame (author's render, ~4 s):** a black terminal window with a thin green border. The title bar reads "claude — ~/motion" with a frame counter "121/240" on the right, and the brighter green prompt line reads "$ claude render --motion". Below it, a large ASCII bust in profile, shaded with denser characters where it's lit and slightly whiter at the brightest cells.

## The prompt (verbatim; paste the base block under it)

```text
An 8-second vertical motion graphic where everything is rendered ONLY with monospace text characters, like a 3D demo running inside a terminal.

IDEA: a 3D object made entirely of ASCII characters spins inside a terminal window. Brightness maps to characters: " .:-=+*#%@". It feels like Claude Code itself is drawing.

TECH: render 3D geometry yourself, sample brightness into a character grid of about 90 columns, and draw each cell as a monospace glyph. No pixels outside the glyph grid.

0-1.0s: black terminal. A blinking cursor types "$ claude render --motion" character by character.
1.0-3.0s: an ASCII torus fades up from sparse dots to dense characters and spins in 3D. Lighting rotates so the characters ripple from "." to "@".
3.0-4.5s: the torus morphs into a rotating ASCII human head (simple low-poly bust), still spinning.
4.5-5.5s: glitch: rows of characters shift sideways, some cells flip to random symbols, then lock back.
5.5-7.0s: the head shatters into falling characters that pile up at the bottom, then fly up and arrange into a huge ASCII-art "MOTION".
7.0-8.0s: a status line types beneath: "rendered 240 frames. 0 keyframes." Cursor blinks. Hold.

LOOK: pure black #000000. Characters in phosphor green #33FF66 with a faint glow, brightest characters slightly whiter. Subtle CRT curvature, scanlines and flicker. One monospace font throughout.
MOTION: smooth 3D rotation inside a rigid character grid. Typing is linear. Glitches are 2-3 frames.
SOUND: dark minimal techno around 124 BPM. Mechanical keyboard clicks for typing, a CRT hum underneath, data chirps on the glitch, a cascade of tiny ticks as the characters fall, a deep hit when "MOTION" locks. No narration.
```

## If it goes wrong

If the head looks blurry, ask for a denser character grid, around 120 columns.

## Build notes (heptareel additions, not part of the original prompt)

- **Grid geometry:** measure the glyph advance with `ctx.measureText('M').width` and size the font so `columns × advance = 1080`. At 90 columns that's a 12 px cell (Menlo ≈ 0.6 em → ~20 px font), with rows of ~24 px for about 80 rows. Cells are about 1:2, so stretch ray directions by the cell aspect or the head comes out squashed.
- **Raymarch signed distance fields (SDFs), one ray per cell.** Torus SDF, plus a head made of smooth-unioned primitives (cranium sphere, jaw ellipsoid, neck cylinder, nose wedge). The torus → head morph is then just `mix(dTorus, dHead, k)`. That's 7–15k rays × ~40 steps, which is fast. Brightness = `max(0, dot(normal, light(t)))` → index into `" .:-=+*#%@"`, with the light direction rotating with `t`.
- **No pixels outside the glyph grid:** draw the terminal chrome with box-drawing characters (`┌ ─ ┐ │ └ ┘`). CRT effects (scanlines, flicker, vignette, mild curvature) act on the finished frame, so they're allowed.
- **Glow without glow spam:** draw the glyph layer once, then draw it again once with `ctx.filter = 'blur(6px)'` under `'lighter'` at low alpha. That's one extra pass per frame, never a shadow per glyph. The brightest ramp levels get colour `mix(#33FF66, #CCFFDD, k)`.
- **Glitch:** for 2–3 frame bursts, rows chosen by `rand(row, burst)` shift by whole cells, and cells where `rand(col, row, frame) < p` swap to random symbols. Lock back on a frame boundary.
- **Fall and pile:** every lit cell becomes a glyph particle with closed-form fall `y = y0 + ½g(t − t0)²`, stopping at its column's pile height (computed at load by counting glyphs per column). Then each flies to a target cell of the big ASCII "MOTION". Get the targets by rendering the word in a heavy font to an offscreen canvas at grid resolution and thresholding. Pair particles to targets sorted by x so paths don't cross wildly.
- **Typing is linear:** `chars = floor(prog(t, a, b) · text.length)`. Each character's appear time is a `CUE` entry, and each gets one key click. The cursor `█` blinks at 2 Hz after typing ends.
- **Make the status line true:** compute "rendered 240 frames" from `COMP.duration · COMP.fps`. The title-bar frame counter is `round(t · fps) + 1 / total`.
- **Safe zone:** the reference's title bar sits in the top 250 px band. Move it down or keep it text-free, because `check` will flag it.
- 124 BPM isn't frame-exact at 30 fps; use 120 or 128.57, or snap hits.
