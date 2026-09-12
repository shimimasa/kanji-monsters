const CSS = `
#kanjiDefenseScreen{position:fixed;inset:0;z-index:100010;overflow:auto;overscroll-behavior:contain;background:#10263c;color:#f8fbff;font:16px system-ui,sans-serif;padding:8px max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom));box-sizing:border-box;touch-action:manipulation}
#kanjiDefenseScreen *{box-sizing:border-box}#kanjiDefenseScreen [hidden]{display:none!important}
#kanjiDefenseScreen .kd-shell{width:min(920px,100%);margin:auto}#kanjiDefenseScreen header{display:flex;align-items:center;justify-content:space-between;gap:8px}#kanjiDefenseScreen h1{font-size:clamp(21px,5vw,32px);margin:2px 0;color:#fff3a6}
#kanjiDefenseScreen button{min-width:44px;min-height:44px;border:2px solid #d7e6f5;border-radius:10px;background:#f8fbff;color:#10263c;font:inherit;font-weight:700;padding:7px 10px;cursor:pointer}#kanjiDefenseScreen button:disabled{opacity:.48;cursor:default}#kanjiDefenseScreen button:focus-visible,#kanjiDefenseScreen input:focus-visible{outline:4px solid #ffda44;outline-offset:2px}
#kanjiDefenseScreen .kd-hud{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}.kd-stat{background:#203c55;border:1px solid #6f91ad;border-radius:8px;padding:5px;text-align:center;font-weight:800}.kd-stat small{display:block;font-size:11px;color:#c9dfef}.kd-silent{font-size:12px;text-align:right;color:#c9dfef;margin:0}
#kanjiDefenseScreen .kd-pause{position:sticky;top:4px;z-index:9;background:#fff3a6;color:#332900;border:2px solid #7a6200;border-radius:8px;text-align:center;padding:6px;font-weight:900;margin:4px 0}
#kanjiDefenseScreen .kd-main{display:grid;grid-template-columns:minmax(0,1fr) 150px;gap:8px}.kd-board{position:relative;display:grid;grid-template-columns:repeat(3,1fr);height:clamp(220px,42vh,380px);border:3px solid #8fb5cc;border-radius:14px;overflow:hidden;background:linear-gradient(#88c7ec 0%,#d8f1d0 72%,#76583d 73%,#3c2b20 100%)}.kd-board::after{content:'防衛ライン';position:absolute;left:0;right:0;bottom:5%;border-top:4px dashed #fff3a6;color:#fff3a6;text-align:center;font-size:12px;font-weight:900;pointer-events:none}
#kanjiDefenseScreen .kd-lane{position:relative;border-right:2px dashed rgba(255,255,255,.55);min-width:0}.kd-lane:last-child{border-right:0}.kd-lane-label{position:absolute;z-index:1;top:3px;left:50%;transform:translateX(-50%);background:#10263ccc;border-radius:99px;padding:2px 8px;font-size:12px;pointer-events:none}
#kanjiDefenseScreen .kd-monster{position:absolute;left:5%;width:90%;min-width:0;transform:translateY(-50%);padding:4px 3px;background:#fff9e9e8;box-shadow:0 4px 10px #0005;transition:top 90ms linear}.kd-monster[aria-pressed=true]{border:4px solid #ffb300;background:#fff!important}.kd-marker{display:block;font-size:11px;color:#6a3e00;min-height:15px}.kd-monster[aria-pressed=true] .kd-marker::before{content:'▶ 選択中 '}.kd-monster img{display:block;width:52px;height:42px;object-fit:contain;margin:auto}.kd-fallback{display:block;font-size:30px;line-height:42px}.kd-prompt{display:block;font-size:clamp(18px,4vw,27px);line-height:1.05}.kd-threat{display:block;font-size:12px;color:#30495e}.kd-threat[data-level=danger]{color:#9c1d16;font-weight:900}
#kanjiDefenseScreen .kd-companion{text-align:center;margin:0;color:#dbeeff;align-self:end}.kd-companion canvas{display:block;width:140px;height:70px;max-width:100%;margin:auto}.kd-companion figcaption{font-size:11px}
#kanjiDefenseScreen .kd-instruction{margin:6px 0;min-height:24px;font-weight:750}.kd-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin:6px 0}.kd-target{grid-column:1/-1;min-height:24px;font-weight:800;color:#fff3a6}.kd-controls input{width:100%;min-width:0;height:48px;border:3px solid #8fb5cc;border-radius:10px;background:#fff;color:#10263c;font:24px system-ui;padding:4px 10px}.kd-primary{background:#f0a000!important;color:#211600!important;border-color:#fff3a6!important}.kd-feedback{min-height:26px;margin:5px 0;padding:4px 8px;border-radius:7px;background:#203c55}.kd-result{background:#f8fbff;color:#10263c;border-radius:14px;padding:12px;text-align:center}.kd-result h2{margin:4px}.kd-result-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.kd-result strong{display:block;font-size:24px}.kd-word-columns{display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left}.kd-word-columns section{background:#edf4f8;border-radius:8px;padding:7px}.kd-word-columns h3{margin:0 0 4px;font-size:15px}.kd-word-columns p{margin:0;line-height:1.5}
@media(max-width:580px){#kanjiDefenseScreen .kd-main{grid-template-columns:1fr}.kd-companion{display:none}.kd-board{height:290px}.kd-hud{font-size:14px}.kd-stat{padding:4px 2px}.kd-monster img{width:44px;height:36px}.kd-prompt{font-size:20px}}
@media(max-height:650px){#kanjiDefenseScreen{font-size:14px}.kd-board{height:190px}.kd-monster img{display:none}.kd-fallback{display:none}.kd-prompt{font-size:18px}.kd-hud{margin:2px 0}.kd-controls{margin:3px 0}.kd-feedback,.kd-instruction{margin:2px 0}.kd-companion{display:none}}
@media(max-height:430px) and (min-width:581px){#kanjiDefenseScreen .kd-main{grid-template-columns:minmax(0,1fr) 90px}.kd-board{height:140px}.kd-companion canvas{width:90px;height:45px}.kd-result{padding:6px}.kd-word-columns{display:none}}
@media(prefers-reduced-motion:reduce){#kanjiDefenseScreen .kd-monster{transition:none}}
`;

export function createKanjiDefenseView({ document: doc, dispatch, onBack, onReplay, getSnapshot }) {
  let active = true, composing = false, boundAttemptId = null, root = null;
  const removes = [], enemyNodes = new Map();
  const on = (target, type, handler) => {
    target.addEventListener(type, handler);
    removes.push(() => target.removeEventListener(type, handler));
  };
  const el = (tag, className = '', text = '') => {
    const node = doc.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  const sendSelection = enemy => {
    if (!active || !enemy) return false;
    const accepted = dispatch({
      type: 'select',
      payload: { sessionId: getSnapshot().sessionId, enemyId: enemy.enemyId, problemId: enemy.problemId },
    });
    if (accepted) input.focus?.();
    return accepted;
  };
  const sendSubmit = () => {
    const state = getSnapshot();
    const enemy = state.selectedEnemy;
    if (!active || composing || state.paused || state.phase !== 'playing' || !enemy) return false;
    return dispatch({
      type: 'submit',
      payload: {
        sessionId: state.sessionId,
        enemyId: enemy.enemyId,
        problemId: enemy.problemId,
        attemptId: enemy.attemptId,
        token: enemy.token,
        value: input.value,
      },
    });
  };

  root = el('section');
  root.id = 'kanjiDefenseScreen';
  root.setAttribute('aria-label', '漢字防衛隊');
  const style = el('style'); style.textContent = CSS; root.append(style);
  const shell = el('div', 'kd-shell'); root.append(shell);
  const header = el('header'); shell.append(header);
  header.append(el('h1', '', '漢字防衛隊'));
  const back = el('button', '', 'もどる'); back.type = 'button'; back.dataset.action = 'back'; header.append(back);
  on(back, 'click', () => { if (active) onBack(); });

  const hud = el('div', 'kd-hud'); shell.append(hud);
  const makeStat = label => { const box = el('div', 'kd-stat'); box.append(el('small', '', label)); const value = el('span'); box.append(value); hud.append(box); return value; };
  const life = makeStat('旅路ライフ'), combo = makeStat('コンボ'), score = makeStat('スコア'), progress = makeStat('防衛');
  const silent = el('p', 'kd-silent', '🔇 音なしで遊べます'); shell.append(silent);
  const pause = el('p', 'kd-pause', '一時停止中'); pause.hidden = true; shell.append(pause);

  const main = el('div', 'kd-main'), board = el('div', 'kd-board'); board.dataset.role = 'defense-board';
  const lanes = [0, 1, 2].map(index => {
    const lane = el('div', 'kd-lane'); lane.dataset.lane = String(index); lane.append(el('span', 'kd-lane-label', `${index + 1}番`)); board.append(lane); return lane;
  });
  main.append(board);
  const companion = el('figure', 'kd-companion'), canvas = el('canvas'); canvas.width = 280; canvas.height = 140;
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '旅の仲間');
  const caption = el('figcaption', '', '旅の仲間'); companion.append(canvas, caption); main.append(companion); shell.append(main);
  const instruction = el('p', 'kd-instruction', 'せまるMonsterを選び、漢字の読みを入力しよう。'); instruction.setAttribute('aria-live', 'polite'); shell.append(instruction);
  const controls = el('div', 'kd-controls'), target = el('div', 'kd-target', 'Monsterを選んでね'); controls.append(target);
  const input = el('input'); input.type = 'text'; input.inputMode = 'text'; input.autocomplete = 'off'; input.maxLength = 16;
  input.setAttribute('aria-label', '選んだ漢字の読み'); input.setAttribute('enterkeyhint', 'done'); controls.append(input);
  const submit = el('button', 'kd-primary', 'よみで攻撃'); submit.type = 'button'; submit.dataset.action = 'answer'; controls.append(submit); shell.append(controls);
  const feedback = el('p', 'kd-feedback'); feedback.setAttribute('aria-live', 'polite'); shell.append(feedback);
  on(input, 'compositionstart', () => { composing = true; });
  on(input, 'compositionend', () => { composing = false; });
  on(input, 'keydown', event => {
    if (event.key !== 'Enter' || event.repeat || event.isComposing || composing || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault?.();
    sendSubmit();
  });
  on(submit, 'click', sendSubmit);
  on(doc, 'keydown', event => {
    if (!active || event.target === input || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    if (!['1', '2', '3'].includes(event.key)) return;
    const state = getSnapshot();
    const enemy = state.enemies.find(candidate => candidate.lane === Number(event.key) - 1);
    if (enemy && !state.paused) {
      event.preventDefault?.();
      sendSelection(enemy);
    }
  });

  const result = el('section', 'kd-result'); result.hidden = true; result.setAttribute('aria-label', '防衛結果'); shell.append(result);
  const resultTitle = el('h2'), resultGrid = el('div', 'kd-result-grid'); result.append(resultTitle, resultGrid);
  const resultValues = {};
  for (const [key, label] of [['score', 'スコア'], ['correct', '撃退'], ['maxCombo', '最大コンボ']]) {
    const box = el('div'); box.append(el('small', '', label)); const value = el('strong'); box.append(value); resultGrid.append(box); resultValues[key] = value;
  }
  const words = el('div', 'kd-word-columns');
  const strongBox = el('section'), weakBox = el('section'); strongBox.append(el('h3', '', '強かったことば')); weakBox.append(el('h3', '', 'もう一度見たいことば'));
  const strongWords = el('p'), weakWords = el('p'); strongBox.append(strongWords); weakBox.append(weakWords); words.append(strongBox, weakBox); result.append(words);
  const replay = el('button', 'kd-primary', 'もう一度守る'); replay.type = 'button'; replay.dataset.action = 'replay'; result.append(replay);
  on(replay, 'click', () => { if (active && !getSnapshot().paused) onReplay(); });
  doc.body.append(root);

  const createEnemyNode = enemy => {
    const node = el('button', 'kd-monster'); node.type = 'button'; node.dataset.enemyId = enemy.enemyId;
    const marker = el('span', 'kd-marker'), image = el('img'), fallback = el('span', 'kd-fallback', '👾'); fallback.hidden = true;
    image.src = enemy.imageUrl; image.alt = ''; image.setAttribute('aria-hidden', 'true');
    const prompt = el('strong', 'kd-prompt'), threat = el('span', 'kd-threat'); node.append(marker, image, fallback, prompt, threat);
    on(image, 'error', () => { image.hidden = true; fallback.hidden = false; });
    on(node, 'click', () => {
      const current = getSnapshot().enemies.find(candidate => candidate.enemyId === enemy.enemyId && candidate.problemId === enemy.problemId);
      if (current && !getSnapshot().paused) sendSelection(current);
    });
    lanes[enemy.lane].append(node);
    return { node, marker, image, fallback, prompt, threat, lane: enemy.lane };
  };
  const syncEnemies = state => {
    const live = new Set(state.enemies.map(enemy => enemy.enemyId));
    for (const [id, entry] of enemyNodes) if (!live.has(id)) { entry.node.remove(); enemyNodes.delete(id); }
    for (const enemy of state.enemies) {
      let entry = enemyNodes.get(enemy.enemyId);
      if (!entry) { entry = createEnemyNode(enemy); enemyNodes.set(enemy.enemyId, entry); }
      entry.node.style.top = `${Math.round(enemy.progress * 100)}%`;
      entry.node.disabled = state.paused || state.phase !== 'playing';
      entry.node.setAttribute('aria-pressed', String(state.selectedEnemyId === enemy.enemyId));
      entry.node.setAttribute('aria-label', `${enemy.lane + 1}番、${enemy.monsterName}、${enemy.prompt}、${enemy.threat}`);
      entry.marker.textContent = state.selectedEnemyId === enemy.enemyId ? '選択中' : '';
      entry.prompt.textContent = enemy.prompt;
      entry.threat.textContent = enemy.threat;
      entry.threat.dataset.level = enemy.threat === '危険' ? 'danger' : 'normal';
    }
  };

  return {
    root,
    canvas,
    update(state, companionState) {
      if (!active) return;
      syncEnemies(state);
      life.textContent = `${'♥'.repeat(state.life)}${'♡'.repeat(3 - state.life)}`;
      combo.textContent = `${state.combo}連続`;
      score.textContent = String(state.score);
      progress.textContent = `${state.resolved}/${state.rules.totalEncounters}`;
      pause.hidden = !state.paused;
      board.setAttribute('aria-busy', String(state.paused));
      if (state.selectedEnemy?.attemptId !== boundAttemptId) {
        boundAttemptId = state.selectedEnemy?.attemptId ?? null;
        input.value = '';
      }
      const canAnswer = state.phase === 'playing' && !state.paused && !!state.selectedEnemy;
      input.disabled = !canAnswer;
      submit.disabled = !canAnswer;
      target.textContent = state.selectedEnemy
        ? `選択：${state.selectedEnemy.monsterName}「${state.selectedEnemy.prompt}」`
        : 'Monsterを選んでね（キーボードは1・2・3）';
      if (state.result) instruction.textContent = state.result.outcome === 'defended' ? '旅路を守りきった！' : 'ここまで守ったことばを確認しよう。';
      else if (state.act === 1) instruction.textContent = 'Monsterを選び、表示されたことばの読みを入力しよう。';
      else instruction.textContent = `${state.waveLabel}：防衛ラインに近いMonsterから読もう。`;
      if (state.lastAttempt && !state.lastAttempt.correct && state.lastAttempt.retryAvailable) feedback.textContent = `もう一度！ ヒント：${state.lastAttempt.hint}`;
      else if (state.lastResolution?.outcome === 'correct') feedback.textContent = `${state.lastResolution.prompt}を撃退！`;
      else if (state.lastResolution) feedback.textContent = `「${state.lastResolution.prompt}」の読みは「${state.lastResolution.reading}」`;
      else feedback.textContent = '正しく読むと、ことばバリアを破れるよ。';
      companion.hidden = !companionState?.selected;
      caption.textContent = companionState?.motion?.imageState === 'failed' ? '仲間は画像なしでも応援中' : '旅の仲間';
      board.hidden = !!state.result;
      controls.hidden = !!state.result;
      instruction.hidden = !!state.result;
      feedback.hidden = !!state.result;
      silent.hidden = !!state.result;
      result.hidden = !state.result;
      if (state.result) {
        resultTitle.textContent = state.result.outcome === 'defended' ? '防衛成功！' : '防衛記録';
        resultValues.score.textContent = String(state.result.score);
        resultValues.correct.textContent = `${state.result.correct}/${state.result.resolved}`;
        resultValues.maxCombo.textContent = String(state.result.maxCombo);
        strongWords.textContent = state.result.strongWords.join('・') || '次の挑戦で見つけよう';
        weakWords.textContent = state.result.weakWords.join('・') || 'なし';
      }
    },
    stopInput() {
      active = false;
      composing = false;
      input.disabled = true;
      submit.disabled = true;
    },
    dispose() {
      this.stopInput();
      removes.splice(0).forEach(remove => remove());
      enemyNodes.clear();
      root?.remove();
      root = null;
    },
  };
}
