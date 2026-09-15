import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadBaseline,BASELINE } from '../../scripts/content-120-baseline.mjs';
import { validateSentence,validateTimed,validateMulti,validateAsync,validateDefense,seeded,normalizeOption } from '../../scripts/validate-content-120.mjs';
import { miniGameRegistry } from '../../src/minigames/registry.js';
import { KANJI_DEFENSE_GOLDEN_CONTENT as golden,KANJI_DEFENSE_LIMITED_UX_CONTENT as defense } from '../../src/minigames/kanjiDefense/kanjiDefenseContent.js';
const definitions=[['englishChoice','ENGLISH_CHOICE_FIXTURE'],['sentenceOrder','SENTENCE_ORDER_FIXTURE'],['timedChoice','TIMED_CHOICE_FIXTURE'],['multiSelect','MULTI_SELECT_FIXTURE'],['asyncChoice','ASYNC_CHOICE_FIXTURE']];
for(const [id,exportName] of definitions) test(`${id}: every old ID retained; only documented corrections differ`,async()=> {
  const file=`src/minigames/${id}/${id}Questions.js`,old=(await loadBaseline(file))[exportName];
  const current=(await import(`../../${file}`))[exportName];
  for(const previous of old) {
    const entry=current.find(q=>(q.id||q.fixtureId)===(previous.id||previous.fixtureId));assert.ok(entry);
    if(id==='sentenceOrder') {
      assert.equal(entry.prompt,previous.prompt);assert.equal(entry.skillId,previous.skillId);
      if(entry.fixtureId==='umbrella-rain')assert.equal(entry.chunks.map(c=>c.text).join(''),previous.chunks.map(c=>c.text).join(''));
    } else if((id==='asyncChoice'&&entry.fixtureId==='oxygen')||(id==='multiSelect'&&['spring','summer','autumn','winter'].includes(entry.fixtureId))) {
      assert.deepEqual({...entry,prompt:previous.prompt},previous);
    } else assert.deepEqual(entry,previous);
  }
});
for(const [id,validate] of Object.entries({sentence:validateSentence,timed:validateTimed,multi:validateMulti,async:validateAsync,defense:validateDefense}))
  test(`${id}: 120 records pass static/reference/runtime sampling gate`,()=>validate(120));
test('OLD CONTENT BASELINE golden24 and usable21 are unchanged, with exactly99 new defense records',async()=> {
  const old=await loadBaseline('src/minigames/kanjiDefense/kanjiDefenseContent.js');
  assert.deepEqual(golden,old.KANJI_DEFENSE_GOLDEN_CONTENT);
  assert.deepEqual(defense.slice(0,21),old.KANJI_DEFENSE_LIMITED_UX_CONTENT);
  assert.equal(defense.slice(21).length,99);
});
test('all eight Core/View files and gameplay/growth/logger boundaries unchanged',()=> {
  const ids=['mathSprint','mathInvader','englishChoice','sentenceOrder','timedChoice','multiSelect','asyncChoice','kanjiDefense'];
  const files=ids.flatMap(id=>[`src/minigames/${id}/${id}Game.js`,`src/minigames/${id}/${id}View.js`]);
  files.push('src/minigames/companionPlay.js','src/minigames/miniGameShell.js','src/minigames/gotomonService.js','src/minigames/scoreRank.js',
    'src/playtest/developmentLogger.js','src/core/saveData.js','src/audio/audioManager.js');
  for(const file of files) assert.equal(readFileSync(file,'utf8').replaceAll('\r\n','\n'),execFileSync('git',['show',`${BASELINE}:${file}`]).toString().replaceAll('\r\n','\n'),file);
});
test('both math games actually receive new within20 items',()=> {
  for(const id of ['mathSprint','mathInvader']) {
    let found=false;
    for(let seed=0;seed<50;seed++){const game=miniGameRegistry[id].create({sessionId:'new-math',random:seeded(seed)});game.enter();const q=game.snapshot().problem||game.snapshot().enemies[0];found ||= q.skillId.endsWith('within-20');game.exit();}
    assert.ok(found,id);
  }
});
test('all120 defense readings are accepted by actual Core, katakana and whitespace included',()=> {
  const seen=new Set();
  for(let seed=0;seed<6000&&seen.size<120;seed++) {
    const game=miniGameRegistry.kanjiDefense.create({sessionId:'defense-120',random:seeded(seed)});game.enter();
    const enemy=game.snapshot().enemies[0];
    if(!seen.has(enemy.fixtureId)) {
      const item=defense.find(q=>q.fixtureId===enemy.fixtureId);assert.ok(item);
      game.dispatch({type:'select',payload:{sessionId:'defense-120',enemyId:enemy.enemyId,problemId:enemy.problemId}});
      const target=game.snapshot().selectedEnemy;
      const value=[...item.acceptedReadings[0]].map(c=>String.fromCodePoint(c.codePointAt(0)+0x60)).join(' ');
      const command={type:'submit',payload:{sessionId:'defense-120',enemyId:target.enemyId,problemId:target.problemId,attemptId:target.attemptId,token:target.token,value:`　${value}　`}};
      assert.equal(game.dispatch(command),true,item.prompt);assert.equal(game.snapshot().correct,1,item.prompt);assert.equal(game.dispatch(command),false);
      seen.add(enemy.fixtureId);
    }
    game.exit();
  }
  assert.equal(seen.size,120);
});
test('defense completes twelve new-bank encounters with default rules',()=> {
  const game=miniGameRegistry.kanjiDefense.create({sessionId:'finish-120',random:seeded(91)});game.enter();
  for(let i=0;i<12;i++) {
    if(!game.snapshot().enemies.length)game.update(game.snapshot().rules.emptySpawnDelayMs);
    const enemy=game.snapshot().enemies[0];game.dispatch({type:'select',payload:{sessionId:'finish-120',enemyId:enemy.enemyId,problemId:enemy.problemId}});
    const target=game.snapshot().selectedEnemy;
    game.dispatch({type:'submit',payload:{sessionId:'finish-120',enemyId:target.enemyId,problemId:target.problemId,attemptId:target.attemptId,token:target.token,value:defense.find(q=>q.fixtureId===target.fixtureId).acceptedReadings[0]}});
  }
  assert.ok(game.snapshot().result);assert.equal(game.snapshot().correct,12);game.exit();
});
test('symbol answers retain semantic distinctions under option normalization',()=> {
  assert.equal(new Set(['。','、','？','！'].map(normalizeOption)).size,4);
  assert.equal(normalizeOption(' Ａ '),normalizeOption('A'));
});
