import { publish } from '../core/eventBus.js';

/** 画面を戻した後に、その場所で読める案内を表示する。 */
export function returnWithScreenNotice(target, detail) {
  publish('changeScreen', target);

  document.getElementById('screenRecoveryNotice')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'screenRecoveryNotice';
  overlay.className = 'screen-recovery-overlay';

  const panel = document.createElement('section');
  panel.className = 'screen-recovery-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'screenRecoveryHeading');

  const heading = document.createElement('h2');
  heading.id = 'screenRecoveryHeading';
  heading.textContent = '旅を ひらけませんでした';
  const message = document.createElement('p');
  message.textContent = detail;
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'わかった';
  close.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('keydown', event => {
    if (event.key === 'Escape') overlay.remove();
    if (event.key === 'Tab') event.preventDefault();
  });

  panel.append(heading, message, close);
  overlay.append(panel);
  document.body.append(overlay);
  close.focus();
}
