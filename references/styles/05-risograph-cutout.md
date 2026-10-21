# 05 · Risograph cutout

> Paper shapes in two riso inks slide, flip and stack like a handmade stop-motion short. Imperfect on purpose.

| Length | Motion feel | Sound | Level | Palette |
|---|---|---|---|---|
| 9 s | Stop motion on threes | Toy piano, paper foley | Medium | `#F3EFE6` paper · `#FF48B0` fluoro pink · `#00838A` teal (+ overprint mix) |

**Reference frame (author's render, ~6.5 s):** fibrous off-white paper with a cut-paper cartoon computer. Its screen flap is torn open and shows a halftone sun over hills in pink and teal, with a teal power button and a pink zigzag poking out. Below, chunky cut-paper letters "MOTIO" with a paper hand patting down the last letter. You can see the halftone dots, ragged edges, short soft drop shadows, and pink printed slightly off from teal.

## The prompt (verbatim; paste the base block under it)

```text
A 9-second vertical motion graphic that looks like risograph-printed paper cutouts animated in stop motion.

IDEA: flat paper shapes in two riso inks slide, flip and stack on a desk like a handmade stop-motion short. Imperfect on purpose.

0-1.5s: textured paper background. Cutout shapes slide in from all sides in stop motion: a circle, a zigzag, a hand, a star. Each has a small drop shadow and slightly ragged edges.
1.5-3.0s: the shapes pile up into a cartoon computer. Its screen flips open like a paper flap.
3.0-4.5s: inside the flap, a paper sun rises and a paper film strip unrolls across the frame.
4.5-6.0s: the film strip folds like an accordion, each panel showing one letter.
6.0-7.5s: the panels pop up flat into "MOTION" in chunky cut-paper letters. A paper hand slides in and pats the last letter down.
7.5-9.0s: confetti scraps fall and settle. A tiny stamped label "MADE BY CLAUDE" thumps into the corner. Hold.

LOOK: off-white uncoated paper #F3EFE6 with fibers. Two riso inks only: fluoro pink #FF48B0 and teal #00838A, plus their overprint mix. Visible halftone dots in shading, ink grain, and slight misregistration (pink offset 3px from teal). Paper drop shadows that are soft and short. No clean vector look.
MOTION: animate on threes (about 8fps feel) inside the 30fps render, with tiny frame-to-frame jitter on every shape like real stop motion. Squash on landings.
SOUND: playful lo-fi with a toy piano, upright bass and brushed snare, around 100 BPM. Paper slides and rustles, a soft card thump on each landing, a flap whoosh, an accordion squeeze on the fold, a rubber stamp thunk at the end. No narration.
```

## If it goes wrong

If it looks too clean and digital, ask for more ink misregistration and more frame-to-frame jitter.

## Build notes (heptareel additions, not part of the original prompt)

- **Stop-motion time:** on threes at 30 fps is `step = Math.floor(t * 10)` and `tq = step / 10`, each drawing held 3 frames. The prompt's "about 8fps feel" is the 24 fps number; 8 at 30 fps holds unevenly and doesn't divide the beat. At 100 BPM, a beat is 18 frames = 6 drawings, and the prompt's 1.5 s sections are 2.5 beats, so place events on the half-beat grid (9 frames). Every position is computed from `tq`.
- **Jitter and boil keyed to the step:** per shape and step, `dx, dy = (rand(id, step, 1..2) − 0.5) · 4px` and `rot = (rand(id, step, 3) − 0.5) · 1.2°`. Ragged edges: resample each outline to ~200 points and displace by `perlin3(arcLen · 0.05, id, step · 0.37) · 2.5px`, so edges re-cut slightly each step the way real paper does.
- **Two inks, multiplied.** Ink goes on with `globalCompositeOperation = 'multiply'`, and where pink and teal overlap, multiply produces the overprint (a dark navy-violet, about `#00255F`) without any extra colour. Two ways to organize it:
  - *Whole-sheet plates:* one pink plate and one teal plate per frame (offscreen canvases), each multiplied over the paper, with the pink plate offset (3, 1) px for misregistration. Simple, but cutouts can't occlude or shadow each other.
  - *Per cutout (better when shapes stack):* for each cutout in back-to-front order, fill the paper silhouette, then multiply its pink and teal inks inside its clip, with the pink misregistered relative to the cut edge, then its grain. The shadow is drawn before the cutout.
- **Halftone shading:** inside a shape, draw a dot screen clipped to it, with dot radius ∝ √shade. Give each plate its own screen angle (pink 15°, teal 75°) and a 7–9 px cell.
- **Bake the paper and grain once, in `window.ready`:** base `#F3EFE6`, fibres (short thin curves 3–6% darker), low-frequency mottling (±2% lightness), and a speckle grain mask. For uneven ink, erase through the grain with `destination-out` only on a transparent plate or layer; on the opaque stage it punches holes. Directly on the stage, draw paper-coloured speckles with `'lighten'` instead. Reuse these textures every frame.
- **Shadows:** the silhouette offset (4, 6) px in `rgba(60,40,30,0.18)`, softened by a 3 px blur. Short and soft; a shadow blur is fine here because it isn't a glow. Bake one blurred shadow sprite per shape at load and `drawImage` it with the shape's jitter: a per-shape `ctx.filter = 'blur()'` every frame is what makes this style slow on the CPU raster.
- **Paper mechanics:** a flap = `scaleY(cos θ)` around the hinge, with the back face slightly darker past 90°. Accordion fold = alternating mountain/valley panels whose widths follow `cos(foldAngle)`. Squash 12% on the landing step, then release.
- **Stamp:** "MADE BY CLAUDE" is a placeholder. Use the user's credit, or a short brand line (e.g. the launch tag) flagged as an assumption in the storyboard. Teal at −4°, eroded by the grain, landing with a 1-step squash, kept inside y 250–1520. Stamp or cut-paper letters drawn as paths or on a plate need `markText()` for `check` to see them.
- **Sound:** 100 BPM is frame-exact (18 frames per beat). Toy piano = sine + inharmonic partials (×3.1, ×5.9) with fast decay. Upright bass = low Karplus–Strong pluck with a dark excitation. Brushed snare = noise with a slow attack. The paper foley is filtered noise with flutter; references/sound.md has recipes.
