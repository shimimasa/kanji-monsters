// src/ui/rotateHint.js
// スマホを よこに 持った時の「たてに してね」の 案内（2026-10-04）。
//
// バトルや ステージ選択は canvas で 描く。スマホを よこに すると 高さが 400px ほどしかなく、
// 50音パッドが その ほとんどを 使うので、盤面は 切手くらいに なって 遊べなかった。
// たてに 持てば バトルは たて長の 配置（screens/battle/portraitLayout.js）で 大きく 見える。
//
// 出すのは: 指で さわる 端末 ／ よこ長で 高さ 500px 未満 ／ canvas の 画面が 前に ある 時
// （タイトル・広場・ミニゲームなど DOM の 画面は よこでも 使えるので 出さない）。
// 「このまま あそぶ」で その日は もう 出さない。

const ID = 'rotateHint';
let dismissed = false;

export function shouldShowRotateHint(win = globalThis.window, doc = globalThis.document) {
  if (!win || !doc || dismissed) return false;
  const touch = !!(win.matchMedia?.('(pointer: coarse)')?.matches);
  if (!touch) return false;
  if (!(win.innerWidth > win.innerHeight && win.innerHeight < 500)) return false;
  const canvas = doc.getElementById('gameCanvas');
  if (!canvas || canvas.inert || canvas.style.visibility === 'hidden' || canvas.style.display === 'none') return false;
  return true;
}

function build(doc) {
  const overlay = doc.createElement('div');
  overlay.id = ID;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'スマホを たてに してね');
  Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483646', display: 'none',
    placeItems: 'center', background: 'rgba(8, 24, 36, 0.94)', color: '#fff', textAlign: 'center',
    fontFamily: '"UDデジタル教科書体", sans-serif', padding: '16px' });
  const box = doc.createElement('div');
  const icon = doc.createElement('div');
  icon.textContent = '📱↻';
  Object.assign(icon.style, { fontSize: '48px', marginBottom: '8px' });
  const title = doc.createElement('div');
  title.textContent = 'スマホを たてに してね';
  Object.assign(title.style, { fontSize: '24px', fontWeight: '700', marginBottom: '6px' });
  const note = doc.createElement('div');
  note.textContent = 'たてに すると 字が 大きく 見えるよ';
  Object.assign(note.style, { fontSize: '16px', opacity: '0.85', marginBottom: '14px' });
  const keep = doc.createElement('button');
  keep.type = 'button';
  keep.textContent = 'このまま あそぶ';
  Object.assign(keep.style, { minHeight: '44px', padding: '8px 18px', fontSize: '16px', borderRadius: '10px',
    border: '2px solid #ffffff88', background: 'transparent', color: '#fff', cursor: 'pointer' });
  keep.addEventListener('click', () => { dismissed = true; overlay.style.display = 'none'; });
  box.append(icon, title, note, keep);
  overlay.append(box);
  doc.body.append(overlay);
  return overlay;
}

export function installRotateHint(win = globalThis.window, doc = globalThis.document) {
  if (!win || !doc?.body || doc.getElementById(ID)) return;
  const overlay = build(doc);
  const check = () => { overlay.style.display = shouldShowRotateHint(win, doc) ? 'grid' : 'none'; };
  win.addEventListener('resize', check);
  win.addEventListener('orientationchange', check);
  // 画面が 切りかわった時（DOM の 画面 → canvas の 画面）にも 追いつくよう、ときどき 見なおす
  win.setInterval(check, 700);
  check();
}
