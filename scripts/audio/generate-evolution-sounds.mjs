// Original sounds for the evolution room. No external audio samples or npm packages.
// Usage: node scripts/audio/generate-evolution-sounds.mjs [path-to-ffmpeg]
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ffmpeg = process.argv[2] || 'ffmpeg';
const rate = 44100;
const out = 'public/assets/audio';
const work = mkdtempSync(join(tmpdir(), 'yomitabi-evolution-'));
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
const note = (at, length, pitch, gain = 0.12, voice = 'bell') => ({ at, length, pitch, gain, voice });

function writeWav(path, duration, notes) {
  const samples = Math.ceil(duration * rate);
  const pcm = new Float32Array(samples);
  for (const n of notes) {
    const start = Math.floor(n.at * rate), count = Math.floor(n.length * rate);
    for (let j = 0; j < count && start + j < samples; j++) {
      const t = j / rate, p = t / n.length;
      const attack = Math.min(1, t / (n.voice === 'pad' ? 0.12 : 0.008));
      const envelope = attack * (n.voice === 'pad' ? Math.sin(Math.PI * p) ** 0.8 : (1 - p) ** 2);
      const phase = 2 * Math.PI * hz(n.pitch) * t;
      const tone = n.voice === 'pad'
        ? Math.sin(phase) + 0.22 * Math.sin(phase * 2)
        : Math.sin(phase) + 0.26 * Math.sin(phase * 2) + 0.11 * Math.sin(phase * 3);
      pcm[start + j] += n.gain * envelope * tone;
    }
  }
  const data = Buffer.alloc(44 + samples * 2);
  data.write('RIFF', 0); data.writeUInt32LE(data.length - 8, 4);
  data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    data.writeInt16LE(Math.round(Math.max(-0.92, Math.min(0.92, pcm[i])) * 32767), 44 + i * 2);
  }
  writeFileSync(path, data);
}

// A rising pulse in C major, followed by a warm held chord. The cadence is original.
const music = [];
for (const [at, pitches] of [[0, [48, 55, 60]], [0.9, [50, 57, 62]], [1.8, [52, 59, 64]], [2.7, [53, 60, 65]]]) {
  pitches.forEach(p => music.push(note(at, 1.02, p, 0.035, 'pad')));
}
[60, 64, 67, 72, 64, 67, 72, 76, 67, 72, 76, 79, 72, 76, 79, 84].forEach((p, i) => {
  music.push(note(i * 0.22, 0.27, p, 0.075));
});
[60, 64, 67, 72].forEach(p => music.push(note(3.55, 1.0, p, 0.052, 'pad')));

const sounds = [
  ['bgm_evolution', 4.7, music],
  ['se_evolution_glimmer', 0.64, [
    note(0, 0.22, 72, 0.12), note(0.13, 0.22, 76, 0.12),
    note(0.26, 0.32, 79, 0.13), note(0.38, 0.23, 84, 0.10),
  ]],
  ['se_evolution_reveal', 1.18, [
    note(0, 0.75, 60, 0.13, 'pad'), note(0, 0.75, 67, 0.13, 'pad'),
    note(0.04, 0.39, 72, 0.16), note(0.17, 0.43, 76, 0.16),
    note(0.34, 0.73, 79, 0.17), note(0.34, 0.73, 84, 0.12),
  ]],
];

try {
  for (const [name, duration, notes] of sounds) {
    const wav = join(work, `${name}.wav`);
    writeWav(wav, duration, notes);
    for (const [ext, codec] of [['mp3', 'libmp3lame'], ['m4a', 'aac'], ['ogg', 'libopus']]) {
      const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav,
        '-c:a', codec, '-b:a', '96k', `${out}/${name}.${ext}`], { encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`${name}.${ext}: ${result.stderr || result.error}`);
    }
    console.log(`${name}: ${duration}s, mp3/m4a/ogg`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
