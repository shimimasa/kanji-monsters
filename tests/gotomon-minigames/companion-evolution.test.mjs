import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { EVOLVED_IDS } from '../../src/minigames/evolvedIds.js';
import { lookProgress, wornLook, canEvolve, evolvedImageUrl, EVOLVE_LEVEL, validateCompanionLook } from '../../src/minigames/companionLooks.js';
import { XP_THRESHOLDS } from '../../src/minigames/companionGrowth.js';

const picture = id => new URL(`../../public${evolvedImageUrl(id)}`, import.meta.url);

test('every evolved Gotomon has its picture (a WebP), and is one of the chosen targets', () => {
  const targets = JSON.parse(readFileSync(new URL('../../scripts/evolution/targets.json', import.meta.url), 'utf8')).map(t => t.id);
  for (const id of EVOLVED_IDS) {
    assert.ok(existsSync(picture(id)), `${id} picture`);
    const head = readFileSync(picture(id)).subarray(0, 12).toString('latin1');
    assert.ok(head.startsWith('RIFF') && head.endsWith('WEBP'), `${id} is a WebP`);
    assert.ok(statSync(picture(id)).size > 1000);
    assert.ok(statSync(picture(id)).size < 100 * 1024, `${id} stays light like the originals (lossy WebP)`);
    assert.ok(targets.includes(id), `${id} is in targets.json`);
  }
  console.log(`evolved pictures: ${EVOLVED_IDS.length} (${EVOLVED_IDS.join(', ')})`);
});

test('しんか: only a Gotomon with a picture, from Lv5, and it can always go back', () => {
  assert.equal(lookProgress({ xp: 1520 }, 'NO-PICTURE').evolve, null, 'no picture: nothing to open');
  assert.equal(wornLook({ xp: 1520, look: { evolve: true } }, 'NO-PICTURE').evolve, false);
  validateCompanionLook({ evolve: true, shiny: false });
  if (!EVOLVED_IDS.length) return;
  const id = EVOLVED_IDS[0];
  assert.equal(canEvolve(id), true);
  assert.equal(lookProgress({ xp: XP_THRESHOLDS[EVOLVE_LEVEL - 2] }, id).evolve.unlocked, false, `Lv${EVOLVE_LEVEL - 1}`);
  assert.equal(lookProgress({ xp: XP_THRESHOLDS[EVOLVE_LEVEL - 1] }, id).evolve.unlocked, true, `Lv${EVOLVE_LEVEL}`);
  assert.equal(wornLook({ xp: XP_THRESHOLDS[EVOLVE_LEVEL - 1], look: { evolve: true } }, id).evolve, true);
  assert.equal(wornLook({ xp: XP_THRESHOLDS[EVOLVE_LEVEL - 1], look: { evolve: false } }, id).evolve, false, 'back to the first look');
});
