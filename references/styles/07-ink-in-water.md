# 07 · Ink in water

> Thousands of particles behave like ink dropped in water, then slowly condense into a word.

| Length | Motion feel | Sound | Level | Palette |
|---|---|---|---|---|
| 9 s | Slow motion, organic | Ambient piano, no drums | Hard | `#FAFAFA` water · `#1B1F6B` deep indigo · `#C2185B` magenta (+ violet mix) |

**Reference frame (author's render, ~4 s):** near-white water with a faint surface line. A soft indigo cloud with curling tendrils, a magenta plume dropping into it from above, and violet where they mix. No hard edges anywhere.

## The prompt (verbatim; paste the base block under it)

```text
A 9-second vertical motion graphic of ink dropped into water, built from a particle simulation, that blooms into letters.

IDEA: about 30,000 particles behave like ink in water: they fall, curl and bloom in slow motion, then a flow field gently pulls the cloud into the word "MOTION", which dissolves again.

TECH: simulate particles with curl noise for turbulence, slight gravity and drag. For the letter phase, blend each particle toward a target point sampled from the word's shape. Draw with additive blending at low opacity so dense areas build up rich colour. Seeded randomness so renders are repeatable.

0-1.0s: pure white water tank, a faint surface line at the top. A single drop of ink hits the surface.
1.0-3.5s: the ink plunges and blooms into a slow mushroom cloud, curling tendrils spreading in deep indigo.
3.5-4.5s: a second drop of magenta falls. Where colours overlap they mix into violet swirls.
4.5-7.0s: the turbulence calms. Every particle drifts toward the letterforms, and the cloud slowly condenses into "MOTION", tendrils still curling at the edges.
7.0-9.0s: the word holds for one second, then the bottom edge begins to dissolve back into drifting smoke. End mid-dissolve.

LOOK: clean white #FAFAFA water with subtle caustic light ripples. Ink colours: deep indigo #1B1F6B, magenta #C2185B, and their violet mix. Soft, silky, macro-photography feel. No hard edges, no outlines.
MOTION: slow motion throughout, like 1000fps footage played back. Organic, never linear. The letter formation is gradual, not snapped.
SOUND: cinematic ambient, slow piano notes with long reverb, no drums. A deep underwater plunk on each drop, low muffled rumbles as the ink blooms, a soft rising swell as the letters form, then a long fading tone. No narration.
```

## If it goes wrong

The heaviest render. If the word doesn't read, ask for more of the particles to settle into the letters.

## Build notes (heptareel additions, not part of the original prompt)

- **On a white tank, "additive" has to become subtractive.** Additive (`'lighter'`) blending only builds colour on a dark background; on `#FAFAFA` it washes out to white. The prompt's goal is that dense areas build rich colour, so get it with `globalCompositeOperation = 'multiply'` at low alpha (0.03–0.08 per particle), or accumulate density offscreen and map it Beer–Lambert style (`colour = paper · exp(−k · density · absorbance)`). Indigo × magenta under multiply gives the violet mix for free.
- **Bake the simulation; never integrate inside `seek()`.** In `window.ready`, step all particles with a fixed dt (1/30 s, 2 substeps) and store positions per frame in one `Float32Array`: 30k × 2 × 270 frames ≈ 65 MB. `seek(t)` reads frame `round(t · fps)`. This keeps frames identical in any seek order, so `check` passes and parallel workers agree.
- **Forces:** curl noise (the 2D curl of `perlin3(x·s, y·s, time·0.1)`: `vx = ∂ψ/∂y`, `vy = −∂ψ/∂x` by finite differences) + slight gravity + drag (`v *= 0.96` per step). For the mushroom bloom, give the first drop an initial vortex-ring velocity (down through the centre, out and up at the rim) and emit over ~0.3 s from the impact point. The magenta drop at 3.5 s is its own particle set (e.g. 12k of the 30k).
- **Letters:** at load, `fillText` the word in a heavy font (~900 px wide, centred, inside y 250–1520; report that box with `markText()` during the letter phase, since particles are invisible to `check`'s text probe) on an offscreen canvas, collect pixels with alpha > 128, and give each particle a random target from them. From 4.5–7.0 s, ramp an attraction force toward the target up while turbulence ramps down. Keep ~10% "edge" particles weakly attracted so tendrils still curl. From 7.0 s, release attraction bottom-up (lower targets first) so the bottom edge dissolves, and end mid-dissolve.
- **Draw:** pre-render one soft round sprite per ink colour (6–10 px radial falloff) and `drawImage` each particle with multiply, varying size by `rand(i)`. Slow motion comes from small per-frame displacements, not from a lower frame rate.
- **Caustics:** 2–3 baked caustic textures sliding slowly as a function of `t` at 3–5% opacity. The surface line is a thin, slightly darker line near the top. It isn't text, so it's allowed in the top band.
- **Performance:** expect ~30–80 ms per frame plus a few seconds of baking. `render.mjs video` switches to parallel workers automatically. If the word doesn't read, raise attraction, reduce the edge fraction, and raise sprite alpha for settled particles.
- **Sound:** ambient piano = additive sine partials with soft attack and long release into the reverb (high send), no drums. Underwater plunk = sine sweep 400 → 90 Hz in ~120 ms through a lowpass, plus short upward bubble chirps. Rumbles = lowpassed brown noise swelling with the bloom. The swell builds from 4.5 to 7.0 s, then a long fading tone.
