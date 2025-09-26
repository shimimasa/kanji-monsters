// TutorialGuide.js
// 画面上に半透明の幕 / 強調枠 / 吹き出し / ナビボタンを出す軽量ガイド

function getUiRoot() {
    let uiRoot = document.getElementById('uiOverlay');
    if (!uiRoot) {
      uiRoot = document.createElement('div');
      uiRoot.id = 'uiOverlay';
      uiRoot.style.position = 'absolute';
      uiRoot.style.left = '0';
      uiRoot.style.top = '0';
      uiRoot.style.pointerEvents = 'none';
      document.body.appendChild(uiRoot);
    }
    return uiRoot;
  }
  
  export function createGuide(steps, onClose) {
    const root = getUiRoot();
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', zIndex: 100000, pointerEvents: 'auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    });
  
    const frame = document.createElement('div'); // 吹き出しコンテナ
    Object.assign(frame.style, {
      position: 'absolute', maxWidth: '520px', background: 'white', color: '#222',
      borderRadius: '12px', padding: '14px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      fontFamily: '"UDデジタル教科書体", sans-serif', lineHeight: '1.5'
    });
  
    const title = document.createElement('div');
    Object.assign(title.style, { fontSize: '18px', fontWeight: '700', marginBottom: '6px' });
  
    const text = document.createElement('div');
    Object.assign(text.style, { fontSize: '16px', whiteSpace: 'pre-wrap' });
  
    const nav = document.createElement('div');
    Object.assign(nav.style, { display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' });
  
    const btnSkip = document.createElement('button');
    btnSkip.textContent = 'スキップ';
    const btnBack = document.createElement('button');
    btnBack.textContent = 'もどる';
    const btnNext = document.createElement('button');
    btnNext.textContent = 'つぎへ';
  
    [btnSkip, btnBack, btnNext].forEach(b => {
      Object.assign(b.style, {
        padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc',
        background: '#f5f5f5', cursor: 'pointer'
      });
    });
    btnNext.style.background = 'linear-gradient(135deg, #28a745, #20c997)';
    btnNext.style.color = 'white';
  
    nav.appendChild(btnSkip);
    nav.appendChild(btnBack);
    nav.appendChild(btnNext);
  
    frame.appendChild(title);
    frame.appendChild(text);
    frame.appendChild(nav);
  
    // 強調枠
    const focus = document.createElement('div');
    Object.assign(focus.style, {
      position: 'absolute', border: '3px solid #FFD54F', borderRadius: '10px',
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)'
    });
  
    overlay.appendChild(focus);
    overlay.appendChild(frame);
    root.appendChild(overlay);
  
    let idx = 0;
  
    function apply(step) {
      if (!step) return;
      const rect = typeof step.anchor === 'function' ? step.anchor() : step.anchor;
      // フォールバック
      const r = rect && Number.isFinite(rect.x) ? rect : { x: 80, y: 120, w: 300, h: 120 };
  
      focus.style.left = `${r.x}px`;
      focus.style.top = `${r.y}px`;
      focus.style.width = `${r.w}px`;
      focus.style.height = `${r.h}px`;
  
      // 吹き出しは枠の下側右寄せに出す（はみ出し簡易対応）
      const fx = Math.min(r.x + r.w + 16, window.innerWidth - 560);
      const fy = Math.min(r.y + r.h + 16, window.innerHeight - 160);
      frame.style.left = `${fx}px`;
      frame.style.top = `${fy}px`;
  
      title.textContent = step.title || 'あそびかた';
      text.textContent = step.text || '';
      btnBack.disabled = idx === 0;
      btnNext.textContent = (idx >= steps.length - 1) ? 'はじめる！' : 'つぎへ';
    }
  
    function close(neverShow = false) {
      overlay.remove();
      if (typeof onClose === 'function') onClose(neverShow);
    }
  
    btnSkip.onclick = () => close(false);
    btnBack.onclick = () => { if (idx > 0) { idx--; apply(steps[idx]); } };
    btnNext.onclick = () => {
      if (idx < steps.length - 1) { idx++; apply(steps[idx]); }
      else close(false);
    };
  
    // 右上×と「もう表示しない」
    const closeBar = document.createElement('div');
    Object.assign(closeBar.style, { position: 'absolute', right: '12px', top: '12px', display: 'flex', gap: '10px' });
    const never = document.createElement('button');
    never.textContent = 'もう表示しない';
    Object.assign(never.style, { background: 'transparent', color: '#fff', border: '1px solid #fff', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer' });
    const xbtn = document.createElement('button');
    xbtn.textContent = '×';
    Object.assign(xbtn.style, { background: 'transparent', color: '#fff', border: 'none', fontSize: '18px', cursor: 'pointer' });
    closeBar.appendChild(never);
    closeBar.appendChild(xbtn);
    overlay.appendChild(closeBar);
  
    never.onclick = () => close(true);
    xbtn.onclick = () => close(false);
  
    apply(steps[idx]);
  
    return {
      destroy() { try { overlay.remove(); } catch {} }
    };
  }