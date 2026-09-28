import test from 'node:test';
import assert from 'node:assert/strict';
import { notebookContext } from '../../src/minigames/learningNotebook.js';
test('notebook return state preserves supported game, literal query and expanded correct list',()=>{
  for(const gameId of ['englishChoice','timedChoice','sentenceOrder']){
    const result=notebookContext({gameId,query:' 屋根 ４ピース ',correctOpen:true,history:{secret:1}});
    assert.deepEqual(result,{gameId,query:' 屋根 ４ピース ',correctOpen:true});assert.ok(Object.isFrozen(result));
  }
});
test('invalid notebook destinations are ignored and optional values are bounded',()=>{
  for(const value of [null,undefined,{},'englishChoice',{gameId:'mathSprint'},{gameId:'__proto__'}])assert.equal(notebookContext(value),null);
  assert.deepEqual(notebookContext({gameId:'timedChoice',query:123,correctOpen:'true'}),{gameId:'timedChoice',query:'',correctOpen:false});
  assert.equal(notebookContext({gameId:'sentenceOrder',query:'a'.repeat(500)}).query.length,100);
});
