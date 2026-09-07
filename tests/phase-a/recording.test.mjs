import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { installStorage } from './storage-helper.mjs';
import { getDefaultSave, loadSave } from '../../src/core/saveData.js';
import * as state from '../../src/core/gameState.js';
for (const [hintLevel, revealed, category] of [[0,false,'independent'],[1,false,'hint1'],[2,false,'hint2'],[3,false,'hint3'],[4,true,'revealed'],[0,true,'revealed'],[undefined,false,'unknown']]) {
  test(`T04: observed support ${category} is recorded without relabelling legacy correct answers`, async () => {
    const old=getDefaultSave();old.player.study.answers={'g1-001':{correct:9,incorrect:2}};
    installStorage({krb_save:JSON.stringify(old)});await state.loadGameData();
    const question=state.beginQuestion('practice');
    const context={question,reading:'いち',hintLevel,answerRevealed:revealed};
    assert.equal(state.recordKanjiAnswer('g1-001',true,context),true);
    assert.equal(state.recordKanjiAnswer('g1-001',true,context),false);
    state.saveGameData();await state.loadGameData();
    const stats=state.gameState.kanjiAnswerStats['g1-001'];
    assert.equal(stats.correct,10);assert.equal(stats.observed.correct[category],1);
    assert.equal(Object.values(stats.observed.correct).reduce((a,b)=>a+b,0),1);
  });
}
test('T04: all answer sources retain their source and a repeated question is a new observation', async () => {
  installStorage({krb_save:JSON.stringify(getDefaultSave())});await state.loadGameData();
  for(const source of ['attack','heal','practice','quick-review','review','quiz']) {
    state.recordKanjiAnswer('g1-001',true,{question:state.beginQuestion(source),reading:'いち',hintLevel:0});
    assert.equal(state.gameState.kanjiAnswerStats['g1-001'].lastObservation.source,source);
  }
  assert.equal(state.gameState.kanjiAnswerStats['g1-001'].correct,6);
});
test('E10: stage clears add once per battle, preserving the old counter', async () => {
  const old=getDefaultSave();old.player.coreStats.stagesCleared=31;
  installStorage({krb_save:JSON.stringify(old)});await state.loadGameData();
  const run=state.beginQuestion('stage-clear');
  state.recordStageCleared(run);state.recordStageCleared(run);
  assert.equal(state.gameState.playerStats.stagesCleared,32);
  state.recordStageCleared(state.beginQuestion('stage-clear'));
  assert.equal(loadSave().player.coreStats.stagesCleared,33);
  const resultSource=fs.readFileSync(new URL('../../src/screens/resultWinScreen.js',import.meta.url),'utf8');
  assert.doesNotMatch(resultSource,/playerStats\.stagesCleared\+\+/);
});
