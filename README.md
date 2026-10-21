# heptareel

**Seven motion-reel styles, one prompt each, zero keyframes.**

An agent skill that turns Claude Code into a motion designer for vertical reels. You pick a style (or describe your own) and it:

1. storyboards the reel as a beat map + 4 key stills,
2. stops for your approval,
3. builds it as one HTML canvas file where every frame is `seek(t)`, a pure function of time,
4. synthesizes the music and every sound effect in code,
5. renders an MP4 (1080×1920, 30 fps, −14 LUFS), reviews its own contact sheet, fixes what's weak, and hands you the final.

No After Effects, no keyframes, nothing to license.

Based on the free tutorial **"Claude motion videos, step by step"** by **@janustiu**. Its seven prompts and its base block are included verbatim with credit (see [NOTICE.md](NOTICE.md)). This repo adds the render tooling, a starter composition, and build notes for implementing each style correctly.

## The seven styles

| # | Style | Motion feel | Sound | Level |
|---|---|---|---|---|
| 01 | One-line graph: one pen stroke that never lifts | Continuous | Marimba, pen scratch | Medium |
| 02 | One-ball showreel: five techniques, one red ball | Hard snaps, short holds | 128 BPM electronic | Easy |
| 03 | ASCII terminal: a 3D head made of characters | Smooth 3D in a rigid grid | Minimal techno, key clicks | Medium |
| 04 | Pixel dither: Game Boy palette, Bayer dithering | Stepped, on twos | 8-bit chiptune | Easy |
| 05 | Risograph cutout: two-ink paper stop motion | Stop motion on threes | Toy piano, paper foley | Medium |
| 06 | Renaissance codex: a quill-drawn machine takes flight | Hand rhythm, one fast flight | Lute, quill scratch | Hard |
| 07 | Ink in water: 30,000 particles bloom into a word | Slow motion, organic | Ambient piano, no drums | Hard |

Start with **pixel dither** or the **one-ball showreel**; they usually land in one or two rounds.

## Install

Claude Code, personal skill:

```bash
git clone https://github.com/baguskto/heptareel ~/.claude/skills/heptareel
node ~/.claude/skills/heptareel/scripts/render.mjs doctor --fix
```

`doctor --fix` checks Node 18+ and ffmpeg (installing ffmpeg with Homebrew on macOS if missing), and installs Playwright into `~/.cache/heptareel`. It uses your installed Google Chrome, or downloads Playwright's Chromium if you don't have Chrome.

The skill is a standard `SKILL.md` folder, so it also works with other agents that load skills from a directory.

## Use it

Just ask:

```
make a pixel dither reel that ends on the word SPROUT
bikin video motion gaya risograph buat launch kopi "Senja", 9 detik
do the one-ball showreel but in my brand colours #0B1F3A #F2C14E #FFFFFF
here's my storyboard idea for a 7s ink-in-water intro: ...
```

Then follow the loop:

| Step | You see | You do |
|---|---|---|
| Storyboard | beat map table + `storyboard/storyboard.png` | approve or redirect |
| Build + self-review | Claude renders, reads its own contact sheet, fixes weak beats | wait |
| Final | `renders/v1.mp4`, contact sheet, loudness line | watch on your phone, point at timestamps |
| Iterate | same file edited, `v2.mp4` | repeat until it's right |

Short, specific notes work best: *"at 3s only the top half is used, fill the frame"*, *"re-time the music so every hit lands on the frame"*, *"swap the palette to #…, keep everything else"*.

## The render tool

`scripts/render.mjs` is a single zero-config Node script:

| Command | What it does |
|---|---|
| `doctor [--fix]` | Checks or installs ffmpeg, Playwright and a browser |
| `check comp.html` | Fails if frames depend on render order, catches `Math.random`/clock use inside `seek()`, flags text under the Reels UI (top 250 px / bottom 400 px), measures palette coverage for strict-palette styles, and catches transparency and missing or unseeded audio |
| `stills comp.html --at …` | Storyboard stills + a side-by-side strip |
| `sheet comp.html` | Contact sheet, one frame per beat, safe-zone lines drawn |
| `audio comp.html` | Soundtrack only, loudness-normalized, plus a waveform graph with the beat lines |
| `video comp.html` | MP4 (H.264 + AAC, BT.709-tagged), −14 LUFS with true peak < −1 dBTP measured after encoding, plus a contact sheet, an audio sync graph and a summary; renders in parallel workers when it's worth it |

Canvas raster runs on the CPU by default, so every frame comes out identical regardless of seek order, worker or run. `--gpu` is faster for drafts.

## What's inside

```
SKILL.md                     workflow, base block, style picker (what the agent reads first)
assets/template.html         starter composition: seek(t) contract, helpers, synth kit, preview player
scripts/render.mjs           doctor / check / stills / sheet / audio / video
references/styles/01..07     the seven prompts (verbatim) + build notes per style
references/engine.md         purity, seeded randomness, baking simulations, techniques, text, fonts
references/sound.md          instrument and foley recipes, frame-exact tempo, mixing
references/fixes.md          what to say when it's off → what to change; before-you-post checklist
references/prompt-anatomy.md writing your own style prompt, the storyboard format, remixing
evals/evals.json             test prompts used to check the skill
```

## Bahasa Indonesia, singkat

Pasang dengan `git clone` di atas, jalankan `doctor --fix` sekali, lalu minta saja: *"bikin video motion gaya pixel dither, kata akhirnya NUSANTARA"*. Claude akan kirim storyboard dulu (beat map + 4 still). Setelah kamu setujui, baru dia bangun animasinya, bikin musiknya, render MP4, dan cek hasilnya sendiri. Revisi cukup sebut detiknya: *"di detik 3 terlalu kosong, penuhi layarnya"*.

## Credits

- Style prompts, base block, prompt anatomy, fixes and checklist: **@janustiu**, "Claude motion videos, step by step" (free tutorial). Tag them when you post what you make.
- Skill packaging, render tooling, template and build notes: this repo.
