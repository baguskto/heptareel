# 01 · One continuous line

> A single blue pen stroke starts as a line graph, then keeps drawing new shapes without ever lifting.

| Length | Motion feel | Sound | Level | Palette |
|---|---|---|---|---|
| 8 s | Continuous, the pen never lifts | Marimba, pen scratch | Medium | `#F4F1EA` paper · `#DAD5CA` grid · `#2F5BFF` line |

**Reference frame (author's render, ~3.8 s):** off-white graph paper with a faint square grid. One blue line draws a keyboard outline whose top edge is a row of key bumps, with a hand made of finger loops resting on the keys. The line trails off to the bottom right, and a small glowing dot sits at the pen tip. Nothing else is on screen.

## The prompt (verbatim; paste the base block under it)

```text
An 8-second vertical motion graphic drawn entirely with ONE continuous line that never breaks or lifts.

IDEA: a single electric-blue line starts as a line graph, then peels off the chart and keeps drawing, turning into new shapes. The line is the only moving thing. It ends by writing "motion" in continuous script.

0-1.5s: off-white graph paper, faint grid. A dot appears bottom left and draws a jagged line graph left to right, values climbing. Axis ticks pop in as it passes.
1.5-3.0s: at the peak the line overshoots the chart, loops once, and the whole graph unravels into the same line pulling upward.
3.0-4.5s: the line draws a single-line portrait of a hand on a keyboard, one stroke, like a continuous-line illustration.
4.5-6.0s: the hand unravels and the line spirals into a play button shape, then a soundwave that pulses three times.
6.0-8.0s: the wave flattens and writes "motion" in one continuous script stroke, centred. A small mono caption "ONE LINE. ONE PROMPT." fades up beneath. Hold.

LOOK: off-white #F4F1EA, grid lines #DAD5CA at 1px, line in electric blue #2F5BFF at 6px with a round cap and a very slight ink wobble. A small glowing dot at the pen tip. No fills, no other colours, no shadows.
MOTION: the pen tip moves at a steady drawing speed, accelerating only on long straight runs. Each new shape forms by the old one unravelling, never by cutting or fading. The camera drifts slowly to follow the pen tip.
SOUND: light marimba and plucked bass around 110 BPM. A soft pen-scratch texture that follows the drawing speed, a tick on each axis mark, a bright pluck as each new shape completes. No narration.
```

## If it goes wrong

If the line breaks, say: "The line must be one unbroken path. Check every frame."

## Build notes (heptareel additions, not part of the original prompt)

- **Make the break impossible by construction.** Build the whole film at load as one polyline `PATH` (graph → overshoot loop → hand → spiral → play button → wave → script word). Every frame strokes a prefix of that one path, never a second `beginPath()` for "the line".
- **Never use `fillText`/`strokeText` for the word.** Font glyphs are separate closed contours and break the one-line rule. Author the cursive "motion" (or the user's word) as a single centreline of ~60–100 hand-placed points through a Catmull–Rom spline. Join the letters, cross the t with a loop-back, and dot the i with a tiny loop. Check it with `stills` before animating anything. Report the word's box with `markText()` so `check` sees it; the mono caption can stay `fillText`.
- **Arc length drives time.** Precompute cumulative length along `PATH`. Bake a `drawn(frame)` table from a speed profile: steady, faster on long straight runs (speed ∝ 1 + k·straightness). `seek(t)` strokes the prefix up to `drawn(t)`. The pen tip is the point at that length.
- **Unravel, don't cut.** For each handover, resample the old shape and the new shape to the same N points by arc length and morph point by point. Let the morph progress lag along the path (`k_i` delayed by `i/N`) so it reads as the line being pulled, not a crossfade.
- **Wobble is fixed to the paper.** Offset points by `perlin3(s * 0.02, 0, 1) * 1.5px` keyed to arc length `s`, never to `t`. Otherwise the line swims.
- **Glow dot:** one small radial dot at the pen tip. It is the only glow in the film.
- **Camera follow stays pure:** camera = average pen position over `[t − 0.6, t]` (8 samples of the drawn-length table), translate ≤ ~120 px, scale ≤ 1.15. The grid lives on the same transform, because it's the paper.
- **Axis ticks** pop (scale 0 → 1 over 3 frames, `outBack`) at the time the pen x passes them. Read those times from the length table and put them in `CUE` so the tick sounds land on the same frames.
- **Pen scratch follows speed:** bandpassed noise (2–5 kHz) with `gain.setValueAtTime(speed(t))` scheduled every frame from the same table. The "bright pluck as each shape completes" goes on each segment's end time.
- 110 BPM isn't frame-exact at 30 fps; 112.5 BPM is (16 frames per beat), or snap every hit to its frame.
