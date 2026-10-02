import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GOTOMON_TYPES, TYPE_BEATS, matchup, typeOf, GAME_TYPES, FAVOURED_CHARGE } from '../../src/minigames/gotomonTypes.js';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { createCompanionPlay } from '../../src/minigames/companionPlay.js';

const data = file => JSON.parse(readFileSync(new URL(`../../public/data/${file}`, import.meta.url), 'utf8'));
const all = [...data('enemies_proto.json'), ...data('enemies_legend.json'), ...data('enemy_world.json')].flat(Infinity);

test('every Gotomon gets one of the seven types; the counts for the record', () => {
  const ids = new Set(GOTOMON_TYPES.map(type => type.id)), counts = {};
  for (const monster of all) { const type = typeOf(monster); assert.ok(ids.has(type), monster.id); counts[type] = (counts[type] ?? 0) + 1; }
  assert.ok(counts.food > 100 && counts.nature > 100 && counts.legend > 100, 'the big three stay big');
  assert.ok((counts.odd ?? 0) < 20, 'almost every category finds a type');
  assert.equal(typeOf(all.find(m => m.id === 'HKD-E01')), 'food', 'ジャガイモスライム (食文化)');
  assert.equal(typeOf(all.find(m => m.id === 'HKD-L01')), 'legend', 'オーロラスピリット (伝説)');
  assert.equal(typeOf({ id: 'x', category: '', desc: '山にすむ 鳥' }), 'nature', 'no category: read from the description');
  assert.equal(typeOf(null), 'odd');
  console.log(`types: ${all.length} records, ${JSON.stringify(counts)}`);
});

test('the wheel: each of six types beats the next, ふしぎ is even with all', () => {
  const ring = ['nature', 'food', 'fest', 'history', 'legend', 'craft'];
  ring.forEach((type, i) => assert.equal(TYPE_BEATS[type], ring[(i + 1) % ring.length]));
  assert.equal(matchup('nature', 'food'), 1.5); assert.equal(matchup('food', 'nature'), 1, 'only one way');
  assert.equal(matchup('odd', 'food'), 1); assert.equal(matchup('food', 'odd'), 1); assert.equal(matchup('food', 'food'), 1);
});

test('every mini-game has a favoured type, and that only fills the skill gauge sooner', () => {
  assert.deepEqual(Object.keys(GAME_TYPES).sort(), Object.keys(miniGameRegistry).sort());
  const run = favoured => {
    const play = createCompanionPlay('s', { gameId: 'gotomonPush', favoured });
    play.observe({ sessionId: 's', seq: 1, type: 'correct', payload: {} });
    return play.snapshot();
  };
  const plain = run(false), fav = run(true);
  assert.equal(fav.gauge, plain.gauge * FAVOURED_CHARGE); assert.equal(fav.favoured, true);
  assert.equal(fav.correct, plain.correct); assert.equal(fav.answered, plain.answered); assert.equal(fav.learningPoints, plain.learningPoints, 'learning is the same');
});

test('the battle hook is one marked line after the right-answer damage', () => {
  const battle = readFileSync(new URL('../../src/screens/battleScreen.js', import.meta.url), 'utf8');
  const marked = battle.split(/\r?\n/).filter(line => line.includes('// TYPE-MATCHUP'));
  assert.equal(marked.length, 2, 'the import and the call');
  const call = battle.indexOf('companionMatchup(dmg'), right = battle.lastIndexOf('commitLearningOutcome(gameState.currentKanji.id, true', call);
  const wrong = battle.indexOf('commitLearningOutcome(gameState.currentKanji.id, false');
  assert.ok(right > 0 && right < call && call < wrong, 'it runs on the right-answer path only');
});

test('in battle, a right answer hits 1.5 times as hard when the companion beats the enemy type, and says so', async () => {
  const { companionMatchup } = await import('../../src/minigames/battleMatchup.js');
  const potato = { name: 'ジャガイモスライム', type: 'food' };
  const fest = all.find(m => typeOf(m) === 'fest'), nature = all.find(m => typeOf(m) === 'nature');
  const log = [];
  assert.equal(companionMatchup(10, fest, log, { getCompanion: () => potato }), 15);
  assert.match(log[0], /ジャガイモスライム（たべもの）が まつりに つよい！ 1\.5ばい/);
  assert.equal(companionMatchup(10, nature, log, { getCompanion: () => potato }), 10, 'no bonus the other way');
  assert.equal(companionMatchup(10, fest, log, { getCompanion: () => null }), 10, 'no companion: as before');
  assert.equal(companionMatchup(10, fest, log, { getCompanion: () => { throw new Error('no save'); } }), 10, 'a failure never breaks the battle');
  assert.equal(log.length, 1);
});
