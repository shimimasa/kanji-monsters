import { MATH_CONTENT } from '../src/minigames/mathSprint/mathContent.js';
import { generateSessionProblems } from '../src/minigames/mathSprint/mathSprintGenerator.js';
import { ENGLISH_CHOICE_FIXTURE,generateEnglishChoiceQuestions } from '../src/minigames/englishChoice/englishChoiceQuestions.js';
import { englishCategory } from '../src/minigames/englishChoice/englishContent.js';
import { SENTENCE_ORDER_FIXTURE,generateSentenceOrderQuestions } from '../src/minigames/sentenceOrder/sentenceOrderQuestions.js';
import { TIMED_CHOICE_FIXTURE,generateTimedChoiceQuestions } from '../src/minigames/timedChoice/timedChoiceQuestions.js';
import { TIMED_CONTENT_ADDITIONS } from '../src/minigames/timedChoice/timedContent.js';
import { MULTI_SELECT_FIXTURE,generateMultiSelectQuestions } from '../src/minigames/multiSelect/multiSelectQuestions.js';
import { ASYNC_CHOICE_FIXTURE,prepareAsyncChoiceQuestions } from '../src/minigames/asyncChoice/asyncChoiceQuestions.js';
import { KANJI_DEFENSE_LIMITED_UX_CONTENT,buildKanjiDefenseSession } from '../src/minigames/kanjiDefense/kanjiDefenseContent.js';
import { loadBaseline } from './content-120-baseline.mjs';
export const banks={
  math:{items:MATH_CONTENT,generate:generateSessionProblems,id:q=>q.fixtureId,gameIds:['mathSprint','mathInvader']},
  english:{items:ENGLISH_CHOICE_FIXTURE,generate:generateEnglishChoiceQuestions,id:q=>q.correctChoiceId.slice(8),gameIds:['englishChoice']},
  sentence:{items:SENTENCE_ORDER_FIXTURE,generate:generateSentenceOrderQuestions,id:q=>q.fixtureId,gameIds:['sentenceOrder']},
  timed:{items:TIMED_CHOICE_FIXTURE,generate:generateTimedChoiceQuestions,id:q=>q.fixtureId,gameIds:['timedChoice']},
  multi:{items:MULTI_SELECT_FIXTURE,generate:generateMultiSelectQuestions,id:q=>q.fixtureId,gameIds:['multiSelect']},
  async:{items:ASYNC_CHOICE_FIXTURE,generate:args=>prepareAsyncChoiceQuestions({...args,fixture:ASYNC_CHOICE_FIXTURE}),id:q=>q.fixtureId,gameIds:['asyncChoice']},
  defense:{items:KANJI_DEFENSE_LIMITED_UX_CONTENT,generate:buildKanjiDefenseSession,id:q=>q.content.fixtureId,gameIds:['kanjiDefense']},
};
export const itemId=q=>q.fixtureId||q.id;
export async function oldItems(key) {
  const old=await loadBaseline(`src/minigames/${banks[key].gameIds[0]}/${banks[key].gameIds[0]}${key==='defense'?'Content':'Questions'}.js`);
  const names={english:'ENGLISH_CHOICE_FIXTURE',sentence:'SENTENCE_ORDER_FIXTURE',timed:'TIMED_CHOICE_FIXTURE',multi:'MULTI_SELECT_FIXTURE',async:'ASYNC_CHOICE_FIXTURE',defense:'KANJI_DEFENSE_LIMITED_UX_CONTENT'};
  return old[names[key]];
}
export function category(key,q) {
  if(key==='math')return q.operation;
  if(key==='english')return englishCategory(q.prompt);
  if(key==='timed')return TIMED_CONTENT_ADDITIONS.find(x=>x.fixtureId===q.fixtureId)?.category||'everyday-recognition';
  if(key==='sentence')return /ため|ように/.test(q.chunks[1].text)?'目的・依存関係':q.chunks[1].text.endsWith('か')?'名詞節・問い':'連体修飾・接続';
  if(key==='defense')return /[ぁ-ゖ]/u.test(q.prompt)?'送り仮名':'漢字語入力';
  return q.skillId;
}
const challenge={
  english:new Set(['dictionary','butterfly','breakfast','classroom']),
  timed:new Set(['kouwan','boueki','yushutsu','yunyuu','kisyou','sekisetsu']),
  multi:new Set(['mollusks','crustaceans','dicots','monocots','sedimentary','igneous','minerals','constant-temperature','superlatives']),
  async:new Set(['mode','water-formula','stomata','reflection','prime-meridian','equator','executive','judiciary','square-meter','adjectival-quiet']),
  defense:new Set(['祝賀','鏡台','城下町','博物館','炊飯']),
};
export function difficulty(key,q,existing) {
  if(key==='math')return q.difficulty;
  if(challenge[key]?.has(key==='defense'?q.prompt:itemId(q)))return 'challenge';
  if(key==='sentence')return q.chunks.map(c=>c.text).join('').length<20?'easy':'standard';
  return existing&&['english','timed'].includes(key)?'easy':'standard';
}
export function question(key,q) {
  if(key==='math')return `${q.a} ${q.operation==='addition'?'+':'−'} ${q.b}`;
  if(key==='sentence')return q.chunks.map(c=>c.text).join('／');
  return q.word||q.prompt;
}
export function answer(key,q) {
  if(key==='math')return String(q.answer);
  if(key==='english')return q.meaning;
  if(key==='sentence')return q.chunks.map(c=>c.text).join('');
  if(key==='timed')return q.reading;
  if(key==='defense')return q.acceptedReadings.join(' / ');
  const ids=q.correctChoiceIds||[q.correctChoiceId];return q.choices.filter(c=>ids.includes(c.choiceId)).map(c=>c.text).join(' / ');
}
