import { bindMathSprintInput } from './mathSprintInput.js';

const CSS = `
#mathSprintScreen{position:fixed;inset:0;z-index:100010;background:#faf5e9;color:#302d28;overflow:auto;overscroll-behavior:contain;font:18px system-ui,sans-serif;box-sizing:border-box;padding:12px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom));touch-action:manipulation}
#mathSprintScreen *{box-sizing:border-box}
#mathSprintScreen [hidden]{display:none!important}
#mathSprintScreen .ms-shell{max-width:660px;margin:0 auto}
#mathSprintScreen header{display:flex;gap:12px;align-items:center;justify-content:space-between;position:sticky;top:-12px;background:#faf5e9;z-index:1;padding:4px 0}
#mathSprintScreen h1{font-size:clamp(18px,4.8vw,26px);margin:0}
#mathSprintScreen button{min-width:44px;min-height:44px;border:1px solid #8c806d;border-radius:10px;background:#fff;color:#302d28;font:inherit;cursor:pointer;padding:8px 14px}
#mathSprintScreen button:disabled{opacity:.48;cursor:default}
#mathSprintScreen button:focus-visible,#mathSprintScreen input:focus-visible{outline:3px solid #207c79;outline-offset:2px}
#mathSprintScreen .ms-progress{display:flex;justify-content:space-between;margin:12px 0;font-size:16px}
#mathSprintScreen .ms-play{display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:16px;align-items:start}
#mathSprintScreen .ms-question{font-size:38px;font-weight:700;margin:8px 0 12px;letter-spacing:2px}
#mathSprintScreen .ms-answer-row{display:flex;gap:8px}
#mathSprintScreen input{min-width:0;width:100%;height:48px;border:2px solid #8c806d;border-radius:10px;font:26px system-ui;padding:4px 12px;background:#fff;color:#302d28}
#mathSprintScreen .ms-primary{background:#236d60;color:white;border-color:#236d60;white-space:nowrap}
#mathSprintScreen .ms-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
#mathSprintScreen .ms-pad button{min-height:48px;font-size:23px}
#mathSprintScreen .ms-pad .ms-delete{grid-column:span 2;font-size:18px}
#mathSprintScreen .ms-feedback{min-height:30px;margin:8px 0;line-height:1.5}
#mathSprintScreen .ms-companion{text-align:center;margin:0;padding-top:8px;font-size:14px;color:#655d4e}
#mathSprintScreen canvas{display:block;width:200px;height:100px;max-width:100%;margin:auto}
#mathSprintScreen .ms-result{text-align:center;padding:8px 0}
#mathSprintScreen .ms-result h2{font-size:26px}
#mathSprintScreen .ms-result p{margin:12px 0;font-size:18px}
#mathSprintScreen .ms-result strong{font-size:28px;display:block;margin-top:4px}
#mathSprintScreen .ms-pause{margin:8px 0;color:#685d4a}
@media(max-width:540px){#mathSprintScreen .ms-play{grid-template-columns:minmax(0,1fr)}#mathSprintScreen .ms-companion{padding:0}#mathSprintScreen .ms-question{margin-top:0}#mathSprintScreen canvas{width:160px;height:80px}#mathSprintScreen .ms-progress{margin:8px 0}}
@media(max-height:480px) and (min-width:541px){#mathSprintScreen .ms-pad{grid-template-columns:repeat(5,1fr)}#mathSprintScreen .ms-pad .ms-delete{grid-column:span 1}#mathSprintScreen .ms-pad button{padding:4px}#mathSprintScreen .ms-question{font-size:30px;margin:4px 0}#mathSprintScreen .ms-progress{margin:4px 0}}
`;

export function createMathSprintView({ document: doc, onBack, onReplay, onNext, onSubmit, getSnapshot }) {
  let root = null, binding = null, previousKey = null, previousProblem = null, active = true;
  const removes = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); removes.push(() => target.removeEventListener(type, fn)); };
  const el = (tag, className, text) => {
    const node = doc.createElement(tag); if (className) node.className = className;
    if (text) node.textContent = text; return node;
  };
  root = el('section'); root.id = 'mathSprintScreen'; root.setAttribute('aria-label', 'けいさんスプリント');
  const style = el('style'); style.textContent = CSS; root.append(style);
  const shell = el('div', 'ms-shell'); root.append(shell);
  const header = el('header'); shell.append(header);
  header.append(el('h1', '', 'けいさんスプリント'));
  const back = el('button', '', 'もどる'); back.type = 'button'; back.dataset.action = 'back'; header.append(back);
  on(back, 'click', () => { if (active) onBack(); });
  const progress = el('div', 'ms-progress'), position = el('span'), score = el('span');
  progress.append(position, score); shell.append(progress);
  const pause = el('p', 'ms-pause', 'おやすみ中'); pause.hidden = true; shell.append(pause);
  const play = el('div', 'ms-play'), controls = el('div'); shell.append(play); play.append(controls);
  const question = el('div', 'ms-question'); question.dataset.role = 'problem'; controls.append(question);
  const row = el('div', 'ms-answer-row'), input = el('input');
  input.type = 'text'; input.inputMode = 'numeric'; input.autocomplete = 'off'; input.maxLength = 16;
  input.setAttribute('aria-label', 'こたえ'); input.setAttribute('enterkeyhint', 'done');
  const answer = el('button', 'ms-primary', '回答'); answer.type = 'button'; answer.dataset.action = 'answer';
  row.append(input, answer); controls.append(row);
  const pad = el('div', 'ms-pad'); pad.setAttribute('aria-label', '数字パッド'); controls.append(pad);
  const canAnswer = () => active && getSnapshot().phase === 'answering' && !getSnapshot().paused;
  for (const digit of ['1','2','3','4','5','6','7','8','9','0','削除']) {
    const button = el('button', digit === '削除' ? 'ms-delete' : '', digit); button.type = 'button';
    button.dataset.digit = digit; pad.append(button);
    on(button, 'click', () => {
      if (!canAnswer() || binding?.composing()) return;
      input.value = digit === '削除' ? input.value.slice(0, -1) : (input.value + digit).slice(0, 16);
    });
  }
  const feedback = el('p', 'ms-feedback'); feedback.setAttribute('aria-live', 'polite'); controls.append(feedback);
  const next = el('button', 'ms-primary', '次へ'); next.type = 'button'; next.dataset.action = 'next'; controls.append(next);
  let nextIdentity = null;
  on(next, 'click', () => { if (active && nextIdentity) onNext(...nextIdentity); });
  const companion = el('figure', 'ms-companion'), canvas = el('canvas');
  canvas.width = 280; canvas.height = 140; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '仲間のジャガイモスライム');
  const caption = el('figcaption', '', 'ジャガイモスライム'); companion.append(canvas, caption); play.append(companion);
  const result = el('div', 'ms-result'); result.hidden = true; shell.append(result);
  result.append(el('h2', '', '10もん おつかれさま！'));
  const finalFeedback = el('p', 'ms-feedback'); result.append(finalFeedback);
  const values = {};
  for (const [key, label] of [['correct','せいかい'],['accuracy','せいかいりつ'],['maxStreak','さいこうれんぞく']]) {
    const p = el('p', '', label), strong = el('strong'); p.append(strong); result.append(p); values[key] = strong;
  }
  const replay = el('button', 'ms-primary', 'もういちど'); replay.type = 'button'; replay.dataset.action = 'replay'; result.append(replay);
  on(replay, 'click', () => { if (active && !getSnapshot().paused) onReplay(); });
  doc.body.append(root);
  return {
    root,
    update(state, companionState) {
      if (!active) return;
      const key = `${state.sessionId}:${state.seq}:${state.paused}`;
      if (key !== previousKey) {
        previousKey = key;
        const p = state.problem;
        if (p && previousProblem !== p.problemId) {
          binding?.dispose(); previousProblem = p.problemId; input.value = '';
          binding = bindMathSprintInput(input, answer, { sessionId: state.sessionId, token: state.token }, onSubmit, canAnswer);
          question.textContent = `${p.a} ${p.operation === 'addition' ? '+' : '−'} ${p.b} = ?`;
          nextIdentity = [state.sessionId, p.problemId];
        }
        const disabled = state.paused || state.phase !== 'answering';
        input.disabled = disabled; answer.disabled = disabled;
        for (const button of pad.children) button.disabled = disabled;
        next.hidden = state.phase !== 'feedback'; next.disabled = state.paused;
        replay.disabled = state.paused; pause.hidden = !state.paused;
        position.textContent = `${Math.min(10, state.answered + (state.phase === 'answering' ? 1 : 0))} / 10`;
        score.textContent = `せいかい ${state.correct}`;
        feedback.textContent = state.lastAnswer ? (state.lastAnswer.correct ? 'せいかい！' : `こたえは ${state.lastAnswer.answer} だよ`) : '';
        controls.hidden = !!state.result; result.hidden = !state.result;
        play.style.display = state.result ? 'flex' : '';
        play.style.justifyContent = state.result ? 'center' : '';
        if (state.result) {
          finalFeedback.textContent = feedback.textContent;
          values.correct.textContent = `${state.result.correct} / 10`;
          values.accuracy.textContent = `${Math.round(state.result.accuracy * 100)}%`;
          values.maxStreak.textContent = `${state.result.maxStreak}`;
        }
      }
      companion.hidden = !companionState.selected;
      const label = companionState.motion?.imageState === 'failed' ? '仲間といっしょに！' : 'ジャガイモスライム';
      if (caption.textContent !== label) caption.textContent = label;
    },
    canvas,
    stopInput() { binding?.dispose(); binding = null; active = false; },
    dispose() { this.stopInput(); removes.splice(0).forEach(remove => remove()); root?.remove(); root = null; },
  };
}
