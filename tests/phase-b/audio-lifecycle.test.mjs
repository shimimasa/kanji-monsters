import test from 'node:test';
import assert from 'node:assert/strict';
import { installStorage } from '../phase-a/storage-helper.mjs';

test('古いBGMのフェード完了が新しい戦闘BGMを停止しない', async () => {
  installStorage();
  const instances = [];
  globalThis.Audio = class {
    constructor() { this.dataset={}; this.paused=true; this.volume=1; this.currentTime=0; instances.push(this); }
    play() { this.paused=false; return Promise.resolve(); }
    pause() { this.paused=true; }
  };
  globalThis.document = { createElement: () => ({ canPlayType: () => 'probably' }) };
  globalThis.requestAnimationFrame = callback => { callback(); return 1; };
  const { AudioManager } = await import('../../src/audio/audioManager.js');
  const audio = new AudioManager();
  audio.playBGM('gameover');
  await Promise.resolve();
  const stopping = audio.stopBGM(0.2);
  audio.playBGM('battle');
  await stopping;
  assert.equal(instances[0].paused, true);
  assert.equal(instances.at(-1).dataset.key, 'battle');
  assert.equal(instances.at(-1).paused, false);
});
