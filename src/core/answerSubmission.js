import { toHiragana, findNearMiss } from '../utils/readings.js';

export function classifyReadingAnswer(raw, acceptedReadings = []) {
  const normalized = toHiragana(String(raw ?? '').trim());
  const readings = acceptedReadings.map(value => toHiragana(String(value ?? '').trim())).filter(Boolean);
  if (!normalized) return { kind: 'blank', normalized, nearMiss: null };
  if (readings.includes(normalized)) return { kind: 'correct', normalized, nearMiss: null };
  const nearMiss = findNearMiss(normalized, readings);
  if (nearMiss) return { kind: 'near-miss', normalized, nearMiss };
  return { kind: 'incorrect', normalized, nearMiss: null };
}

/**
 * DOM と採点の間に置く、小さな一回確定ゲート。
 * onSubmit が true を返した時だけロックを維持する。空欄・近似入力など
 * 同じ問題を続ける場合は false を返せば、次の入力を受け付ける。
 */
export function createInputSubmission(onSubmit, { allowBlank = false, command = null } = {}) {
  let active = true;
  let composing = false;
  let locked = false;

  const reject = reason => ({ accepted: false, reason });
  const submit = (value, event = null) => {
    if (!active) return reject('inactive');
    if (composing || event?.isComposing || event?.keyCode === 229) return reject('composition');
    if (locked) return reject('locked');
    // Completion/navigation commands are not answers. Keep IME and lifetime
    // checks, but do not apply the answer's blank check or retain its lock.
    if (command?.(value, event) === true) return { accepted: true, reason: 'command' };
    if (!allowBlank && !String(value ?? '').trim()) return reject('blank');
    locked = true;
    try {
      const outcome = onSubmit(value, event);
      if (outcome && typeof outcome.then === 'function') {
        outcome.then(keepLocked => { if (keepLocked !== true && active) locked = false; })
          .catch(() => { if (active) locked = false; });
        return { accepted: true, reason: 'submitted' };
      }
      const keepLocked = outcome === true;
      if (!keepLocked) locked = false;
      return keepLocked ? { accepted: true, reason: 'submitted' } : reject('retry');
    } catch (error) {
      locked = false;
      throw error;
    }
  };

  return {
    handleKeydown(event, value) {
      if (event?.key !== 'Enter') return reject('key');
      event.preventDefault?.();
      return submit(value, event);
    },
    submit,
    compositionStart() { composing = true; },
    compositionEnd() { composing = false; },
    unlock() { locked = false; },
    deactivate() { active = false; locked = true; composing = false; },
    get active() { return active; },
    get locked() { return locked; },
    get composing() { return composing; },
  };
}

export function bindInputSubmission(inputEl, onSubmit, options) {
  const controller = createInputSubmission(onSubmit, options);
  const keydown = event => controller.handleKeydown(event, inputEl?.value ?? '');
  const compositionstart = () => controller.compositionStart();
  const compositionend = () => controller.compositionEnd();
  const submit = event => {
    event.preventDefault?.();
    controller.submit(inputEl?.value ?? '', event);
  };
  inputEl?.addEventListener('keydown', keydown);
  inputEl?.addEventListener('compositionstart', compositionstart);
  inputEl?.addEventListener('compositionend', compositionend);
  inputEl?.addEventListener('yomitabi:submit', submit);
  return Object.assign(controller, {
    dispose() {
      controller.deactivate();
      inputEl?.removeEventListener('keydown', keydown);
      inputEl?.removeEventListener('compositionstart', compositionstart);
      inputEl?.removeEventListener('compositionend', compositionend);
      inputEl?.removeEventListener('yomitabi:submit', submit);
    }
  });
}

export function requestInputSubmission(inputEl) {
  if (!inputEl) return;
  inputEl.dispatchEvent(new CustomEvent('yomitabi:submit', { bubbles: true, cancelable: true }));
}
