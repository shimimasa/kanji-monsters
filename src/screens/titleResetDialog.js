/** タイトルのデータ管理から開く、二段階の確認画面。 */
export function openTitleResetDialog(root, onApply) {
  if (!root || root.querySelector('#titleResetDialog')) return;

  const doc = root.ownerDocument;
  const previousFocus = doc.activeElement;
  const node = (tag, className, text) => {
    const result = doc.createElement(tag);
    if (className) result.className = className;
    if (text) result.textContent = text;
    return result;
  };
  const button = (text, action, className) => {
    const result = node('button', className, text);
    result.type = 'button';
    result.addEventListener('click', action);
    return result;
  };

  const overlay = node('div', 'yt-title-reset-overlay');
  overlay.id = 'titleResetDialog';
  const panel = node('section', 'yt-title-reset-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'titleResetHeading');
  const heading = node('h2', null, 'データを はじめからにする？');
  heading.id = 'titleResetHeading';
  const message = node('p', 'yt-title-reset-message', 'レベル、図鑑、ステージの進み具合など、今の記録が消えます。元には戻せません。先にバックアップを書き出してね。');
  const wordLabel = node('label', 'yt-title-reset-word-label', '続けるには「リセット」と入力してね');
  wordLabel.htmlFor = 'titleResetWord';
  const word = node('input', 'yt-title-reset-word');
  word.id = 'titleResetWord';
  word.type = 'text';
  word.autocomplete = 'off';
  word.autocapitalize = 'off';
  word.spellcheck = false;
  const actions = node('div', 'yt-title-reset-actions');
  const close = () => {
    overlay.remove();
    previousFocus?.focus?.();
  };
  const cancel = button('やめる', close, 'yt-title-reset-cancel');
  const continueButton = button('内容を確認した', () => showStep('word'));
  const apply = button('リセットする', async () => {
    if (busy || step !== 'word' || word.value !== 'リセット') return;
    busy = true;
    apply.disabled = true;
    showStep('working');
    try {
      await onApply();
      showStep('done');
    } catch (error) {
      console.error('データリセット処理中にエラーが発生しました:', error);
      showStep('error');
    }
  }, 'yt-title-reset-apply');
  const reload = button('タイトルへもどる', () => window.location.reload());
  const finish = button('とじる', close);
  let step = 'confirm';
  let busy = false;

  const showStep = next => {
    step = next;
    wordLabel.hidden = next !== 'word';
    word.hidden = next !== 'word';
    actions.replaceChildren();
    if (next === 'confirm') {
      heading.textContent = 'データを はじめからにする？';
      message.textContent = 'レベル、図鑑、ステージの進み具合など、今の記録が消えます。元には戻せません。先にバックアップを書き出してね。';
      actions.append(cancel, continueButton);
      cancel.focus();
    } else if (next === 'word') {
      heading.textContent = 'もう一度 たしかめてね';
      message.textContent = '「リセット」と入力してから、ボタンを押してね。';
      word.value = '';
      apply.disabled = true;
      actions.append(cancel, apply);
      word.focus();
    } else if (next === 'working') {
      heading.textContent = '記録を整理しています';
      message.textContent = '少し待ってね。';
    } else if (next === 'done') {
      heading.textContent = 'データをリセットしました';
      message.textContent = 'タイトルから、また遊べます。';
      actions.append(reload);
      reload.focus();
    } else {
      heading.textContent = '記録の整理が終わりませんでした';
      message.textContent = '残っている記録を おうちの人と たしかめてね。';
      actions.append(finish);
      finish.focus();
    }
  };
  word.addEventListener('input', () => { apply.disabled = word.value !== 'リセット'; });
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !busy) close();
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]):not([hidden])')];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  panel.append(heading, message, wordLabel, word, actions);
  overlay.append(panel);
  root.append(overlay);
  showStep('confirm');
}
