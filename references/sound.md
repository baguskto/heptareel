# Sound: synthesizing the soundtrack in code

1. How it fits together · 2. Locking hits to frames · 3. Instruments · 4. Foley · 5. Mixing and loudness

Everything is synthesized, so there's nothing to license and the soundtrack is identical every render.

## 1. How it fits together

- `renderAudio()` builds an `OfflineAudioContext(2, ceil(duration · 48000), 48000)`, routes a music bus and an sfx bus into a master → gentle compressor → destination, calls `score(...)`, and returns `startRendering()`. The preview player plays the same buffer.
- `score({ music, sfx, musicBus, sfxBus })` gets the same instrument kit twice, once per bus, so the music can be ducked or silenced (automate `musicBus.gain`) while hits keep playing.
- The kit (`makeKit` in the template) has `kick, snare, hat, click, thud, blip, bass, bell, pluck, riser, impact`, and the chiptune voices `pulse` (duty 0.125/0.25/0.5), `tri`, `chipNoise` (sample-and-hold), `crush` (bitcrushed burst), `arp`, `coin`, `boing`. It also has building blocks: `gain(t, peak, attack, decay, dest)`, `tone(type, f, t, dur, dest)`, `hiss(t, dur, dest)` (seeded noise), `filter(type, f, q, dest)`, and `verb` (a generated reverb you can route into).
- Seed every random source: noise comes from a pre-filled buffer made with `mulberry32`. `check` renders the soundtrack twice and warns if the two runs differ.

## 2. Locking hits to frames

- Every hit's time comes from `CUE` (snapped to frames). Write the score as "on `CUE.x`, play y", never as freshly typed numbers.
- Visual events that come from a schedule (strokes, typed characters, bounces, grid flips) get their times from the same function that animates them.
- For a beat grid, pick a frame-exact BPM (`1800 / bpm` whole: 100, 112.5, 120, 128.57, 150) and start the grid on a cue.
- "A beat of silence" means real silence: `musicBus.gain.setValueAtTime(0, t)` for the beat, then back to its level.
- Verify sync visually: `render.mjs video` (and `audio`) writes a waveform graph with a red line per `COMP.beats` entry. Each hit should start on its line; anything early or late is visible at a glance.
- Sounds that follow motion speed (pen scratch, quill, paper slide): schedule `gain.setValueAtTime(level(t_f), t_f)` once per frame `t_f` from the same speed function the visuals use.

## 3. Instruments

| Need | Recipe |
|---|---|
| Kick / sub hit | sine 150 → 45 Hz exponential pitch drop in 0.12 s, 0.35 s decay. Deep hit: add sine 80 → 32 Hz over 1 s. |
| Snare, brushed snare | bandpassed noise ~1.9 kHz + triangle 190 Hz blip. Brushed: noise with 30–60 ms attack and a longer 0.3 s tail, no tone. |
| Hats | highpassed noise > 7 kHz, 45 ms closed / 250 ms open. |
| Electronic bass | sawtooth through a lowpass (400–600 Hz) + a sine an octave down. |
| Upright / plucked bass | `pluck(t, f)` at 40–110 Hz; darken by lowpassing the result (~800 Hz). |
| Marimba | sine at f + sine at 4·f (quiet), 5 ms attack, 0.3–0.6 s decay; the upper partial decays faster. |
| Toy piano | sine at f + partials ×3.1 and ×5.9 (inharmonic, quiet), fast 0.4 s decay, slight detune. |
| Lute / harpsichord | `pluck(t, f)` (Karplus–Strong). For harpsichord, a brighter excitation (white noise) and a short 1 s decay; for lute, a softer excitation (noise lowpassed by averaging) and 2 s decay. Keep plucks under ~600 Hz or tune with a fractional delay. |
| Bell / chime | `bell(t, f)`: partials 1, 2.76, 5.4 with shorter decays up the series. |
| Ambient piano | 4–6 sine partials (1, 2, 3, 4.01, 5.02…) with 10 ms attack and 3–4 s release, sent heavily into `verb`. No drums. |
| Pad / swell | 3–4 detuned sawtooths through a lowpass whose cutoff rises with the swell, gain ramping over seconds. |
| Chiptune | in the kit: `pulse(t, f, dur, v, duty)` lead (duty 0.125/0.25/0.5), `tri` bass, `chipNoise` for drums (short hold = hat, long hold = snare/kick). |
| Arpeggio | `arp(t, rootHz, [0, 4, 7, 12], step)`: 16th- or 32nd-note pulse steps through a chord, rising. |
| Coin chime | `coin(t)`: square B5 (988 Hz) for 0.08 s, then E6 (1319 Hz) held. |
| Boing | `boing(t)`: sine 180 → 520 → 300 Hz over 0.3 s. |
| Bitcrushed burst | `crush(t, dur)`: 4-bit levels, each held 8 samples, fading out. |

## 4. Foley

| Sound | Recipe |
|---|---|
| Wooden thud | `thud(t)`: sine 210 → 70 Hz in 90 ms + a short low noise puff. |
| Click / key click | `click(t)`: 12 ms highpassed noise. Mechanical key: two clicks 25 ms apart, the second quieter. |
| Blade slice | noise through a bandpass sweeping 6 kHz → 1 kHz in 80 ms, plus a high sine ping. |
| Shatter | 20–40 tiny highpassed noise ticks scattered over 0.25 s (seeded times), plus an impact. |
| Riser | `riser(t, dur)`: noise bandpass sweep 300 → 6000 Hz with gain rising. |
| Pen / quill scratch | noise bandpassed 2–6 kHz with light amplitude flutter; gain follows drawing speed per frame. |
| Paper slide / rustle | noise bandpassed 800–3000 Hz, gain fluttering via `rand(i)` per 20 ms segment; length = slide duration. |
| Card thump | sine 90 Hz, 80 ms decay + lowpassed noise puff. |
| Flap whoosh | noise bandpass sweep 400 → 2500 Hz over 0.2 s, quick fade. |
| Accordion squeeze | two detuned sawtooths (a fifth apart) lowpassed at 1.5 kHz, 0.15 s attack, 6 Hz tremolo. |
| Rubber stamp thunk | kick-like sine 110 → 60 Hz + a damp click, no reverb. |
| Ink tap | soft sine 600 → 300 Hz, 40 ms. |
| Wooden creak | narrow bandpassed noise (Q 12) at 300–700 Hz with slow pitch drift over 0.3–0.6 s. |
| Wing flap | lowpassed noise puff (cutoff ~600 Hz) on each down-stroke. |
| Underwater plunk | sine 400 → 90 Hz in 120 ms through a lowpass at 800 Hz + 3–5 bubble chirps (sine 600 → 1400 Hz, 30 ms). |
| Muffled rumble | brown noise (integrated white noise) lowpassed at 120 Hz with a slow swell. |
| CRT hum | sine 60 Hz + 120 Hz + 180 Hz at very low level, constant. |
| Data chirps | rapid 15–30 ms square blips at `rand`-chosen pitches 800–3000 Hz. |
| Cascade of ticks | one tiny click per falling glyph landing, times from the fall schedule (cap at ~60 per second, slightly randomized gain). |

## 5. Mixing and loudness

- Mix for balance, not loudness: `render.mjs` normalizes the final soundtrack to −14 LUFS integrated with true peak under −1 dBTP. It peak-limits at 4× oversampling first when the mix is too peaky, then measures the AAC file again and pulls the level back if encoding overshot. It prints the measured result, which should read about −14 LUFS.
- Hard edges (square waves, sample-and-hold noise, bitcrush) ring after AAC encoding and push the true peak up. The kit's chip voices pass through a 7.5–8 kHz lowpass for that reason; do the same for any hard-edged buffer you generate yourself.
- Keep the music under the effects: hits are what sells "locked to the beat". A good start is music bus 0.5–0.7, foley 0.8–1.0.
- Duck the music briefly (−4 to −6 dB for 150 ms) under big impacts by automating its gain at those `CUE` times.
- Reverb: send melodic parts and big hits to `verb`, keep clicks and ticks dry.
- `node render.mjs audio comp.html` renders only the soundtrack (fast) while you iterate on the score.
