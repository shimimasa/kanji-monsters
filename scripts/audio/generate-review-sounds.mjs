// Original, deterministic sound assets for the sound and visual review.
// Run with Node, then encode the WAV files to mp3/m4a/ogg with ffmpeg.
import { mkdirSync, writeFileSync } from 'node:fs';

const rate = 44100;
const output = 'public/assets/audio';
mkdirSync(output, { recursive: true });

function render(name, duration, notes) {
  const samples = Math.ceil(duration * rate);
  const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF', 0);
  data.writeUInt32LE(data.length - 8, 4);
  data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write('data', 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / rate;
    let value = 0;
    for (const n of notes) {
      const local = t - n.at;
      if (local < 0 || local >= n.length) continue;
      const fadeIn = Math.min(1, local / (n.attack ?? 0.008));
      const fadeOut = Math.pow(Math.max(0, 1 - local / n.length), n.decay ?? 2);
      const f = n.from && n.to ? n.from + (n.to - n.from) * local / n.length : n.freq;
      const phase = 2 * Math.PI * f * local;
      const tone = Math.sin(phase) + 0.18 * Math.sin(phase * 2) + 0.05 * Math.sin(phase * 3);
      value += tone * (n.gain ?? 0.3) * fadeIn * fadeOut;
    }
    data.writeInt16LE(Math.round(Math.max(-0.95, Math.min(0.95, value)) * 32767), 44 + i * 2);
  }
  writeFileSync(`${output}/${name}.wav`, data);
}

render('se_tap', 0.10, [{ at: 0, length: 0.09, freq: 660, gain: 0.22, decay: 3 }]);
render('se_cancel', 0.20, [{ at: 0, length: 0.18, from: 440, to: 330, gain: 0.27, decay: 2.2 }]);
render('se_near_miss', 0.42, [
  { at: 0, length: 0.25, freq: 523.25, gain: 0.20 },
  { at: 0.13, length: 0.27, freq: 659.25, gain: 0.20 },
]);
render('se_capture', 1.25, [
  { at: 0, length: 0.42, freq: 523.25, gain: 0.20 },
  { at: 0.20, length: 0.42, freq: 659.25, gain: 0.20 },
  { at: 0.40, length: 0.42, freq: 783.99, gain: 0.20 },
  { at: 0.62, length: 0.60, freq: 1046.5, gain: 0.25, decay: 1.5 },
]);
render('se_stage_clear', 1.65, [
  { at: 0, length: 0.30, freq: 392, gain: 0.19 },
  { at: 0.22, length: 0.30, freq: 523.25, gain: 0.19 },
  { at: 0.44, length: 0.30, freq: 659.25, gain: 0.19 },
  { at: 0.67, length: 0.94, freq: 783.99, gain: 0.23, decay: 1.2 },
  { at: 0.67, length: 0.94, freq: 523.25, gain: 0.12, decay: 1.2 },
]);
render('se_achievement', 0.95, [
  { at: 0, length: 0.36, freq: 783.99, gain: 0.16 },
  { at: 0.14, length: 0.38, freq: 987.77, gain: 0.17 },
  { at: 0.28, length: 0.60, freq: 1174.66, gain: 0.20, decay: 1.3 },
]);
render('se_hint', 0.27, [
  { at: 0, length: 0.13, freq: 783.99, gain: 0.17, decay: 2 },
  { at: 0.09, length: 0.16, freq: 1046.5, gain: 0.20, decay: 2 },
]);
render('se_evolve', 1.35, [
  { at: 0, length: 0.35, from: 392, to: 523.25, gain: 0.15 },
  { at: 0.20, length: 0.35, from: 523.25, to: 659.25, gain: 0.16 },
  { at: 0.40, length: 0.35, from: 659.25, to: 783.99, gain: 0.17 },
  { at: 0.64, length: 0.68, freq: 1046.5, gain: 0.22, decay: 1.4 },
  { at: 0.64, length: 0.68, freq: 783.99, gain: 0.12, decay: 1.4 },
]);
render('se_reward', 0.52, [
  { at: 0, length: 0.27, freq: 659.25, gain: 0.17 },
  { at: 0.15, length: 0.34, freq: 880, gain: 0.19, decay: 1.5 },
]);
render('se_shield_break', 0.34, [
  { at: 0, length: 0.12, from: 1800, to: 1400, gain: 0.18, decay: 3 },
  { at: 0.035, length: 0.16, from: 1200, to: 700, gain: 0.16, decay: 3 },
  { at: 0.10, length: 0.21, from: 850, to: 420, gain: 0.12, decay: 2.5 },
]);

render('se_mini_shot', 0.17, [{ at: 0, length: 0.16, from: 880, to: 440, gain: 0.20, decay: 2.6 }]);
render('se_mini_whoosh', 0.23, [{ at: 0, length: 0.22, from: 320, to: 920, gain: 0.18, decay: 1.8 }]);
render('se_mini_hop', 0.21, [{ at: 0, length: 0.20, from: 390, to: 690, gain: 0.17, decay: 1.9 }]);
render('se_mini_pop', 0.12, [{ at: 0, length: 0.11, from: 650, to: 890, gain: 0.16, decay: 3 }]);
render('se_mini_move', 0.10, [{ at: 0, length: 0.09, from: 330, to: 440, gain: 0.11, decay: 3 }]);
render('se_mini_pickup', 0.29, [
  { at: 0, length: 0.16, freq: 783.99, gain: 0.14, decay: 2 },
  { at: 0.10, length: 0.17, freq: 1046.5, gain: 0.15, decay: 2 },
]);

// Two short loops. The quiet final half-second lets either loop return to beat one cleanly.
const chord = (notes, at, length, gain = 0.055) => notes.map(freq => ({ at, length, freq, gain, attack: 0.035, decay: 0.55 }));
const melody = (frequencies, step, gain = 0.12) => frequencies.map((freq, i) => ({ at: i * step, length: step * 0.88, freq, gain, decay: 1.4 }));
render('bgm_minigame_hub', 8, [
  ...chord([261.63, 329.63, 392], 0, 1.9),
  ...chord([293.66, 349.23, 440], 2, 1.9),
  ...chord([329.63, 392, 493.88], 4, 1.9),
  ...chord([261.63, 349.23, 440], 6, 1.45),
  ...melody([523.25, 587.33, 659.25, 587.33, 698.46, 659.25, 587.33, 523.25,
    659.25, 783.99, 880, 783.99, 698.46, 659.25, 587.33, 523.25], 0.5),
]);
render('bgm_minigame_play', 8, [
  ...chord([261.63, 329.63, 392], 0, 1.9, 0.045),
  ...chord([220, 261.63, 349.23], 2, 1.9, 0.045),
  ...chord([293.66, 392, 493.88], 4, 1.9, 0.045),
  ...chord([196, 261.63, 392], 6, 1.45, 0.045),
  ...melody([523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880, 698.46,
    659.25, 783.99, 987.77, 783.99, 698.46, 587.33, 523.25, 392], 0.5, 0.1),
]);

render('bgm_minigame_action', 8, [
  ...chord([196, 261.63, 392], 0, 1.85, 0.047),
  ...chord([220, 293.66, 440], 2, 1.85, 0.047),
  ...chord([246.94, 329.63, 493.88], 4, 1.85, 0.047),
  ...chord([196, 293.66, 392], 6, 1.42, 0.047),
  ...melody([392, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 698.46,
    783.99, 659.25, 880, 783.99, 698.46, 587.33, 523.25, 392], 0.5, 0.11),
]);
render('bgm_minigame_puzzle', 8, [
  ...chord([261.63, 329.63, 392], 0, 1.85, 0.04),
  ...chord([246.94, 329.63, 392], 2, 1.85, 0.04),
  ...chord([220, 293.66, 392], 4, 1.85, 0.04),
  ...chord([261.63, 349.23, 440], 6, 1.42, 0.04),
  ...melody([523.25, 659.25, 587.33, 523.25, 493.88, 587.33, 659.25, 587.33,
    440, 523.25, 587.33, 698.46, 659.25, 587.33, 523.25, 440], 0.5, 0.085),
]);
render('bgm_minigame_relaxed', 8, [
  ...chord([261.63, 329.63, 392], 0, 1.85, 0.038),
  ...chord([220, 261.63, 349.23], 2, 1.85, 0.038),
  ...chord([196, 261.63, 329.63], 4, 1.85, 0.038),
  ...chord([261.63, 329.63, 392], 6, 1.42, 0.038),
  ...melody([392, 440, 523.25, 440, 392, 349.23, 329.63, 392,
    440, 523.25, 587.33, 523.25, 440, 392, 349.23, 329.63], 0.5, 0.07),
]);
