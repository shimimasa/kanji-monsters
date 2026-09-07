import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = relative => fs.readFileSync(new URL(`../../${relative}`, import.meta.url), 'utf8');

test('通常戦闘・練習・復習・学年クイズが共通の入力確定と学習結果保存を通る', () => {
  for (const file of [
    'src/screens/battleScreen.js',
    'src/screens/practiceBattleScreen.js',
    'src/screens/reviewStage.js',
    'src/screens/gradeQuizScreen.js',
  ]) {
    const source = read(file);
    assert.match(source, /bindInputSubmission/);
    assert.match(source, /commitLearningOutcome/);
    assert.doesNotMatch(source, /\brecordKanjiAnswer\s*\(/);
  }
});

test('50音パッドは疑似Enterを作らず共通送信イベントを発行する', () => {
  const source = read('src/ui/kanaPad.js');
  const submit = source.slice(source.indexOf('_submit()'), source.indexOf('_isInputVisible()'));
  assert.match(submit, /yomitabi:submit/);
  assert.doesNotMatch(submit, /new KeyboardEvent/);
});

test('戦闘離脱は管理タイマーと入力購読を破棄し、見えないタイトル戻り判定を持たない', () => {
  const source = read('src/screens/battleScreen.js');
  const exit = source.slice(source.indexOf('  exit() {'), source.indexOf('  registerHandlers()'));
  assert.match(exit, /this\._timeouts\.forEach/);
  assert.match(exit, /this\._answerSubmission\?\.dispose/);
  const click = source.slice(source.indexOf('handleClick(e)'), source.indexOf('// 「こうげき」ボタン'));
  assert.doesNotMatch(click, /isMouseOverRect\(x, y, BTN\.back\)/);
  assert.match(click, /isMouseOverRect\(x, y, BTN\.stage\)/);
});

test('通常練習の完了は自動で次問へ進まず、明示したEnterでのみ続ける', () => {
  const source = read('src/screens/practiceBattleScreen.js');
  const start = source.indexOf('\n_completePractice() {');
  const complete = source.slice(start, source.indexOf('\n_drawPracticeCompletePrompt() {', start));
  assert.match(complete, /practiceComplete = true/);
  assert.doesNotMatch(complete, /_pickNextReviewQuestion\(\)/);
  assert.match(source, /Enterで もう1もん/);
});

test('学年クイズは翌朝予定の誤答を「きょうの復習」と案内しない', () => {
  const source = read('src/screens/gradeQuizScreen.js');
  assert.doesNotMatch(source, /きょうのふくしゅう.*いれておいた/);
  assert.match(source, /つぎのふくしゅう/);
});
