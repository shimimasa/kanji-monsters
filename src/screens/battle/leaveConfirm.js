// src/screens/battle/leaveConfirm.js
// バトルの「もどる」を押した時の「ちずに もどる？」の確かめ。
//
// 「もどる」は左上の押しやすい所にあり、1回さわるだけで 30問ほどの進みが消えていた。
// window.confirm() は描画ループごと止まる（ブラウザ確認の落とし穴）ので、画面の上に重ねる窓にする。
// battleScreen.js（凍結中）には「// BATTLE-LAYOUT」の印付きの呼び出しだけを足す（2026-10-04 ユーザー承認）。
import { publish } from '../../core/eventBus.js';
import { gameState } from '../../core/gameState.js';

let overlay = null, keyHandler = null;

export function isLeaveConfirmOpen() { return !!overlay; }

/** 地図（ステージ選択）へ戻る。もとの「もどる」と同じ動き */
function leave() {
  closeLeaveConfirm();
  publish('playBGM', 'title'); // メニュー共通BGMへ
  publish('changeScreen', gameState.previousScreen === 'worldStageSelect' ? 'worldStageSelect' : 'stageSelect');
}

export function openLeaveConfirm(doc = globalThis.document) {
  if (overlay || !doc?.body) return;
  // 途中の旗（5体）を立てていれば、次はそこから始まる。立てていなければ 1体目から
  const checkpoint = Number(gameState.stageProgress?.[gameState.currentStageId]?.checkpoint || 0);
  const note = checkpoint > 0
    ? 'もどっても、はたの ところから また つづきが できるよ。'
    : 'もどると、つぎは この ステージの はじめから に なるよ。';

  overlay = doc.createElement('div');
  overlay.id = 'battleLeaveConfirm';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'battleLeaveConfirmTitle');
  // 入力欄が z-index 2147483647 なので同じ値にし、あとから足して上に重ねる
  Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483647', display: 'grid', placeItems: 'center',
    background: 'rgba(5, 20, 30, 0.6)', padding: '16px' });
  const box = doc.createElement('div');
  Object.assign(box.style, { width: 'min(420px, 100%)', background: '#fff8e1', color: '#3b2a12', border: '3px solid #b8860b',
    borderRadius: '16px', padding: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', textAlign: 'center',
    fontFamily: '"UDデジタル教科書体", sans-serif' });
  const title = doc.createElement('h2');
  title.id = 'battleLeaveConfirmTitle';
  title.textContent = 'ちずに もどる？';
  Object.assign(title.style, { margin: '0 0 10px', fontSize: '24px' });
  const body = doc.createElement('p');
  body.textContent = note;
  Object.assign(body.style, { margin: '0 0 6px', fontSize: '17px', lineHeight: '1.6' });
  const kept = doc.createElement('p');
  kept.textContent = 'よめた かんじは ちゃんと のこっているよ。';
  Object.assign(kept.style, { margin: '0 0 16px', fontSize: '15px', color: '#5a6b3a' });
  const row = doc.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' });
  const makeButton = (text, primary, action) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = text;
    Object.assign(b.style, { minWidth: '150px', minHeight: '52px', fontSize: '19px', fontWeight: '700', borderRadius: '12px',
      cursor: 'pointer', border: primary ? '2px solid #154c3e' : '2px solid #8b5a2b',
      background: primary ? '#2e7d5b' : '#fff', color: primary ? '#fff' : '#5a3a1c' });
    b.addEventListener('click', (e) => { e.stopPropagation(); action(); });
    return b;
  };
  const stay = makeButton('つづける', true, () => { publish('playSE', 'decide'); closeLeaveConfirm(); });
  stay.id = 'battleLeaveStay';
  const go = makeButton('ちずに もどる', false, () => { publish('playSE', 'decide'); leave(); });
  go.id = 'battleLeaveGo';
  row.append(stay, go);
  box.append(title, body, kept, row);
  overlay.append(box);
  // 窓の外を押したら「つづける」（うっかり もどらないほう）
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeLeaveConfirm(); });
  keyHandler = (e) => { if (e.key === 'Escape') { e.preventDefault(); closeLeaveConfirm(); } };
  doc.addEventListener('keydown', keyHandler, true);
  try { doc.activeElement?.blur?.(); } catch {}
  doc.body.append(overlay);
  try { stay.focus(); } catch {}
}

export function closeLeaveConfirm() {
  if (keyHandler) { overlay?.ownerDocument?.removeEventListener('keydown', keyHandler, true); keyHandler = null; }
  overlay?.remove();
  overlay = null;
}
