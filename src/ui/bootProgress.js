export function showBootProgress() {
    let el = document.getElementById('bootProgress');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'bootProgress';
    Object.assign(el.style, {
      position: 'fixed', inset: 0, background: '#2c1810',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100000
    });
    const wrap = document.createElement('div');
    Object.assign(wrap.style, { width: '60%', maxWidth: '520px' });
    const bar = document.createElement('div');
    Object.assign(bar.style, { height: '12px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden' });
    const fill = document.createElement('div');
    fill.id = 'bootProgressFill';
    Object.assign(fill.style, { width: '0%', height: '100%', background: 'linear-gradient(90deg,#28a745,#20c997)' });
    const label = document.createElement('div');
    label.id = 'bootProgressLabel';
    Object.assign(label.style, { color: '#fff', marginTop: '8px', fontSize: '14px', textAlign: 'center' });
    bar.appendChild(fill);
    wrap.appendChild(bar);
    wrap.appendChild(label);
    el.appendChild(wrap);
    document.body.appendChild(el);
    return el;
  }
  
  export function updateBootProgress(done, total, phaseLabel = '') {
    const fill = document.getElementById('bootProgressFill');
    const label = document.getElementById('bootProgressLabel');
    const pct = total > 0 ? Math.floor((done / total) * 100) : 0;
    if (fill) fill.style.width = `${pct}%`;
    if (label) label.textContent = phaseLabel ? `${phaseLabel} ${pct}%` : `${pct}%`;
  }
  
export function hideBootProgress() {
    const el = document.getElementById('bootProgress');
    if (el) el.remove();
  }

export function showBootError(message = 'データを読み込めませんでした。', { retry = () => location.reload(), back = null, recover = null } = {}) {
  const el = showBootProgress();
  const wrap = el.firstElementChild;
  wrap.replaceChildren();
  const label = document.createElement('p');
  label.textContent = message;
  Object.assign(label.style, { color: '#fff', fontSize: '18px', lineHeight: '1.7', textAlign: 'center' });
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'もういちど 読みこむ';
  Object.assign(button.style, {
    display: 'block', margin: '20px auto 0', minHeight: '48px', padding: '10px 20px',
    border: '2px solid #D2B48C', borderRadius: '8px', background: '#8B4513',
    color: '#fff', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
  });
  button.addEventListener('click', retry);
  wrap.append(label, button);
  for (const [text, action] of [['もどる',back],['クラウドの記録から復元する',recover]]) {
    if (!action) continue;
    const control = document.createElement('button');
    control.type = 'button'; control.textContent = text;
    control.style.cssText = button.style.cssText;
    control.addEventListener('click', async () => {
      control.disabled = true;
      try { await action(); }
      catch { if (el.isConnected) label.textContent = '復元できませんでした。元の記録は保持しています。設定からバックアップを読み込めます。'; }
      finally { control.disabled = false; }
    });
    wrap.append(control);
  }
  return el;
}
