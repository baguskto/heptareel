# 06 · Renaissance codex

> A quill draws an original flying machine on parchment, then the drawing comes to life and flies off the page.

| Length | Motion feel | Sound | Level | Palette |
|---|---|---|---|---|
| 9 s | Hand rhythm, one fast flight | Lute, quill scratch | Hard | `#E9D9B5` parchment · `#5A3A1E` sepia ink · `#A4452C` red chalk |

**Reference frame (author's render, ~4 s):** aged, stained parchment with a red-chalk circle and square used as construction geometry, plus proportion lines. Inside, a sepia-ink flying machine: a strut frame, a central gear, and two bat-like wings with ribbed membranes. Small gear and pulley side diagrams have leader lines, and lines of mirror-written script fill the margins.

## The prompt (verbatim; paste the base block under it)

```text
A 9-second vertical motion graphic in the style of a Renaissance inventor's notebook. It must be an original drawing, not a copy of any real Da Vinci page.

IDEA: a quill draws an invention on aged parchment: construction lines first, then hatching, then annotations. The finished drawing comes to life and flies off the page.

0-1.5s: aged parchment fills the frame. A red chalk circle and square draw as construction geometry, with proportion lines and small measurement ticks.
1.5-3.5s: sepia ink draws an original flying machine inside the geometry: a wooden frame, gears, and two bat-like wings. Lines go down construction first, then outlines, then cross-hatching for shadow.
3.5-4.5s: small annotations in mirror-written, unreadable script fill the margins, plus tiny side diagrams of a gear and a pulley with leader lines pointing to the machine.
4.5-6.5s: the gears start turning, the wings flap with real follow-through, and the ink drawing lifts off the page. Its cast shadow stays on the parchment.
6.5-9.0s: the machine flies up out of frame. The page turns, and on the new page "MOTION" is drawn in sepia ink with a calligraphic flourish. Hold.

LOOK: parchment #E9D9B5 with stains, foxing and soft vignette. Sepia ink #5A3A1E with varied line weight and occasional ink blots. Red chalk #A4452C for construction lines only. Cross-hatching for all shading. Everything looks hand-drawn with slight wobble. No digital gradients or glows.
MOTION: unhurried drawing speed with a natural hand rhythm: fast strokes, small pauses between them. The flight is the only fast moment. The page turn has real paper curl and shadow.
SOUND: solo lute or harpsichord, slow and warm. Quill scratching that follows every stroke, a soft tap on each ink blot, wooden creaks and clicks when the gears turn, wing flaps, a paper rustle on the page turn. No narration.
```

## If it goes wrong

Expect 2 to 3 rounds on the hatching. Remind it of the drawing order: construction, outline, then hatching.

## Build notes (heptareel additions, not part of the original prompt)

- **A stroke list is the source of truth.** Generate `STROKES = [{ pts, layer, ink, width }]` at load in drawing order: `construction` (red chalk) → `outline` (sepia) → `hatch` → `annotation`. That order is what the fix above asks for, so encode it in the data rather than hoping the drawing code respects it.
- **Hand rhythm as a schedule.** For each stroke, duration = length / speed_i (speed varies ±30% via `rand(i)`), followed by a pause of 40–160 ms (`rand(i, 1)`). Then scale each layer's schedule to its beat window (construction 0–1.5 s, machine 1.5–3.5 s, annotations 3.5–4.5 s). `seek(t)` draws finished strokes whole and the current stroke as an arc-length prefix with the nib at its tip. The same schedule drives the quill-scratch audio.
- **Hand-drawn line:** wobble keyed to arc length (`perlin3(s · 0.03, i, 0) · 1.2px`), and width varying along the stroke like pressure: `w · (0.6 + 0.6 · sin(π s / L))`. Ink blots are small irregular perlin blobs at a few stroke ends chosen by `rand`, each with a tap sound.
- **Hatching:** for each shaded region, parallel lines at ~45°, 7–9 px apart, clipped to the region, with slight angle jitter. Cross-hatch the darkest regions with a second set at −45°. Schedule hatching strokes after all outlines.
- **Keep the machine original:** a strut frame, one or two gears (circle + teeth), a pilot harness, and two bat-like wings (spars radiating from a hinge, scalloped membrane between them). Don't trace a famous ornithopter.
- **Mirror script:** pseudo-words made of loops and hooks of random widths, written right to left with a backward slant, 4–8 words per line in the margins. Unreadable by design.
- **Coming to life:** gear angle = ω·(t − t0), with a click per tooth crossing a reference angle. Wings: root angle `A·sin(ωt)`, tips `A·sin(ωt − φ)` for follow-through. To lift off, render the machine's strokes into an offscreen layer and transform it upward. Its cast shadow is the same layer, darkened to ~18% and blurred, and it stays on the page.
- **Flight (6.5–~7.4 s):** the one fast move, `ease.inExpo` up and out of frame.
- **Page turn:** the turning part of the sheet is reflected across a moving fold line. Draw the back of the page slightly darker, and make the shadow along the fold narrow and soft (paper shading, not a decorative gradient).
- **Calligraphic "MOTION":** strokes drawn with a broad-nib rule, width = `w0 · |sin(angle − 30°)|`, then a flourish stroke. Same schedule mechanism. Because it's drawn as strokes, report its box with `markText()` so `check` can verify the safe zone.
- **Bake the parchment once in `window.ready`:** base colour, large perlin stains, foxing spots, and a vignette (multiply). Never per frame.
- **Sound:** lute/harpsichord = the template's `pluck` (a brighter excitation for harpsichord) over a slow progression. Quill scratch = 3–6 kHz bandpassed noise whose gain follows the active stroke's speed. Creaks = resonant bandpassed noise with slow pitch drift. Wing flaps = lowpassed noise puffs on each down-stroke.
