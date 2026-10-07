const CSS = `
.yt-checkpoint-choice {
  width: min(92vw, 520px);
  max-height: min(88vh, 660px);
  overflow: auto;
  padding: clamp(16px, 4vw, 28px);
  border: 4px solid #776139;
  border-radius: 22px;
  background: #fff9e7;
  color: #263b35;
  box-shadow: 0 18px 50px #172c3d77;
  font-family: 'UDデジタル教科書体', sans-serif;
  text-align: center;
}
.yt-checkpoint-choice::backdrop { background: #152a39aa; }
.yt-checkpoint-choice h2 { margin: 0 0 8px; font-size: clamp(23px, 5vw, 32px); }
.yt-checkpoint-choice p { margin: 0 0 18px; font-size: clamp(16px, 3.5vw, 20px); line-height: 1.5; }
.yt-checkpoint-options { display: grid; gap: 10px; }
.yt-checkpoint-options button {
  display: grid;
  gap: 2px;
  min-height: 66px;
  padding: 9px 14px;
  border: 3px solid #39736c;
  border-radius: 14px;
  background: #f4fffa;
  color: #263b35;
  font: inherit;
  cursor: pointer;
}
.yt-checkpoint-options button strong { font-size: clamp(18px, 4vw, 22px); }
.yt-checkpoint-options button span { font-size: clamp(14px, 3.3vw, 17px); }
.yt-checkpoint-options button:focus-visible { outline: 4px solid #e4a62d; outline-offset: 2px; }
`;

// A stage break is a choice about the next encounters, never a learning answer.
export function openCheckpointChoice(onPick) {
  const dialog = document.createElement('dialog');
  dialog.className = 'yt-checkpoint-choice';
  dialog.setAttribute('aria-label', 'はたの休けい所');
  const style = document.createElement('style');
  style.textContent = CSS;
  const title = document.createElement('h2');
  title.textContent = 'はたの 休けい所';
  const note = document.createElement('p');
  note.textContent = 'ここまで 来たよ！ この先で つかいたい ちからを えらぼう。';
  const choices = document.createElement('div');
  choices.className = 'yt-checkpoint-options';
  let active = true;
  const close = () => {
    if (!active) return;
    active = false;
    if (dialog.open) dialog.close();
    dialog.remove();
  };
  const add = (titleText, description, value) => {
    const button = document.createElement('button');
    button.type = 'button';
    const strong = document.createElement('strong');
    strong.textContent = titleText;
    const small = document.createElement('span');
    small.textContent = description;
    button.append(strong, small);
    button.addEventListener('click', () => {
      if (!active) return;
      close();
      onPick(value);
    });
    choices.append(button);
    return button;
  };
  const first = add('ことばの ちから', 'つぎの 3回の こうげきが 少し 強くなる', 'power');
  add('まもりの ちから', 'つぎの 2回の こうげきから 身を まもる', 'guard');
  add('そのまま 進む', 'いまの ちからで 旅を つづける', null);
  dialog.append(style, title, note, choices);
  dialog.addEventListener('cancel', event => event.preventDefault());
  document.body.append(dialog);
  dialog.showModal();
  first.focus({ preventScroll: true });
  return close;
}
