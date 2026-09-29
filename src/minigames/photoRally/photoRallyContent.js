// Builds one photo rally from already-loaded game data. Pure: the caller passes the
// stage, its kanji and monsters, so tests can feed the JSON files directly.
export const PHOTO_SHOTS = 10;
const NUMBERS = '一二三四五六七八九十';

const toHira = text => text.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKanjiChar = c => /[一-鿿々]/.test(c || '');

// The reading a kanji takes in its own example sentence, e.g. 「ひもを引（ひ）く。」→ ひ.
// Only readings that are clearly this kanji's (no kanji right before it) and that match
// its listed on/kun readings are used, so a data slip never teaches a wrong reading.
export function contextReading(kanji) {
  const sentence = kanji?.exampleSentence || kanji?.examples?.[0]?.sentence || '';
  if (!kanji?.kanji || !sentence) return null;
  const on = (kanji.onyomi || []).map(toHira), kun = (kanji.kunyomi || []).map(toHira);
  for (const match of sentence.matchAll(new RegExp(`${kanji.kanji}（([ぁ-んァ-ヶー]+)）`, 'g'))) {
    if (isKanjiChar(sentence[match.index - 1])) continue;
    const reading = toHira(match[1]);
    const known = on.includes(reading) || kun.some(item => item.replace(/[.・-]/g, '') === reading || item.split(/[.・-]/)[0] === reading);
    if (!known) continue;
    // 「十（とお）ぽん」「二（ふた）ほん」: a number read the native way before a counter
    // other than つ is a data slip (じっぽん, にほん). Skip these instead of teaching them.
    const rest = sentence.slice(match.index + match[0].length);
    if (NUMBERS.includes(kanji.kanji) && !on.includes(reading) && !rest.startsWith('つ')) continue;
    // The sentence is shown without the reading hint, with the kanji marked.
    const before = sentence.slice(0, match.index), after = sentence.slice(match.index + match[0].length);
    return Object.freeze({ reading: match[1], katakana: /^[ァ-ヶー]+$/.test(match[1]),
      before: before.replace(/（[^）]*）/g, ''), after: after.replace(/（[^）]*）/g, '') });
  }
  return null;
}

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new TypeError('random must return a finite value in [0, 1)');
  return value;
}
function shuffled(items, random) {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

// Checked kanji for a stage, the child's focus kanji first. Stages with few checked
// sentences borrow same-grade kanji so a run never runs short.
export function readingPool({ random = Math.random, stageKanji = [], gradeKanji = [], focusKanjiIds = [] }) {
  const usable = list => list.map(kanji => ({ kanji, context: contextReading(kanji) })).filter(item => item.context);
  const own = usable(stageKanji), seen = new Set(own.map(item => item.kanji.id));
  const extra = usable(gradeKanji.filter(kanji => !seen.has(kanji.id)));
  const focus = new Set(focusKanjiIds);
  const ordered = [...shuffled(own.filter(item => focus.has(item.kanji.id)), random),
    ...shuffled(own.filter(item => !focus.has(item.kanji.id)), random), ...shuffled(extra, random)];
  return { ordered, all: [...own, ...extra] };
}

// One four-choice reading question, or null when four same-script choices cannot be made.
export function readingQuestion({ kanji, context }, all, random, problemId) {
  // Wrong choices come from the same pool and the same script (ひらがな / カタカナ).
  const others = all.filter(item => item.kanji.id !== kanji.id && item.context.katakana === context.katakana &&
    toHira(item.context.reading) !== toHira(context.reading));
  const distinct = [];
  for (const item of shuffled(others, random)) {
    if (!distinct.some(text => toHira(text) === toHira(item.context.reading))) distinct.push(item.context.reading);
    if (distinct.length === 3) break;
  }
  if (distinct.length < 3) return null; // Four choices or none: a two-way guess teaches nothing.
  const choices = shuffled([context.reading, ...distinct], random).map((text, i) => Object.freeze({ choiceId: `${problemId}:choice:${i + 1}`, text }));
  return Object.freeze({ problemId, contentId: kanji.id, kanji: kanji.kanji, grade: kanji.grade,
    before: context.before, after: context.after, reading: context.reading,
    choices: Object.freeze(choices), correctChoiceId: choices.find(choice => choice.text === context.reading).choiceId,
    skillId: `kanji.reading.grade${kanji.grade}` });
}

export function buildPhotoRally({ sessionId, random = Math.random, stage, stageKanji = [], gradeKanji = [], monsters = [], focusKanjiIds = [] }) {
  if (!stage?.stageId) throw new TypeError('stage is required');
  const { ordered, all } = readingPool({ random, stageKanji, gradeKanji, focusKanjiIds });
  const cast = shuffled(monsters.filter(monster => monster?.id), random);
  const shots = [];
  for (const item of ordered) {
    if (shots.length >= Math.min(PHOTO_SHOTS, cast.length)) break;
    const index = shots.length, monster = cast[index];
    const question = readingQuestion(item, all, random, `${sessionId}:photo:${index + 1}:${item.kanji.id}`);
    if (!question) continue;
    shots.push(Object.freeze({ ...question,
      monsterId: monster.id, monsterName: monster.name, monsterImage: monster.imageUrl ?? null }));
  }
  return Object.freeze({ stage: Object.freeze({ stageId: stage.stageId, name: stage.name, region: stage.region, grade: stage.grade }),
    shots: Object.freeze(shots) });
}
