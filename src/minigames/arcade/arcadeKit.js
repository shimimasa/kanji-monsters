import { ARCADE_CSS } from './arcadeStyles.js';

// Guarded DOM helpers: views must also run in the minimal fixture DOM of tests.
export const restartClass = (node, name) => {
  if (!node?.classList) return;
  node.classList.remove(name); void node.offsetWidth; node.classList.add(name);
};
export const toggleClass = (node, name, on) => node?.classList?.toggle(name, on);
export const setVar = (node, name, value) => node?.style?.setProperty?.(name, value);

// Shared screen parts for the real-time mini-games. Views stay the only owner
// of their DOM: nothing here reads Core state, grades, or schedules time. Effect
// lifetimes follow the clock the view receives from the Host (tick(dt)).
export function createArcadeFrame(doc, { id, title, theme }) {
  const el = (tag, className = '', text = '') => {
    const node = doc.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node;
  };
  const root = el('section', 'ya-arcade'); root.id = id; root.dataset.theme = theme;
  root.setAttribute('aria-label', title);
  const style = el('style'); style.textContent = ARCADE_CSS; root.append(style);
  const shell = el('div', 'ya-shell'); root.append(shell);
  const header = el('header', 'ya-header');
  const back = el('button', 'ya-back', 'もどる'); back.type = 'button'; back.dataset.action = 'back';
  header.append(el('h1', '', title), back); shell.append(header);
  const stage = el('div', 'ya-stage'); shell.append(stage);
  const field = el('div', 'ya-field'); field.dataset.role = 'playfield'; stage.append(field);
  const world = el('div', 'ya-world'); field.append(world);
  const fxLayer = el('div', 'ya-fx'); fxLayer.setAttribute('aria-hidden', 'true'); field.append(fxLayer);
  const dock = el('div', 'ya-dock'); stage.append(dock);
  const hud = createHud(el); field.append(hud.root);
  const pauseVeil = el('div', 'ya-pause-veil', '一時停止中'); pauseVeil.hidden = true; field.append(pauseVeil);
  const live = el('p', 'ya-live'); live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status'); shell.append(live);

  let clock = 0, liveText = '';
  const effects = [];
  const spawn = (className, text, x, y, life) => {
    const node = el('span', `ya-fx-item ${className}`, text);
    node.style.left = `${x}%`; node.style.top = `${y}%`;
    const item = { node, until: clock + life, finish: () => { node.removeEventListener('animationend', item.finish); node.remove(); } };
    node.addEventListener('animationend', item.finish);
    fxLayer.append(node); effects.push(item);
    while (effects.length > 18) effects.shift().finish();
    return node;
  };
  const fx = {
    pop(x, y, text, tone = 'good') { spawn(`ya-pop ya-tone-${tone}`, text, x, y, 1100); },
    burst(x, y, tone = 'good', size = 1) {
      const node = spawn(`ya-burst ya-tone-${tone}`, '', x, y, 700); setVar(node, '--size', String(size));
      for (let i = 0; i < 8; i++) { const spark = el('i'); setVar(spark, '--a', `${i * 45}deg`); node.append(spark); }
    },
    beam(x1, y1, x2, y2, tone = 'good') {
      const box = field.getBoundingClientRect?.() ?? { width: 0, height: 0 };
      const dx = (x2 - x1) * box.width / 100, dy = (y2 - y1) * box.height / 100;
      const node = spawn(`ya-beam ya-tone-${tone}`, '', x1, y1, 350);
      node.style.width = `${Math.hypot(dx, dy)}px`; node.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    },
    banner(text, tone = 'good') { spawn(`ya-banner ya-tone-${tone}`, text, 50, 42, 1500); },
    shake() { restartClass(field, 'ya-shake'); },
    flash(tone = 'good') { restartClass(field, `ya-flash-${tone}`); },
  };
  return {
    root, shell, header, back, stage, field, world, dock, hud, fx, el,
    announce(text) { if (text && text !== liveText) { liveText = text; live.textContent = text; } },
    setPaused(paused) { pauseVeil.hidden = !paused; field.dataset.paused = String(!!paused); },
    tick(dt = 0) {
      clock += Math.max(0, Number.isFinite(dt) ? dt : 0);
      while (effects.length && effects[0].until <= clock) effects.shift().finish();
    },
    dispose() { effects.splice(0).forEach(item => item.finish()); root.remove(); },
  };
}

function createHud(el) {
  const root = el('div', 'ya-hud');
  const left = el('div', 'ya-hud-left'), right = el('div', 'ya-hud-right');
  const score = el('strong', 'ya-score', '0'), scoreUnit = el('small', '', 'pt');
  const scoreBox = el('div', 'ya-score-box'); scoreBox.append(score, scoreUnit);
  const combo = el('div', 'ya-combo'); combo.hidden = true;
  const progress = el('div', 'ya-progress'); const progressFill = el('i'); const progressText = el('span');
  progress.append(progressFill, progressText);
  const lives = el('div', 'ya-lives');
  const gauge = el('div', 'ya-gauge'); gauge.setAttribute('aria-label', '相棒ゲージ');
  const gaugeLabel = el('span', '', '相棒'); gauge.append(gaugeLabel);
  const pips = [0, 1, 2].map(() => { const pip = el('i'); gauge.append(pip); return pip; });
  const mission = el('div', 'ya-mission'); mission.hidden = true;
  left.append(scoreBox, combo); right.append(progress, lives, gauge, mission); root.append(left, right);
  let lastCombo = 0, lastScore = null;
  return {
    root,
    set({ points = 0, comboCount = 0, progressValue = 0, progressLabel = '', life = null, maxLife = 3, lifeLabel = 'バリア',
      gaugeValue = 0, fever = false, missionText = '', missionDone = false } = {}) {
      if (points !== lastScore) {
        score.textContent = String(points);
        if (lastScore !== null && points > lastScore) restartClass(score, 'ya-bump');
        lastScore = points;
      }
      combo.hidden = comboCount < 2;
      if (comboCount !== lastCombo) {
        combo.textContent = `${comboCount} COMBO`; combo.dataset.level = comboCount >= 5 ? 'hot' : comboCount >= 3 ? 'warm' : 'on';
        if (comboCount > lastCombo) restartClass(combo, 'ya-bump');
        lastCombo = comboCount;
      }
      progressFill.style.width = `${Math.round(Math.max(0, Math.min(1, progressValue)) * 100)}%`;
      progressText.textContent = progressLabel;
      lives.hidden = life === null;
      if (life !== null) {
        lives.textContent = '';
        lives.append(el('small', '', lifeLabel));
        for (let i = 0; i < maxLife; i++) lives.append(el('i', i < life ? 'on' : ''));
        lives.setAttribute('aria-label', `${lifeLabel} ${life}/${maxLife}`);
      }
      pips.forEach((pip, i) => toggleClass(pip, 'on', gaugeValue >= i + 1));
      gauge.dataset.fever = String(!!fever);
      gaugeLabel.textContent = fever ? 'フィーバー！' : '相棒';
      mission.hidden = !missionText; mission.textContent = missionText; mission.dataset.done = String(!!missionDone);
    },
  };
}

// Big on-screen number pad. Keys only report intent; the view decides.
// `on` is the view's tracked listener helper, so disposal removes every handler.
export function createNumberPad(doc, { on, onDigit, onDelete, onFire, fireLabel = 'うつ！' }) {
  const root = doc.createElement('div'); root.className = 'ya-pad'; root.setAttribute('aria-label', '数字パッド');
  const buttons = [];
  for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'けす', '0', fireLabel]) {
    const node = doc.createElement('button'); node.type = 'button'; node.textContent = key;
    let action = () => onDigit(key);
    if (key === 'けす') { node.className = 'ya-pad-del'; node.dataset.digit = '削除'; node.setAttribute('aria-label', '1文字けす'); action = onDelete; }
    else if (key === fireLabel) { node.className = 'ya-pad-fire'; node.dataset.action = 'answer'; action = onFire; }
    else node.dataset.digit = key;
    on(node, 'click', () => action());
    // Keep focus off the pad so a later Enter fires instead of repeating a digit.
    on(node, 'mousedown', event => event.preventDefault?.());
    root.append(node); buttons.push(node);
  }
  return { root, setEnabled(enabled) { for (const node of buttons) node.disabled = !enabled; } };
}

// Document keys for play: digits/Backspace/Enter without focusing an input, so
// tablets do not open the OS keyboard. Controls with their own keys are skipped.
export function bindArcadeKeys(doc, handler) {
  const listener = event => {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return;
    const tag = event.target?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.target?.isContentEditable) return;
    if (['BUTTON', 'SUMMARY', 'A'].includes(tag) && (event.key === 'Enter' || event.key === ' ')) return;
    if (handler(event)) event.preventDefault();
  };
  doc.addEventListener('keydown', listener);
  return () => doc.removeEventListener('keydown', listener);
}
