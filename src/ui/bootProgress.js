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