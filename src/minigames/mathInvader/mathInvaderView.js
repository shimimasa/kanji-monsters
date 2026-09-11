import { bindMathSprintInput } from '../mathSprint/mathSprintInput.js';

const CSS = `
#mathInvaderScreen{position:fixed;inset:0;z-index:100010;background:#eef4fb;color:#202b38;overflow:auto;overscroll-behavior:contain;font:17px system-ui,sans-serif;box-sizing:border-box;padding:10px max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom));touch-action:manipulation}
#mathInvaderScreen *{box-sizing:border-box}#mathInvaderScreen [hidden]{display:none!important}
#mathInvaderScreen .mi-shell{max-width:780px;margin:0 auto}#mathInvaderScreen header{display:flex;align-items:center;justify-content:space-between;gap:10px;position:sticky;top:-10px;z-index:5;background:#eef4fb;padding:4px 0}
#mathInvaderScreen h1{font-size:clamp(19px,4.8vw,27px);margin:0}#mathInvaderScreen button{min-width:44px;min-height:44px;border:1px solid #62758a;border-radius:9px;background:#fff;color:#202b38;font:inherit;padding:7px 12px;cursor:pointer}
#mathInvaderScreen button:disabled{opacity:.48;cursor:default}#mathInvaderScreen button:focus-visible,#mathInvaderScreen input:focus-visible{outline:3px solid #196a83;outline-offset:2px}
#mathInvaderScreen .mi-hud{display:flex;justify-content:space-between;gap:12px;margin:8px 0;font-weight:700}.mi-pause{margin:5px 0;color:#694c16}
#mathInvaderScreen .mi-layout{display:grid;grid-template-columns:minmax(0,1fr) 190px;gap:12px}.mi-board{position:relative;height:270px;border:2px solid #7892aa;border-radius:12px;background:linear-gradient(#d9ecff,#fff);overflow:hidden}
#mathInvaderScreen .mi-board::after{content:'';position:absolute;left:0;right:0;bottom:18px;border-top:2px dashed #a86b5e}.mi-enemy{position:absolute;width:26%;min-width:70px;transform:translateY(-50%);font-weight:700;background:#fff4dc!important;z-index:2}.mi-enemy[aria-pressed=true]{background:#ffe08a!important;border:3px solid #9c6100}
#mathInvaderScreen .mi-projectile{position:absolute;width:9px;height:18px;border-radius:8px;background:#2f86db;box-shadow:0 0 8px #fff;transform:translate(-50%,-50%);pointer-events:none;z-index:3}
#mathInvaderScreen .mi-companion{pointer-events:none;text-align:center;margin:0;padding:6px 0;color:#56697d}.mi-companion canvas{display:block;width:180px;height:90px;max-width:100%;margin:auto}
#mathInvaderScreen .mi-instruction{margin:8px 0;min-height:26px}.mi-controls{max-width:520px;margin:8px auto}.mi-selected{font-size:24px;font-weight:700;margin:6px 0}.mi-answer-row{display:flex;gap:8px}.mi-answer-row input{min-width:0;width:100%;height:48px;border:2px solid #62758a;border-radius:9px;font:25px system-ui;padding:4px 10px;background:#fff;color:#202b38}.mi-primary{background:#315b8a!important;color:#fff!important;border-color:#315b8a!important;white-space:nowrap}
#mathInvaderScreen .mi-pad{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:8px 0}.mi-pad button{font-size:20px;padding:5px}.mi-delete{grid-column:span 2;font-size:16px!important}.mi-feedback{min-height:26px;margin:6px 0;line-height:1.4}.mi-result{text-align:center;padding:12px}.mi-result h2{font-size:28px}.mi-result p{font-size:19px;margin:10px}.mi-result strong{display:block;font-size:26px}
@media(max-width:560px){#mathInvaderScreen .mi-layout{grid-template-columns:1fr}.mi-companion{position:static;width:auto;padding:0}.mi-companion canvas{width:120px;height:60px}.mi-board{height:245px}.mi-pad{grid-template-columns:repeat(3,1fr)}.mi-delete{grid-column:span 2}.mi-hud{padding-right:0}}
@media(max-height:430px) and (min-width:561px){#mathInvaderScreen .mi-board{height:190px}.mi-companion canvas{width:140px;height:70px}.mi-pad{grid-template-columns:repeat(11,1fr)}.mi-delete{grid-column:span 1}.mi-pad button{padding:3px}.mi-controls{margin-top:4px}}
`;

export function createMathInvaderView({ document: doc, onBack, onReplay, onSubmit, onSelect, getSnapshot }) {
  let active = true, binding = null, boundAttemptId = null, root = null;
  const removes = [], enemyNodes = new Map(), projectileNodes = new Map();
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const el = (tag, className = '', text = '') => {
    const node = doc.createElement(tag); node.className = className; node.textContent = text; return node;
  };
  root = el('section'); root.id = 'mathInvaderScreen'; root.setAttribute('aria-label', 'けいさんインベーダー');
  const style = el('style'); style.textContent = CSS; root.append(style);
  const shell = el('div', 'mi-shell'); root.append(shell);
  const header = el('header'); shell.append(header); header.append(el('h1', '', 'けいさんインベーダー'));
  const back = el('button', '', 'もどる'); back.type = 'button'; back.dataset.action = 'back'; header.append(back);
  on(back, 'click', () => { if (active) onBack(); });
  const hud = el('div', 'mi-hud'), life = el('span'), progress = el('span'); hud.append(life, progress); shell.append(hud);
  const pause = el('p', 'mi-pause', 'おやすみ中'); pause.hidden = true; shell.append(pause);
  const layout = el('div', 'mi-layout'), board = el('div', 'mi-board'); board.dataset.role = 'enemy-area'; layout.append(board);
  const companion = el('figure', 'mi-companion'), canvas = el('canvas'); canvas.width = 280; canvas.height = 140;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '仲間のジャガイモスライム');
  const caption = el('figcaption', '', 'ジャガイモスライム'); companion.append(canvas, caption); layout.append(companion); shell.append(layout);
  const instruction = el('p', 'mi-instruction', 'てきを えらんでね'); instruction.setAttribute('aria-live', 'polite'); shell.append(instruction);
  const controls = el('div', 'mi-controls'), selected = el('div', 'mi-selected'); controls.append(selected);
  const row = el('div', 'mi-answer-row'), input = el('input'); input.type = 'text'; input.inputMode = 'numeric';
  input.autocomplete = 'off'; input.maxLength = 16; input.setAttribute('aria-label', 'こたえ'); input.setAttribute('enterkeyhint', 'done');
  const submit = el('button', 'mi-primary', '回答'); submit.type = 'button'; submit.dataset.action = 'answer'; row.append(input, submit); controls.append(row);
  const pad = el('div', 'mi-pad'); pad.setAttribute('aria-label', '数字パッド'); controls.append(pad);
  const canAnswer = () => {
    const state = getSnapshot(); return active && state.phase === 'playing' && !!state.selectedEnemy && !state.paused;
  };
  for (const digit of ['1','2','3','4','5','6','7','8','9','0','削除']) {
    const button = el('button', digit === '削除' ? 'mi-delete' : '', digit); button.type = 'button'; button.dataset.digit = digit; pad.append(button);
    on(button, 'click', () => {
      if (!canAnswer() || binding?.composing()) return;
      input.value = digit === '削除' ? input.value.slice(0, -1) : (input.value + digit).slice(0, 16);
    });
  }
  const feedback = el('p', 'mi-feedback'); feedback.setAttribute('aria-live', 'polite'); controls.append(feedback); shell.append(controls);
  const result = el('div', 'mi-result'); result.hidden = true; shell.append(result);
  const resultTitle = el('h2'), resultCorrect = el('strong'), resultIncorrect = el('strong'), resultResolved = el('strong');
  result.append(resultTitle);
  for (const [label, value] of [['せいかい', resultCorrect], ['まちがい', resultIncorrect], ['かいけつ', resultResolved]]) {
    const p = el('p', '', label); p.append(value); result.append(p);
  }
  const replay = el('button', 'mi-primary', 'もういちど'); replay.type = 'button'; replay.dataset.action = 'replay'; result.append(replay);
  on(replay, 'click', () => { if (active && !getSnapshot().paused) onReplay(); });
  doc.body.append(root);

  const syncEnemies = state => {
    const live = new Set(state.enemies.map(enemy => enemy.enemyId));
    for (const [id, entry] of enemyNodes) if (!live.has(id)) { entry.node.remove(); enemyNodes.delete(id); }
    for (const enemy of state.enemies) {
      let entry = enemyNodes.get(enemy.enemyId);
      if (!entry) {
        const node = el('button', 'mi-enemy'); node.type = 'button'; node.dataset.enemyId = enemy.enemyId;
        const handler = () => {
          const current = getSnapshot();
          if (!active || current.paused) return;
          onSelect({ sessionId: current.sessionId, enemyId: enemy.enemyId, problemId: enemy.problemId });
          input.focus?.();
        };
        on(node, 'click', handler); board.append(node); entry = { node }; enemyNodes.set(enemy.enemyId, entry);
      }
      entry.node.textContent = `${enemy.question} = ?`;
      entry.node.style.left = `${5 + enemy.lane * 32}%`; entry.node.style.top = `${enemy.y * 100}%`;
      entry.node.disabled = state.paused || state.phase !== 'playing';
      entry.node.setAttribute('aria-pressed', String(state.selectedEnemyId === enemy.enemyId));
    }
  };
  const syncProjectiles = state => {
    const live = new Set(state.projectiles.map(projectile => projectile.projectileId));
    for (const [id, node] of projectileNodes) if (!live.has(id)) { node.remove(); projectileNodes.delete(id); }
    for (const projectile of state.projectiles) {
      let node = projectileNodes.get(projectile.projectileId);
      if (!node) { node = el('i', 'mi-projectile'); board.append(node); projectileNodes.set(projectile.projectileId, node); }
      const progressValue = 1 - projectile.remainingMs / projectile.durationMs;
      const bottom = 0.88, y = bottom + (projectile.targetY - bottom) * progressValue;
      node.style.left = `${18 + projectile.lane * 32}%`; node.style.top = `${y * 100}%`;
    }
  };

  return {
    root,
    canvas,
    update(state, companionState) {
      if (!active) return;
      syncEnemies(state); syncProjectiles(state);
      life.textContent = `ライフ ${'●'.repeat(state.life)}${'○'.repeat(3 - state.life)}`;
      progress.textContent = `かいけつ ${state.resolved} / 10`;
      pause.hidden = !state.paused; board.setAttribute('aria-busy', String(state.simulationPaused));
      const target = state.selectedEnemy;
      if (target?.attemptId !== boundAttemptId) {
        binding?.dispose(); binding = null; boundAttemptId = target?.attemptId ?? null; input.value = '';
        if (target?.attemptId) {
          binding = bindMathSprintInput(input, submit, {
            sessionId: state.sessionId, enemyId: target.enemyId, problemId: target.problemId,
            attemptId: target.attemptId, token: target.token,
          }, onSubmit, canAnswer);
        }
      }
      controls.hidden = !target || !!state.result;
      selected.textContent = target ? `${target.question} = ?` : '';
      const disabled = state.paused || !target || state.phase !== 'playing';
      input.disabled = disabled; submit.disabled = disabled;
      for (const button of pad.children) button.disabled = disabled;
      if (state.result) instruction.textContent = state.result.outcome === 'clear' ? 'クリア！' : 'ゲームオーバー';
      else if (state.lastAttempt && !state.lastAttempt.correct) instruction.textContent = `ちがうよ。ライフ ${state.life}`;
      else instruction.textContent = target ? 'こたえを にゅうりょくしてね' : 'てきを えらんでね';
      feedback.textContent = state.lastAttempt ? (state.lastAttempt.correct ? 'せいかい！' : 'もういちど こたえよう') : '';
      board.hidden = !!state.result; instruction.hidden = !!state.result; controls.hidden = !target || !!state.result;
      layout.style.display = state.result ? 'flex' : '';
      layout.style.justifyContent = state.result ? 'center' : '';
      result.hidden = !state.result;
      if (state.result) {
        resultTitle.textContent = state.result.outcome === 'clear' ? 'クリア！' : 'ゲームオーバー';
        resultCorrect.textContent = String(state.result.correct);
        resultIncorrect.textContent = String(state.result.incorrect);
        resultResolved.textContent = `${state.result.resolved} / 10`;
      }
      companion.hidden = !companionState.selected;
      caption.textContent = companionState.motion?.imageState === 'failed' ? '仲間といっしょに！' : 'ジャガイモスライム';
    },
    stopInput() { binding?.dispose(); binding = null; active = false; },
    dispose() {
      this.stopInput(); removes.splice(0).forEach(remove => remove());
      enemyNodes.clear(); projectileNodes.clear(); root?.remove(); root = null;
    },
  };
}
