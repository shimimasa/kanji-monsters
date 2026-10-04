import { element, button, companionPortrait, typeChip } from './adventureUI.js';
import { REGIONS, regionName } from '../minigames/breedingRegions.js';
import { BREED_LEVEL } from '../minigames/gotomonBreeding.js';
import { typeInfo } from '../minigames/gotomonTypes.js';

// はいごう: the legends of one region at a time, each with its fixed recipe. A legend not met yet is a
// shadow; its recipe shows once the child has a Gotomon from that region. When both sides are there,
// the child picks the two parents and meets the legend (the parents stay).
export function createBreedingDialog({ doc, service, onSelect, onClose }) {
  const dialog = element(doc, 'dialog', 'yt-companion-dialog yt-breeding');
  dialog.setAttribute('aria-label', 'はいごう');
  const header = element(doc, 'div', 'yt-picker-header');
  header.append(element(doc, 'h2', '', 'はいごう'), button(doc, '閉じる', () => dialog.close()));
  const count = element(doc, 'p', 'yt-breeding-count');
  const note = element(doc, 'p', 'yt-note', `Lv${BREED_LEVEL}の ゴトモン 2ひきを かけあわせると、伝説の ゴトモンに 会えるよ。` +
    'レシピは きまっていて、親の 2ひきは いなくならない。');
  const label = element(doc, 'label', 'yt-memory-picker', '地方');
  const select = element(doc, 'select'); select.setAttribute('aria-label', '地方');
  label.append(select);
  const news = element(doc, 'p', 'yt-breeding-news'); news.setAttribute('role', 'status'); news.hidden = true;
  const list = element(doc, 'ul', 'yt-breeding-list');
  dialog.append(header, count, note, label, news, list);

  let book = service.getBreedingBook(), region = null, choosing = null;
  // Start where something can be made, else the newest region the child knows.
  const startRegion = () => book.legends.find(item => item.pair && item.revealed)?.recipe.region
    ?? [...book.legends].reverse().find(item => item.revealed)?.recipe.region ?? REGIONS[0].id;
  const side = (recipe, which) => {
    const span = element(doc, 'span', 'yt-breeding-side');
    if (which === 'a') span.append(element(doc, 'span', '', `${regionName(recipe.region)}の`));
    span.append(typeChip(doc, recipe[which]), element(doc, 'span', '', `Lv${BREED_LEVEL}`));
    return span;
  };
  const render = () => {
    const met = book.legends.filter(item => item.owned).length;
    count.textContent = `伝説の ゴトモン ${met} / ${book.legends.length}ひき なかま`;
    select.replaceChildren(...REGIONS.map(item => {
      const legends = book.legends.filter(entry => entry.recipe.region === item.id);
      const ready = legends.filter(entry => entry.pair).length;
      const option = element(doc, 'option', '', `${item.name}（${legends.filter(entry => entry.owned).length}/${legends.length}${ready ? ` · いま ${ready}ひき` : ''}）`);
      option.value = item.id; return option;
    }));
    select.value = region;
    list.replaceChildren(...book.legends.filter(item => item.recipe.region === region).map(item => {
      const row = element(doc, 'li', 'yt-breeding-card'); row.dataset.legendId = item.gotomon.id;
      row.dataset.state = item.owned ? 'met' : item.pair ? 'ready' : 'waiting';
      const portrait = companionPortrait(doc, item.gotomon); portrait.classList.toggle('yt-breeding-shadow', !item.owned);
      // A shadow keeps its name a secret (also from the picture's text).
      if (!item.owned) { portrait.querySelector('img')?.setAttribute('alt', 'まだ 会っていない ゴトモン'); portrait.querySelector('.gt-image-fallback').textContent = '？'; }
      const body = element(doc, 'div', 'yt-breeding-body');
      body.append(element(doc, 'strong', '', item.owned ? item.gotomon.name : '？？？'));
      const recipe = element(doc, 'p', 'yt-breeding-recipe');
      if (item.revealed || item.owned) recipe.append(side(item.recipe, 'a'), element(doc, 'span', 'yt-breeding-plus', '＋'), side(item.recipe, 'b'));
      else recipe.append(element(doc, 'span', '', `${regionName(item.recipe.region)}の ゴトモンを なかまにすると、レシピが わかるよ`));
      body.append(recipe);
      if (item.owned) body.append(element(doc, 'small', '', item.bred ? 'はいごうで 会えた なかま' : 'なかま！'));
      else if (item.revealed && !item.pair) {
        const missing = [];
        if (!item.a.length) missing.push(`${regionName(item.recipe.region)}の ${typeLabel(item.recipe.a)}`);
        if (!item.b.length || (item.a.length === 1 && item.b.length === 1 && item.a[0].id === item.b[0].id)) missing.push(typeLabel(item.recipe.b));
        body.append(element(doc, 'small', '', `Lv${BREED_LEVEL}の ${missing.join('と ')}が まだ いないよ（ミニゲームで そだてよう）`));
      }
      row.append(portrait, body);
      if (item.pair && item.revealed) {
        if (choosing === item.gotomon.id) row.append(chooser(item));
        else { const go = button(doc, 'はいごうする', () => { choosing = item.gotomon.id; render(); }, 'yt-primary'); go.dataset.action = 'breed'; row.append(go); }
      }
      return row;
    }));
  };
  const typeLabel = type => typeInfo(type).name;
  // The two parents: the first pair that works is chosen; either side can be changed.
  const chooser = item => {
    const box = element(doc, 'div', 'yt-breeding-chooser');
    let [left, right] = item.pair;
    const pick = (which, options, value, onChange) => {
      const wrap = element(doc, 'label', 'yt-memory-picker', which === 'a' ? `${regionName(item.recipe.region)}の ${typeLabel(item.recipe.a)}` : typeLabel(item.recipe.b));
      const field = element(doc, 'select'); field.setAttribute('aria-label', which === 'a' ? '親1' : '親2');
      for (const friend of options) { const option = element(doc, 'option', '', `${friend.name}（Lv${friend.level}）`); option.value = friend.id; field.append(option); }
      field.value = value; field.onchange = () => onChange(field.value); wrap.append(field); return wrap;
    };
    const warn = element(doc, 'p', 'yt-note'); warn.setAttribute('role', 'status');
    const confirm = button(doc, 'この 2ひきで はいごう', () => {
      if (left === right) { warn.textContent = 'ちがう 2ひきを えらんでね。'; return; }
      const result = service.breed({ legendId: item.gotomon.id, parentA: left, parentB: right });
      if (!result.ok) { warn.textContent = 'はいごうできませんでした。もう一度 ためしてね。'; return; }
      const names = [left, right].map(id => book.friends.find(friend => friend.id === id)?.name);
      choosing = null; book = service.getBreedingBook();
      news.replaceChildren(element(doc, 'strong', '', `${result.gotomon.name}が なかまに なった！`),
        element(doc, 'span', '', ` ${names.join('と ')}も いっしょだよ。`));
      const make = button(doc, 'あいぼうにする', () => onSelect?.(result.gotomon), 'yt-all-pick'); make.dataset.action = 'make-companion';
      news.append(make); news.hidden = false; render();
    }, 'yt-primary');
    confirm.dataset.action = 'confirm-breed';
    box.append(pick('a', item.a, left, value => { left = value; }), element(doc, 'span', 'yt-breeding-plus', '＋'),
      pick('b', item.b, right, value => { right = value; }), confirm, button(doc, 'やめる', () => { choosing = null; render(); }), warn);
    return box;
  };
  select.onchange = () => { region = select.value; choosing = null; render(); };
  region = startRegion();
  render();
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); }, { once: true });
  return dialog;
}
