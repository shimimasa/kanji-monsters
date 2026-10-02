import { element, button } from '../ui/adventureUI.js';
import { createBuildReview } from './buildReview.js';

// The result screen's 「もじを ならべて ふくしゅう」: the run's missed questions once more, built
// from letter cards (createBuildReview). It opens only when the child asks; nothing is recorded.
// A proverb's built letters sit under their kanji (frame); the written kana stay in place.
const letterAt = (frame, k) => {
  for (const part of frame) if (part.kanji) { if (k < part.size) return { kanji: part.kanji, at: k + 1 }; k -= part.size; }
  return null;
};
const spellOut = (frame, letters) => { let k = 0; const list = [...letters]; return frame.map(p => p.kana ?? list.slice(k, k += p.size).join('')).join(''); };

export function createBuildReviewPanel(doc, { random = Math.random, onDone = null } = {}) {
  const root = element(doc, 'section', 'gt-build-review'); root.hidden = true;
  root.setAttribute('aria-label', 'もじを ならべて ふくしゅう');
  const open = button(doc, '', () => start(), 'gt-button gt-build-open'); open.dataset.action = 'build-review';
  const note = element(doc, 'p', 'gt-build-note', 'まちがえた問題を、もじを ならべて こたえよう（記録には のこらないよ）');
  const work = element(doc, 'div', 'gt-build-work'); work.hidden = true;
  const count = element(doc, 'p', 'gt-build-count'), prompt = element(doc, 'p', 'gt-build-prompt'); prompt.tabIndex = -1;
  const sentence = element(doc, 'p', 'gt-build-sentence'), hint = element(doc, 'p', 'gt-build-hint');
  const slots = element(doc, 'div', 'gt-build-slots'), tiles = element(doc, 'div', 'gt-build-tiles');
  const say = element(doc, 'p', 'gt-build-say'); say.setAttribute('role', 'status');
  const next = button(doc, 'つぎへ', () => { review.next(); render(); focusFirst(); }, 'gt-button gt-primary'); next.dataset.action = 'build-next';
  work.append(count, prompt, sentence, hint, slots, tiles, say, next);
  root.append(open, note, work);
  let review = null, key = null, doneSent = false;

  const start = () => { open.hidden = true; note.hidden = true; work.hidden = false; render(); focusFirst(); };
  // When it is done the next button hides: the focus stays in the panel, on the closing words.
  const focusFirst = () => (tiles.querySelector('button:not(:disabled)') ?? (next.hidden ? prompt : next)).focus?.({ preventScroll: true });
  function render() {
    const s = review.snapshot();
    if (s.status === 'done') {
      count.textContent = ''; prompt.textContent = `${s.total}問 ぜんぶ ならべられたね！`; sentence.replaceChildren(); sentence.hidden = true; hint.hidden = true;
      slots.replaceChildren(); tiles.replaceChildren();
      say.textContent = s.firstTry === s.total ? '1回目で ぜんぶ できたよ。おぼえたね！' : 'もういちど たしかめられたね。';
      next.hidden = true; root.dataset.status = 'done';
      // Done to the end, once per result: the shell may add the がんばり mark.
      if (!doneSent && s.total) { doneSent = true; onDone?.(); }
      return;
    }
    root.dataset.status = s.status;
    count.textContent = `ふくしゅう ${s.index + 1} / ${s.total}`;
    prompt.textContent = s.prompt; sentence.hidden = !s.sentence; hint.hidden = !s.note; hint.textContent = s.note ?? '';
    sentence.replaceChildren(...(s.sentence ? [element(doc, 'span', '', s.sentence.before), element(doc, 'b', '', s.prompt.match(/「(.+?)」/)?.[1] ?? ''), element(doc, 'span', '', s.sentence.after)] : []));
    // A number sentence (6+9=15) is counted in cards, kanji parts in pieces, a word in letters.
    const unit = s.script === 'equation' ? '番目' : s.script === 'parts' ? 'つ目' : '文字目';
    root.dataset.script = s.script ?? ''; root.dataset.frame = String(!!s.frame);
    const where = k => { const w = s.frame && letterAt(s.frame, k); return w ? `「${w.kanji}」の ${w.at}文字目` : `${k + 1}${unit}`; };
    const spell = letters => (s.frame ? spellOut(s.frame, letters) : letters);
    const made = Array.from({ length: s.length }, (_, k) => {
      const filled = k < s.placed.length;
      const slot = button(doc, filled ? s.tiles[s.placed[k]] : '', () => { if (review.unplace(k)) render(); }, 'gt-build-slot');
      slot.disabled = !filled || s.status !== 'building';
      slot.setAttribute('aria-label', filled ? `${where(k)} ${s.tiles[s.placed[k]]}（おすと もどす）` : where(k));
      return slot;
    });
    let at = 0;
    slots.replaceChildren(...(!s.frame ? made : s.frame.map(part => {
      if (part.kana) return element(doc, 'span', 'gt-build-fixed', part.kana);
      const group = element(doc, 'span', 'gt-build-group'), row = element(doc, 'span', 'gt-build-group-slots');
      row.append(...made.slice(at, at += part.size));
      group.append(element(doc, 'span', 'gt-build-kanji', part.kanji), row);
      return group;
    })));
    tiles.replaceChildren(...s.tiles.map((ch, k) => {
      const tile = button(doc, ch, () => { if (review.place(k)) { render(); focusFirst(); } }, 'gt-build-tile');
      tile.disabled = s.placed.includes(k) || s.status !== 'building';
      if (k === s.hintTile) tile.dataset.hint = 'true';
      return tile;
    }));
    const last = s.last;
    say.textContent = s.status === 'solved' ? `できた！ ${s.explain ?? `「${s.shownAnswer}」`}`
      : last && !last.correct ? `「${spell(last.word)}」ではなかったよ。${where(last.wrongAt - 1)}は「${last.expected}」。光る カードから つづけよう${s.shownAnswer ? `（こたえ：${spell(s.shownAnswer)}）` : ''}`
      : s.placed.length === 0 && s.chosen ? `ゲームでは「${s.chosen}」をえらんだよ。カードを じゅんに おそう` : '';
    next.hidden = s.status !== 'solved';
    next.textContent = s.index + 1 < s.total ? 'つぎへ' : 'おわる';
  }
  return {
    root,
    // The run's missed list (entries with `build`); shown once per result.
    sync(missed, runKey) {
      if (runKey === key) return;
      key = runKey; doneSent = false;
      review = createBuildReview({ missed: missed ?? [], random });
      const total = review.snapshot().total;
      root.hidden = !total; open.hidden = false; note.hidden = false; work.hidden = true;
      open.textContent = `もじを ならべて ふくしゅう（${total}問）`;
    },
    hide() { root.hidden = true; key = null; },
  };
}
