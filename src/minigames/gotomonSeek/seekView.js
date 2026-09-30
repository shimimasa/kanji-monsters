import { createArcadeFrame, restartClass } from '../arcade/arcadeKit.js';
import { castAt } from '../gotomonCast.js';
import Speech from '../../audio/speech.js';

const pct = value => `${(value * 100).toFixed(2)}%`;
// Each hiding place is drawn as a bush, a tree, a rock or tall grass (the Gotomon's lower half hides behind it).
const COVERS = ['bush', 'tree', 'rock', 'grass'];
const CSS = `
#gotomonSeekScreen .ya-field{background:radial-gradient(ellipse at 50% 110%,#7cc26a 0 45%,transparent 46%),radial-gradient(ellipse at 20% 35%,#9bd98a55 0 18%,transparent 19%),linear-gradient(#bfe8ff 0 18%,#8fd07c 18% 100%)}
#gotomonSeekScreen .sk-pond{position:absolute;left:40%;top:64%;width:24%;height:12%;border-radius:50%;background:radial-gradient(ellipse,#8fd3ff,#4aa3d8);opacity:.8}
#gotomonSeekScreen .sk-hider{position:absolute;width:clamp(64px,10vw,110px);aspect-ratio:1;transform:translate(-50%,-50%);padding:0;border:0;background:none;cursor:pointer;touch-action:manipulation;z-index:3}
#gotomonSeekScreen .sk-hider:focus-visible{outline:3px solid #2a6fb0;outline-offset:2px;border-radius:12px}
#gotomonSeekScreen .sk-who{position:absolute;left:14%;right:14%;top:0;height:78%;animation:sk-peek var(--peek,3.6s) ease-in-out infinite;animation-delay:var(--delay,0s)}
#gotomonSeekScreen .sk-who img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 3px 2px #0004)}
#gotomonSeekScreen .sk-cover{position:absolute;left:0;right:0;bottom:6%;height:48%;z-index:2;pointer-events:none}
#gotomonSeekScreen .sk-cover[data-cover=bush]{border-radius:50% 50% 30% 30%;background:radial-gradient(circle at 30% 40%,#5fb85a 0 30%,transparent 31%),radial-gradient(circle at 70% 40%,#4fa84a 0 32%,transparent 33%),radial-gradient(ellipse at 50% 70%,#3f9a3c 0 60%,transparent 61%)}
#gotomonSeekScreen .sk-cover[data-cover=tree]{background:linear-gradient(90deg,transparent 42%,#8b5a2b 42% 58%,transparent 58%) 0 100%/100% 45% no-repeat,radial-gradient(ellipse at 50% 40%,#3f8f3a 0 55%,transparent 56%)}
#gotomonSeekScreen .sk-cover[data-cover=rock]{height:40%;border-radius:45% 55% 20% 20%;background:radial-gradient(circle at 35% 30%,#d8d4cc,#9a948a 70%)}
#gotomonSeekScreen .sk-cover[data-cover=grass]{background:repeating-linear-gradient(75deg,transparent 0 6px,#4fa84a 6px 10px),repeating-linear-gradient(-70deg,transparent 0 7px,#3f9a3c 7px 11px);clip-path:polygon(0 100%,5% 20%,15% 60%,25% 5%,35% 55%,45% 10%,55% 50%,65% 0,75% 55%,85% 15%,95% 60%,100% 100%)}
#gotomonSeekScreen .sk-tag{position:absolute;left:50%;bottom:-8%;transform:translateX(-50%);max-width:150%;padding:1px 8px;border-radius:9px;background:#fffdf6;border:2px solid #7a5a2b;color:#2a1b0d;font-size:clamp(13px,min(1.8vw,2.6vh),20px);font-weight:900;white-space:nowrap;z-index:3;box-shadow:0 2px 0 #7a5a2b}
#gotomonSeekScreen .sk-hider[data-hint=true] .sk-tag{border-color:#37c871;box-shadow:0 0 0 4px #37c871aa}
#gotomonSeekScreen .sk-hider[data-hint=true] .sk-who{animation:sk-sparkle .8s ease-in-out infinite alternate}
#gotomonSeekScreen .sk-hider[data-state=wrong]{opacity:.55;cursor:default}
#gotomonSeekScreen .sk-hider[data-state=found] .sk-who{animation:sk-found .9s ease-out forwards}
#gotomonSeekScreen .sk-hider.sk-no{animation:sk-no .4s ease-out}
#gotomonSeekScreen .sk-title{margin:0;text-align:center;font-size:14px;font-weight:900;color:#d4f0c8}
#gotomonSeekScreen .sk-prompt{margin:0;padding:10px 12px;border-radius:14px;background:#ffffff14;color:#fff;text-align:center;font-size:clamp(22px,3.2vw,32px);font-weight:900;line-height:1.3}
#gotomonSeekScreen .sk-prompt small{display:block;margin-top:4px;font-size:15px;font-weight:700;color:#e0f4d8}
#gotomonSeekScreen .sk-prompt small b{color:#ffe066}
#gotomonSeekScreen .sk-ask{margin:0;text-align:center;color:#ffe2b8;font-size:14px;font-weight:800}
@keyframes sk-peek{0%,100%{transform:translateY(34%)}35%,65%{transform:translateY(0)}}
@keyframes sk-sparkle{from{transform:translateY(0);filter:drop-shadow(0 0 4px #fff)}to{transform:translateY(-8%);filter:drop-shadow(0 0 12px #ffe066)}}
@keyframes sk-found{0%{transform:translateY(0) scale(1)}40%{transform:translateY(-60%) scale(1.25)}100%{transform:translateY(-40%) scale(1.15)}}
@keyframes sk-no{0%,100%{transform:translate(-50%,-50%)}30%{transform:translate(-56%,-50%)}60%{transform:translate(-44%,-50%)}}
`;

export function createSeekView({ document: doc, dispatch, onBack, getSnapshot, cast }) {
  let active = true, lastEventId = 0, doneShown = false, shownTap = 0, problemKey = null, sceneKey = null;
  const removes = [], nodes = new Map();
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const frame = createArcadeFrame(doc, { id: 'gotomonSeekScreen', title: 'ゴトモンさがし', theme: 'seek' });
  const { root, world, dock, fx, el } = frame;
  const style = el('style'); style.textContent = CSS; root.append(style);
  on(frame.back, 'click', () => { if (active) onBack(); });
  world.append(el('div', 'sk-pond'));

  const title = el('p', 'sk-title');
  const prompt = el('p', 'sk-prompt'); prompt.dataset.role = 'problem';
  const ask = el('p', 'sk-ask', '答えのふだを持っているゴトモンを さがして タップ！');
  const note = el('p', 'ya-dock-note'); note.dataset.role = 'feedback';
  dock.append(title, prompt, ask, note);
  doc.body.append(root);

  function tap(hiderId) {
    const state = getSnapshot();
    if (!active || state.paused || state.phase !== 'answering') return false;
    return dispatch({ type: 'tap', payload: { sessionId: state.sessionId, attemptId: state.attemptId, hiderId } });
  }

  // A new question: everyone hides again in new places.
  const hideAll = state => {
    for (const node of nodes.values()) node.remove?.();
    nodes.clear();
    state.hiders.forEach((hider, i) => {
      const node = el('button', 'sk-hider'); node.type = 'button';
      node.style.left = pct(hider.x); node.style.top = pct(hider.y);
      node.style.setProperty?.('--delay', `${(i * 0.53) % 3.6}s`); node.style.setProperty?.('--peek', `${3.2 + (i % 3) * 0.4}s`);
      const who = el('div', 'sk-who'), friend = castAt(cast?.wild, hider.cast + state.problemIndex);
      if (friend) { const img = el('img'); img.alt = ''; img.src = friend.imageUrl; who.append(img); node.dataset.name = friend.name; }
      const cover = el('div', 'sk-cover'); cover.dataset.cover = COVERS[hider.spot % COVERS.length];
      node.append(who, cover, el('span', 'sk-tag', hider.text));
      node.setAttribute('aria-label', `「${hider.text}」のふだ`);
      on(node, 'click', () => tap(hider.hiderId));
      world.append(node); nodes.set(hider.hiderId, node);
    });
  };
  const render = state => {
    const key = `${state.problemIndex}:${state.hiders[0]?.hiderId}`;
    if (key !== sceneKey) { sceneKey = key; hideAll(state); }
    for (const hider of state.hiders) {
      const node = nodes.get(hider.hiderId); if (!node) continue;
      if (node.dataset.state !== hider.state) node.dataset.state = hider.state;
      const hint = String(hider.hiderId === state.hintHiderId);
      if (node.dataset.hint !== hint) node.dataset.hint = hint;
      node.disabled = hider.state !== 'hiding';
    }
    if (state.problem && problemKey !== state.problem.contentId) {
      problemKey = state.problem.contentId; prompt.textContent = state.problem.prompt;
      if (state.problem.sentence) { const small = el('small'); small.append(el('span', '', state.problem.sentence.before), el('b', '', state.problem.prompt.match(/「(.+?)」/)?.[1] ?? ''), el('span', '', state.problem.sentence.after)); prompt.append(small); }
      const word = state.problem.kind === 'en2ja' ? state.problem.prompt.split(' ')[0] : null;
      if (word) Speech.speakEnglish(word);
    }
    const titleText = state.phase === 'completed' ? '' : `もんだい ${Math.min(state.total, state.problemIndex + 1)}/${state.total}　見つけた ${state.found}`;
    if (title.textContent !== titleText) title.textContent = titleText;
  };
  const showTap = state => {
    const t = state.lastTap, node = nodes.get(t.hiderId), name = node?.dataset.name;
    if (t.correct) {
      fx.burst(t.x * 100, t.y * 100, t.first ? 'great' : 'good', t.first ? 1.4 : 1.1);
      fx.pop(t.x * 100, t.y * 100 - 10, 'みつけた！', 'great');
      note.textContent = `${name ? `${name}、みつけた！ ` : 'みつけた！ '}${t.explain}`;
    } else {
      if (node) restartClass(node, 'sk-no');
      note.textContent = `${name ? `${name}は` : 'このゴトモンは'}「${t.text}」のふだ${t.note ? `（${t.note}）` : ''}。光っているゴトモンを さがそう`;
    }
    frame.announce(note.textContent);
  };

  return {
    root,
    attachCompanion(portrait) { const buddy = el('div'); buddy.style.cssText = 'position:absolute;left:2%;top:64px;width:56px;height:56px;pointer-events:none;z-index:4'; buddy.append(portrait); world.append(buddy); },
    focusPlay() { nodes.values().next().value?.focus?.({ preventScroll: true }); },
    update(state) {
      if (!active) return;
      frame.setPaused(state.paused && !state.result);
      if (!state.hiders?.length) return;
      render(state);
      if (state.lastTap && state.lastTap.tap !== shownTap) { shownTap = state.lastTap.tap; showTap(state); }
      if (state.result && !doneShown) {
        doneShown = true;
        fx.banner('ぜんいん みつけた！', 'great'); fx.burst(50, 50, 'great', 2);
        note.textContent = `${state.result.found}回 みつけた！ 1回で見つけたのは ${state.result.correct}回`;
      }
    },
    present(play, dt, state) {
      if (!active || !state) return;
      frame.tick(dt);
      const w = play.world || {};
      const event = w.lastEvent;
      if (event && event.id !== lastEventId) {
        lastEventId = event.id;
        if (event.type === 'boost') { fx.banner('さがしフィーバー！', 'great'); fx.flash('great'); }
      }
      const mission = w.challenge;
      frame.hud.set({ points: play.learningPoints + play.bonus, comboCount: play.combo,
        progressValue: Math.min(1, (state.found ?? 0) / (state.total || 1)), progressLabel: `見つけた ${state.found ?? 0}/${state.total ?? 0}`,
        life: null, gaugeValue: play.gauge, fever: w.fever,
        missionText: mission ? `${mission.status === 'achieved' ? '✓ ' : '★ '}${mission.name} ${mission.progress}` : '', missionDone: mission?.status === 'achieved' });
    },
    stopInput() { active = false; nodes.forEach(node => { node.disabled = true; }); },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); frame.dispose(); },
  };
}
