# Writing a style prompt, and the storyboard that comes out of it

The style prompts describe what the video looks like. The base block (in SKILL.md) tells Claude how to build it. Every new style follows the same six parts.

## Anatomy of a style prompt

| Part | What it does |
|---|---|
| Opening line | What it is, how long, which format. This line alone already makes a decent video. |
| IDEA | The one device that carries the whole film. One idea, not a feature list. |
| BEATS | One line per time range: what's on screen, what moves, the exact words. |
| LOOK | Background, palette with hex codes, type, texture. |
| MOTION | Where it's fast, where it holds, how scenes hand over. |
| SOUND | Tempo, instruments, and one sound for each action. |

Optional parts used by the presets: `TECH` (a rendering method that makes or breaks the look, e.g. "render at 135x240 and upscale nearest-neighbour") and `FRAME` (an overlay that persists across scenes, such as a HUD).

## Turning a loose brief into a style prompt

Users rarely arrive with all six parts ("bikin reels buat launch produk X", "something like the risograph one but for my coffee brand"). Fill the gaps yourself, then confirm through the storyboard rather than a questionnaire:

1. **The word or message.** Every preset ends on "MOTION", which is a placeholder. Use the user's word, brand or line; ask only if there's no way to infer it.
2. **Nearest preset.** Borrow LOOK, MOTION and SOUND from the closest of the seven. A new look still needs a palette with hex codes (3–4 colours), one texture idea, and a type choice.
3. **One IDEA.** A single device that survives every beat: one line, one ball, one grid, one drop of ink. If the idea needs "and" twice, cut it.
4. **5–6 BEATS** covering 0 → duration (under 10 s), each with a time range, what's on screen, what moves and exact words. The first beat must read with the sound off. The last beat lands the word and holds ≥ 1 s.
5. **MOTION:** name where it snaps, where it holds, and how scenes hand over (cut, wipe, match cut, morph; never a crossfade).
6. **SOUND:** a tempo, 2–3 instruments, and one sound for each visible action.

Save the result to `<project>/prompt.md` with the base block underneath, so the style can be remixed later.

### Skeleton

```text
A <N>-second vertical motion graphic <in the style of / that looks like ...>.

IDEA: <the single device that carries the film>. It ends on "<WORD>".

0-<a>s: <on screen>, <what moves>, <exact words if any>.
<a>-<b>s: ...
<b>-<c>s: ...
<c>-<d>s: ...
<d>-<N>s: <the word lands>. Hold.

LOOK: <background #hex>, <palette #hex #hex #hex>, <type>, <texture>. <what to avoid>.
MOTION: <where fast, where it holds, how scenes hand over>.
SOUND: <tempo> BPM <genre/instruments>. <one sound per action>. No narration.
```

## The storyboard (the gate before any building)

Show two things, then stop and wait for approval:

1. **Beat map**, one row per BEATS line:

   | Time | On screen | Motion | Sound hit |
   |---|---|---|---|
   | 0.0–1.2 s | off-black, white ground line, red ball | drops, 3 bounces with squash, floods red | wooden thud ×3, riser |
   | … | … | … | … |

2. **4 key stills** as PNGs, the four moments that define the film (usually the hook, the turn, the climax and the landing). Draw them with the real palette and type in `comp.html` as static frames, then `node <skill>/scripts/render.mjs stills comp.html --at t1,t2,t3,t4`. That writes `storyboard/still-*.png` and a side-by-side `storyboard/storyboard.png`.

Look at `storyboard.png` yourself before showing it. Approval of the stills is approval of the look; redirecting here costs one message instead of a rebuild.

## Remixing a preset

- Keep the style: LOOK, MOTION, SOUND and any TECH line stay word for word.
- Replace the IDEA and BEATS with the new concept, keeping the same number of beats and similar pacing.
- Swap "MOTION" and any credits ("MADE WITH CLAUDE") for the user's words.
- A palette swap is a one-line change in `PAL`; a concept change goes back through the storyboard.
