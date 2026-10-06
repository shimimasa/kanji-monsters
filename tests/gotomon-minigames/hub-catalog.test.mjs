import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { gameExperiences } from '../../src/minigames/gameExperiences.js';
import { HUB_SUBJECTS, NEWEST, hubSections, choiceSubjects, modeForSubject } from '../../src/minigames/hubCatalog.js';

const ids = Object.keys(miniGameRegistry);

test('ぜんぶ shows every game exactly once, in sections by subject and then the games with a choice', () => {
  const sections = hubSections('all');
  assert.deepEqual(sections.map(s => s.id), ['kanji', 'english', 'math', 'science', 'language', 'choose']);
  const shown = sections.flatMap(s => s.games);
  assert.equal(shown.length, ids.length);
  assert.deepEqual([...shown].sort(), [...ids].sort());
});

test('a subject tab shows its own games and the games that can be played in it', () => {
  for (const subject of ['kanji', 'english', 'math', 'science', 'language']) {
    const sections = hubSections(subject);
    const shown = sections.flatMap(s => s.games);
    assert.equal(new Set(shown).size, shown.length, subject);
    for (const id of shown) assert.ok(miniGameRegistry[id], `${subject}: ${id}`);
    const own = hubSections('all').find(s => s.id === subject).games;
    for (const id of own) assert.ok(shown.includes(id), `${subject} keeps ${id}`);
    for (const id of ids) if (choiceSubjects(id).includes(subject)) assert.ok(shown.includes(id), `${subject} offers ${id}`);
  }
  // ことば・社会 has no game with a choice; 英語 and 漢字 include the shooter, 算数 does not.
  assert.equal(hubSections('language').length, 1);
  assert.ok(hubSections('english').flatMap(s => s.games).includes('gotomonShooter'));
  assert.ok(!hubSections('math').flatMap(s => s.games).includes('gotomonShooter'));
});

test('opening a game from a subject tab starts it in that subject when it has the choice', () => {
  assert.equal(modeForSubject('gotomonGolf', 'math'), 'math');
  assert.equal(modeForSubject('gotomonShooter', 'kanji'), 'kanji');
  assert.equal(modeForSubject('gotomonShooter', 'math'), null);
  assert.equal(modeForSubject('mathSprint', 'math'), null, 'one-subject games keep their own start');
  assert.equal(modeForSubject('gotomonGolf', 'all'), null);
  // The hub's own lists of games with a 漢字/英語/算数 choice are the catalogue's.
  const hub = readFileSync(new URL('../../src/screens/miniGameHubScreen.js', import.meta.url), 'utf8');
  const listed = hub.match(/let mode = .*?\[(.*?)\]\.includes/)[1].match(/'(\w+)'/g).map(x => x.slice(1, -1));
  const threeWay = ids.filter(id => choiceSubjects(id).length === 3);
  assert.deepEqual([...listed].sort(), [...threeWay].sort());
});

test('tabs, NEW and genres line up with the games', () => {
  assert.deepEqual(HUB_SUBJECTS.map(s => s.id), ['all', 'kanji', 'english', 'math', 'science', 'language']);
  for (const id of NEWEST) assert.ok(miniGameRegistry[id], id);
  assert.ok(NEWEST.length <= 5);
  // Every game with a choice says so in its genre (漢字・英語・算数 or 英語・漢字).
  for (const id of ids) if (choiceSubjects(id).length) assert.match(gameExperiences[id].genre, /英語/, id);
});
