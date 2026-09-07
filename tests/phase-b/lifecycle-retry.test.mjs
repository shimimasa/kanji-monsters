import test from 'node:test';
import assert from 'node:assert/strict';
import { createScreenLifecycle } from '../../src/core/screenLifecycle.js';
import { takeDueRetry } from '../../src/core/battleRetry.js';
import fs from 'node:fs';

test('画面離脱直後は予約処理も遅延Promise結果も反映しない', async () => {
  const life = createScreenLifecycle();
  life.activate();
  let timerCalls = 0;
  let asyncCalls = 0;
  life.setTimeout(() => timerCalls++, 0);
  const guarded = life.guard(() => asyncCalls++);
  life.deactivate();
  guarded();
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(timerCalls, 0);
  assert.equal(asyncCalls, 0);
});

test('戦闘内再出題は一時的な弱点候補外でも保持し、候補へ戻れば出る', () => {
  const queue = [{ id:'g1-001', waitTurns:0 }];
  const stagePool = [{id:'g1-001'}, {id:'g1-002'}];
  assert.equal(takeDueRetry(queue, [{id:'g1-002'}], stagePool), null);
  assert.equal(queue.length, 1);
  assert.equal(takeDueRetry(queue, [{id:'g1-001'}], stagePool)?.id, 'g1-001');
  assert.equal(queue.length, 0);
});

test('ステージ外の古い再出題予約だけを捨てる', () => {
  const queue = [{ id:'other-stage', waitTurns:0 }, { id:'g1-001', waitTurns:0 }];
  const selected = takeDueRetry(queue, [{id:'g1-001'}], [{id:'g1-001'}]);
  assert.equal(selected?.id, 'g1-001');
  assert.deepEqual(queue, []);
});

test('復習対象0件でも未解放ボーナスへ迂回せず、復習の空状態へ入る', () => {
  const source = fs.readFileSync(new URL('../../src/screens/stageSelectScreen.js', import.meta.url), 'utf8');
  const handle = source.indexOf('handleClick(e)');
  const start = source.indexOf('if (gameState.currentGrade === 0)', handle);
  const branch = source.slice(start, source.indexOf('} else {', start));
  assert.match(branch, /publish\('changeScreen','reviewStage'\)/);
  assert.doesNotMatch(branch, /publish\('changeScreen', 'stageLoading'\)/);
});
