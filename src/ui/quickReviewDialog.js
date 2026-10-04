// Screen-owned guidance for finishing a short review, without browser dialogs.
export function openQuickReviewDialog({ title, detail, onMore, onDone }) {
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title);
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '10000', display: 'grid', placeItems: 'center',
    padding: '20px', background: 'rgba(7, 24, 40, .82)',
  });
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    width: 'min(100%, 440px)', boxSizing: 'border-box', padding: '24px', borderRadius: '18px',
    border: '3px solid #94e4d9', background: '#173d54', color: '#fff', textAlign: 'center',
    fontFamily: '"UDデジタル教科書体", sans-serif', boxShadow: '0 16px 35px #071827',
  });
  const heading = document.createElement('h2');
  heading.textContent = title;
  heading.style.margin = '0 0 14px';
  const description = document.createElement('p');
  description.textContent = detail;
  Object.assign(description.style, { margin: '0 0 20px', fontSize: '18px', lineHeight: '1.6', overflowWrap: 'anywhere' });
  const buttons = document.createElement('div');
  Object.assign(buttons.style, { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' });
  const close = () => overlay.remove();
  const makeButton = (label, action, color) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    Object.assign(button.style, {
      minHeight: '48px', flex: '1 1 160px', border: '0', borderRadius: '10px',
      padding: '8px 12px', background: color, color: '#082c3b', font: 'bold 18px "UDデジタル教科書体", sans-serif',
      cursor: 'pointer',
    });
    button.onclick = () => { close(); action(); };
    buttons.append(button);
    return button;
  };
  const more = onMore ? makeButton('もう1もん', onMore, '#b8f4df') : null;
  const done = makeButton('ちずへ もどる', onDone, '#ffdf9b');
  panel.append(heading, description, buttons);
  overlay.append(panel);
  document.body.append(overlay);
  (more || done).focus();
  return close;
}
