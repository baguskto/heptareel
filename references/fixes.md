# Fixing it: what to say, what to change

The first render is rarely the final one. The user points at a timestamp and says what's wrong; edit the same `comp.html` (never start over), re-render, and re-check the contact sheet. Short, specific follow-ups beat rewriting the whole prompt.

| If you see this | Say this (from the tutorial) | What to change in the composition |
|---|---|---|
| Text is too small on a phone | Make all text at least 60px tall at 1080 wide. | Raise font sizes. `check` lists every string under 60 px; re-check the safe zone after enlarging. |
| Music doesn't hit the action | Re-time the soundtrack so every hit lands on the exact frame the motion lands. | Move each event into `CUE` (snapped) and have both the scene and the score read it. Use a frame-exact BPM or `snap()` the grid. |
| A scene feels empty | At 3s only the top half of the frame is used. Fill the frame. | Re-layout that scene: scale the hero element up, extend it vertically, add secondary elements in the same style. Look at that beat's contact-sheet cell. |
| The loop jumps | Make the first and last frame identical. | Make every motion periodic over `duration` (state at `t = duration` equals state at `t = 0`). Frames run 0…N−1, so the last rendered frame is one step before frame 0 and the loop is seamless. |
| Wrong colours | Swap the palette to [your hex codes]. Keep everything else. | Edit `PAL` only. Every colour must come from `PAL`; grep for stray hex values. |
| It looks too digital | Add grain, slight wobble on every line, and small frame-to-frame jitter. | Bake a grain texture and multiply it on; perlin wobble keyed to arc length; jitter by `rand(id, stepped frame)`; optionally animate on twos. |
| It's too long | Cut it to 6 seconds. Keep the ending. | Compress the middle beats' windows, keep the last beat intact, update `COMP.duration`, `CUE`, `COMP.beats` and the score. |
| You want a new concept | Keep the style. Replace the idea with [your idea] and redo the storyboard. | Keep LOOK/MOTION/SOUND and the engine; rewrite IDEA and BEATS; back to the storyboard gate. |

## Per-style "if it goes wrong"

| Style | Fix |
|---|---|
| 01 One-line graph | If the line breaks, say: "The line must be one unbroken path. Check every frame." |
| 02 One-ball showreel | One object in every shot is what makes it feel like a reel, not a list of effects. Keep the ball. |
| 03 ASCII terminal | If the head looks blurry, ask for a denser character grid, around 120 columns. |
| 04 Pixel dither | The best first test. Pixel art hides small flaws, so it usually works in one or two rounds. |
| 05 Risograph cutout | If it looks too clean and digital, ask for more ink misregistration and more frame-to-frame jitter. |
| 06 Renaissance codex | Expect 2 to 3 rounds on the hatching. Remind it of the drawing order: construction, outline, then hatching. |
| 07 Ink in water | The heaviest render. If the word doesn't read, ask for more of the particles to settle into the letters. |

## Before you post

- [ ] Watch it on your phone, not your laptop
- [ ] Check the first second works with the sound off
- [ ] Make sure no text sits under the Reels buttons
- [ ] Keep the prompt so you can remix the style later

Plus, from the render output: `check` passed with no ✗, loudness reads about −14 LUFS, and the file is 1080×1920 at 30 fps and under 10 s.
