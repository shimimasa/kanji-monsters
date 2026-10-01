import { element, button } from '../ui/adventureUI.js';
import { createBuildReview } from './buildReview.js';

// The result screen's 「もじを ならべて ふくしゅう」: the run's missed questions once more, built
// from letter cards (createBuildReview). It opens only when the child asks; nothing is recorded.
export function createBuildReviewPanel(doc, { random = Math.random } = {}) {
  const root = element(doc, 'section', 'gt-build-review'); root.hidden = true;
  root.setAttribute('aria-label', 'もじを ならべて ふくしゅう');
  const open = button(doc, '', () => start(), 'gt-button gt-build-open'); open.dataset.action = 'build-review';
  const note = element(doc, 'p', 'gt-build-note', 'まちがえた問題を、もじを ならべて こたえよう（記録には のこらないよ）');
  const work = element(doc, 'div', 'gt-build-work'); work.hidden = true;
  const count = element(doc, 'p', 'gt-build-count'), prompt = element(doc, 'p', 'gt-build-prompt'); prompt.tabIndex = -1;
  const sentence = element(doc, 'p', 'gt-build-sentence');
  const slots = element(doc, 'div', 'gt-build-slots'), tiles = element(doc, 'div', 'gt-build-tiles');
  const say = element(doc, 'p', 'gt-build-say'); say.setAttribute('role', 'status');
  const next = button(doc, 'つぎへ', () => { review.next(); render(); focusFirst(); }, 'gt-button gt-primary'); next.dataset.action = 'build-next';
  work.append(count, prompt, sentence, slots, tiles, say, next);
  root.append(open, note, work);
  let review = null, key = null;

  const start = () => { open.hidden = true; note.hidden = true; work.hidden = false; render(); focusFirst(); };
  // When it is done the next button hides: the focus stays in the panel, on the closing words.
  const focusFirst = () => (tiles.querySelector('button:not(:disabled)') ?? (next.hidden ? prompt : next)).focus?.({ preventScroll: true });
  function render() {
    const s = review.snapshot();
    if (s.status === 'done') {
      count.textContent = ''; prompt.textContent = `${s.total}問 ぜんぶ ならべられたね！`; sentence.replaceChildren(); sentence.hidden = true;
      slots.replaceChildren(); tiles.replaceChildren();
      say.textContent = s.firstTry === s.total ? '1回目で ぜんぶ できたよ。おぼえたね！' : 'もういちど たしかめられたね。';
      next.hidden = true; root.dataset.status = 'done'; return;
    }
    root.dataset.status = s.status;
    count.textContent = `ふくしゅう ${s.index + 1} / ${s.total}`;
    prompt.textContent = s.prompt; sentence.hidden = !s.sentence;
    sentence.replaceChildren(...(s.sentence ? [element(doc, 'span', '', s.sentence.before), element(doc, 'b', '', s.prompt.match(/「(.+?)」/)?.[1] ?? ''), element(doc, 'span', '', s.sentence.after)] : []));
    slots.replaceChildren(...Array.from({ length: s.length }, (_, k) => {
      const filled = k < s.placed.length;
      const slot = button(doc, filled ? s.tiles[s.placed[k]] : '', () => { if (review.unplace(k)) render(); }, 'gt-build-slot');
      slot.disabled = !filled || s.status !== 'building';
      slot.setAttribute('aria-label', filled ? `${k + 1}文字目 ${s.tiles[s.placed[k]]}（おすと もどす）` : `${k + 1}文字目`);
      return slot;
    }));
    tiles.replaceChildren(...s.tiles.map((ch, k) => {
      const tile = button(doc, ch, () => { if (review.place(k)) { render(); focusFirst(); } }, 'gt-build-tile');
      tile.disabled = s.placed.includes(k) || s.status !== 'building';
      if (k === s.hintTile) tile.dataset.hint = 'true';
      return tile;
    }));
    const last = s.last;
    say.textContent = s.status === 'solved' ? `できた！ ${s.explain ?? `「${s.shownAnswer}」`}`
      : last && !last.correct ? `「${last.word}」ではなかったよ。${last.wrongAt}文字目は「${last.expected}」。光る カードから つづけよう${s.shownAnswer ? `（こたえ：${s.shownAnswer}）` : ''}`
      : s.placed.length === 0 && s.chosen ? `ゲームでは「${s.chosen}」をえらんだよ。カードを じゅんに おそう` : '';
    next.hidden = s.status !== 'solved';
    next.textContent = s.index + 1 < s.total ? 'つぎへ' : 'おわる';
  }
  return {
    root,
    // The run's missed list (entries with `build`); shown once per result.
    sync(missed, runKey) {
      if (runKey === key) return;
      key = runKey;
      review = createBuildReview({ missed: missed ?? [], random });
      const total = review.snapshot().total;
      root.hidden = !total; open.hidden = false; note.hidden = false; work.hidden = true;
      open.textContent = `もじを ならべて ふくしゅう（${total}問）`;
    },
    hide() { root.hidden = true; key = null; },
  };
}
