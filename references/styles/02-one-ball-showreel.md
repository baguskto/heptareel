# 02 · The one-ball showreel

> Five motion techniques in eight seconds, all carried by one red ball. Built on the prompt that went viral.

| Length | Motion feel | Sound | Level | Palette |
|---|---|---|---|---|
| 8 s | Hard snaps, short holds | 128 BPM electronic | Easy | `#111116` off-black · `#EFEBE4` cream · `#FF3319` red · `#2A42FF` cobalt |

**Reference frame (author's render, chapter 02):** a flat red frame with "MO / TI / ON" stacked on three lines in huge black heavy grotesque caps that fill the width. A thin HUD sits just inside the safe zone: corner brackets, "KINETIC TYPE" top left, "02 / 05" top right, "128 BPM ●●○○" bottom left, and a running timecode "00:00:02:00" bottom right.

## The prompt (verbatim; paste the base block under it)

```text
Make a dynamic 8-second motion graphics video that shows what an incredible motion designer you are, like it's your showreel for a résumé. Go all out.

IDEA: one small red ball (#FF3319) is in every shot. Each chapter is a different motion technique acting on it. At the end it becomes the full stop of the word "MOTION".

0-1.2s: off-black frame, white ground line. The ball drops and bounces three times with real squash and stretch, then scales up to flood the screen red.
1.2-2.6s: on red, "MOTION" slams in letter by letter in huge black heavy grotesque caps. A white line slices it, the halves slide apart and snap back.
2.6-4.0s: cream background. A rotating sphere of dots orbits the ball, flattens into a ring, a black circle swallows it.
4.0-5.2s: a grid of dots ripples out from the ball and flips into red, white and cobalt diamonds in waves. A cobalt circle wipes.
5.2-6.4s: segmented rings rush toward camera around the ball like a tunnel, then collapse to black.
6.4-8.0s: the ball bursts into shards that snap together into "MOTION" with the ball as its full stop. "MADE WITH CLAUDE" types on beneath in small mono caps. Hold.

FRAME: thin overlay throughout: corner brackets, chapter counter "01 / 05" top right, running timecode bottom right, all inside the safe zone.
LOOK: off-black #111116, cream #EFEBE4, red #FF3319, cobalt #2A42FF. Flat shapes only. Extra-bold geometric grotesque plus monospace labels.
MOTION: snaps of 2-4 frames against short readable holds. Real weight on bounces. Hard cuts on the beat.
SOUND: 128 BPM electronic beat, crisp hats, sub bass. Wooden thud on each bounce, clicks per letter, a blade slice, ticks on the grid flips, a riser into the tunnel, a beat of silence, then a shatter and deep bass hit on the wordmark. No narration.
```

## If it goes wrong

One object in every shot is what makes it feel like a reel, not a list of effects. Keep the ball.

## Build notes (heptareel additions, not part of the original prompt)

- **The ball is a function, not a sprite per scene.** Write `ball(t) → { x, y, r, sx, sy, visible }` that is defined for every `t` and have each chapter transform it. If any contact-sheet cell has no ball, the beat is wrong.
- **Bounce with weight:** closed-form parabolic segments with restitution (the template's `ballY`). Squash on the 1–2 impact frames, stretch along the velocity while falling fast, and anchor the squash to the ground.
- **Slam:** each letter scales 1.6 → 1 over 2–3 frames (`outCubic` or `outBack`), with a click on the frame it lands. The stacked "MO / TI / ON" layout from the reference fills 1080 px well (~330 px caps). Fonts: `"Arial Black"`, `"Helvetica Neue"` 900, or an embedded extra-bold grotesque.
- **Slice:** draw the word twice, clipped above and below the slice line. Offset the halves ±x, then snap back in 2–4 frames. The blade sound goes on the slice frame.
- **Sphere of dots:** Fibonacci-sphere points rotated by angle(t) and perspective-projected. "Flatten into a ring" = scale y → 0. The swallow is a black circle growing from the ball.
- **Grid ripple:** each dot flips (`scaleX = cos(angle)`) when the ripple front `(t − t0) · speed` reaches its distance from the ball. Colour by ring index (red / white / cobalt), diamonds are 45° squares, one tick per ring in the score.
- **Tunnel:** rings at depth `z_i(t) = (i · gap − t · speed) mod depth`, radius `R / z`, each rotated by `i · offset`, drawn as dashed arcs (`setLineDash`). Collapse = every ring to scale 0, then a hard cut to black.
- **Shatter → wordmark:** precompute shard polygons (wedges of the ball) and their target positions on the letters at load. Shard position = mix(burst(t), target, ease). The ball itself ends as the full stop.
- **HUD:** mono 26–30 px, all text inside y 250–1520. It's small on purpose: `check` lists it as small text, which is fine for a HUD. The timecode is `hh:mm:ss:ff` computed from `t`.
- **Sound:** 128 BPM isn't frame-exact at 30 fps; 128.57 BPM is (14 frames per beat). "A beat of silence" means automating the music bus to 0 for one beat before the shatter. The deep hit and shatter land on the wordmark frame.
