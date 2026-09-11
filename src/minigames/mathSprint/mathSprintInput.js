import { createInputSubmission } from '../../core/answerSubmission.js';

// One binding per problem captures its identity; a retained callback cannot answer
// a later problem. All listeners, including IME state, have one explicit disposer.
export function bindMathSprintInput(input, button, identity, submit, canAnswer) {
  const gate = createInputSubmission(value => canAnswer() && submit({ ...identity, value }));
  const listeners = [];
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push(() => target.removeEventListener(type, fn)); };
  on(input, 'keydown', event => {
    if (event.key === 'Enter' && event.repeat) { event.preventDefault(); return; }
    gate.handleKeydown(event, input.value);
  });
  on(input, 'compositionstart', () => gate.compositionStart());
  on(input, 'compositionend', () => gate.compositionEnd());
  on(button, 'click', event => gate.submit(input.value, event));
  return {
    composing: () => gate.composing,
    dispose() { gate.deactivate(); listeners.splice(0).forEach(remove => remove()); },
  };
}
