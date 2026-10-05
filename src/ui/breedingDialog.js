import { element, button, companionPortrait, typeChip } from './adventureUI.js';
import { REGIONS, regionName } from '../minigames/breedingRegions.js';
import { BREED_LEVEL } from '../minigames/gotomonBreeding.js';
import { typeInfo } from '../minigames/gotomonTypes.js';

const CSS = `
#yt-breeding-room{width:min(1000px,calc(100vw - 20px));max-height:calc(100dvh - 20px);padding:0;background:#123b38;color:#fff;border:3px solid #f5cf75;overflow:auto}
#yt-breeding-room .yt-breed-inner{padding:clamp(14px,3vw,24px);background:radial-gradient(circle at 50% 0,#438a75 0,#174d49 48%,#10342f 100%)}
#yt-breeding-room .yt-breed-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
#yt-breeding-room h2{margin:0;color:#fff3bd;font-size:clamp(26px,5vw,40px)}
#yt-breeding-room .yt-breed-lead{margin:10px 0 12px;font-weight:800;line-height:1.55}
#yt-breeding-room .yt-breed-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 14px;padding:0;list-style:none}
#yt-breeding-room .yt-breed-steps li{padding:9px 7px;border:1px solid #8bc6ac;border-radius:12px;background:#123e3b;text-align:center;font-size:14px;font-weight:800}
#yt-breeding-room .yt-breed-region{display:flex;align-items:center;gap:10px;margin:8px 0 12px;font-weight:800}
#yt-breeding-room .yt-breed-region select,#yt-breeding-room .yt-breed-chooser select{min-height:44px;padding:7px 10px;border:2px solid #a9cfbe;border-radius:10px;background:#fff;color:#15362c;font:inherit}
#yt-breeding-room .yt-breeding-count{margin:0 0 10px;color:#fff3bd;font-weight:800}
#yt-breeding-room .yt-breeding-list{display:grid;gap:10px;margin:0;padding:0;list-style:none}
#yt-breeding-room .yt-breeding-card{display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px;border:2px solid #8bc6ac;border-radius:16px;background:#f7fff8;color:#15362c}
#yt-breeding-room .yt-breeding-card[data-state=ready]{border-color:#ffd66e}
#yt-breeding-room .yt-breeding-card .gt-portrait{width:68px;height:68px}
#yt-breeding-room .yt-breeding-shadow{filter:brightness(.15) saturate(.35)}
#yt-breeding-room .yt-breeding-body{min-width:0}
#yt-breeding-room .yt-breeding-body>strong{display:block;font-size:19px}
#yt-breeding-room .yt-breeding-recipe{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:7px 0 0;line-height:1.45}
#yt-breeding-room .yt-breeding-side{display:inline-grid;justify-items:center;gap:3px;padding:5px 8px;border-radius:10px;background:#eaf4ed;font-size:12px;font-weight:800}
#yt-breeding-room .yt-breeding-side .yt-type-chip{font-size:14px}
#yt-breeding-room .yt-breeding-plus{color:#39735b;font-size:23px;font-weight:900}
#yt-breeding-room .yt-breeding-body small{display:block;margin-top:8px;line-height:1.5}
#yt-breeding-room .yt-breed-action{min-height:48px;padding:8px 14px;border:0;border-radius:12px;background:#ffcf54;color:#3d2900;font:inherit;font-weight:900;cursor:pointer;box-shadow:0 4px 0 #9b6c17}
#yt-breeding-room .yt-breeding-chooser{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;align-items:end;gap:10px;padding:12px;border-radius:14px;background:#eaf4ed}
#yt-breeding-room .yt-breed-chooser-title{grid-column:1/-1;margin:0;font-weight:900;line-height:1.5}
#yt-breeding-room .yt-breed-parent-field{display:grid;gap:5px;font-size:14px;font-weight:800}
#yt-breeding-room .yt-breed-selected{display:flex;align-items:center;gap:8px;min-height:54px;padding:6px;border:1px solid #bed8c9;border-radius:10px;background:#fff}
#yt-breeding-room .yt-breed-selected .gt-portrait{width:44px;height:44px}
#yt-breeding-room .yt-breed-selected small{display:block;color:#426252}
#yt-breeding-room .yt-breed-confirm{grid-column:1/-1;min-height:54px;padding:9px 18px;border:0;border-radius:13px;background:#ffcf54;color:#3d2900;font:inherit;font-size:18px;font-weight:900;cursor:pointer;box-shadow:0 4px 0 #9b6c17}
#yt-breeding-room .yt-breed-cancel{min-height:44px;border:2px solid #41735d;border-radius:10px;background:#fff;color:#15362c;font:inherit;font-weight:800;cursor:pointer}
#yt-breeding-room .yt-breed-warning{grid-column:1/-1;margin:0;color:#853e23;font-weight:800}
#yt-breeding-room .yt-breeding-news{margin:0 0 12px;padding:12px;border:2px solid #ffd66e;border-radius:14px;background:#fff4cb;color:#3d2900;line-height:1.6}
#yt-breeding-room .yt-breeding-news strong,#yt-breeding-room .yt-breeding-news span{display:block}
#yt-breeding-room .yt-breed-make{min-height:44px;margin-top:8px;padding:8px 14px;border:0;border-radius:10px;background:#39735b;color:#fff;font:inherit;font-weight:900;cursor:pointer}
#yt-breeding-room .yt-breed-foot{margin:14px 0 0;color:#e8f7ee;font-size:14px;line-height:1.55}
@media(max-width:620px){#yt-breeding-room .yt-breed-steps{grid-template-columns:1fr 1fr}#yt-breeding-room .yt-breeding-card{grid-template-columns:54px minmax(0,1fr);gap:8px;padding:9px}#yt-breeding-room .yt-breeding-card>.yt-breed-action{grid-column:1/-1;width:100%}#yt-breeding-room .yt-breeding-card .gt-portrait{width:50px;height:50px}#yt-breeding-room .yt-breeding-chooser{grid-template-columns:1fr}#yt-breeding-room .yt-breed-chooser-title,#yt-breeding-room .yt-breed-confirm,#yt-breeding-room .yt-breed-warning{grid-column:1}}
`;

// The fixed recipe is shown only after the child has met a Gotomon from that region.
export function createBreedingDialog({ doc, service, onSelect, onClose }) {
  const dialog = element(doc, 'dialog', 'yt-companion-dialog yt-breeding');
  dialog.id = 'yt-breeding-room';
  dialog.setAttribute('aria-label', 'はいごうのへや');
  const style = element(doc, 'style'); style.textContent = CSS; dialog.append(style);
  const inner = element(doc, 'div', 'yt-breed-inner'); dialog.append(inner);
  const header = element(doc, 'header', 'yt-breed-head');
  header.append(element(doc, 'h2', '', 'はいごうのへや'), button(doc, '広場へもどる', () => dialog.close()));
  const lead = element(doc, 'p', 'yt-breed-lead', `レベル${BREED_LEVEL}以上の べつべつの あいぼう2ひきが そろったら、伝説の ゴトモンに 会えるよ。`);
  const steps = element(doc, 'ol', 'yt-breed-steps');
  ['地方をえらぶ', '伝説をえらぶ', 'おや2ひきをえらぶ', 'であわせる！'].forEach((label, index) => {
    steps.append(element(doc, 'li', '', `${index + 1}. ${label}`));
  });
  const note = element(doc, 'p', 'yt-breed-foot',
    'レシピはきまっているよ。地方のタイプと、どこでもよいタイプを1ひきずつえらぼう。おやの2ひきは、いなくならずレベルもそのまま。');
  const count = element(doc, 'p', 'yt-breeding-count');
  const label = element(doc, 'label', 'yt-breed-region', '1. 地方をえらぶ');
  const select = element(doc, 'select'); select.setAttribute('aria-label', '配合する地方'); label.append(select);
  const news = element(doc, 'div', 'yt-breeding-news'); news.setAttribute('role', 'status'); news.setAttribute('aria-live', 'polite'); news.hidden = true;
  const list = element(doc, 'ul', 'yt-breeding-list');
  inner.append(header, lead, steps, note, label, count, news, list);

  let book = service.getBreedingBook(), region = null, choosing = null, parents = null;
  const startRegion = () => book.legends.find(item => item.pair && item.revealed)?.recipe.region
    ?? [...book.legends].reverse().find(item => item.revealed)?.recipe.region ?? REGIONS[0].id;
  const side = (recipe, which) => {
    const span = element(doc, 'span', 'yt-breeding-side');
    span.append(element(doc, 'span', '', which === 'a' ? `${regionName(recipe.region)}で` : 'どこでも'),
      typeChip(doc, recipe[which]), element(doc, 'span', '', `Lv${BREED_LEVEL}以上`));
    return span;
  };
  const parentCard = id => {
    const friend = book.friends.find(item => item.id === id);
    if (!friend) return element(doc, 'span', 'yt-breed-selected', 'あいぼうをえらんでね');
    const summary = element(doc, 'span', 'yt-breed-selected');
    summary.append(companionPortrait(doc, friend), element(doc, 'span', '', ''));
    summary.lastChild.append(element(doc, 'strong', '', friend.name),
      element(doc, 'small', '', `Lv${friend.level}・${regionName(friend.region)}`));
    return summary;
  };
  const render = () => {
    const met = book.legends.filter(item => item.owned).length;
    count.textContent = `伝説の ゴトモン：${met} / ${book.legends.length}ひきと なかま`;
    select.replaceChildren(...REGIONS.map(item => {
      const legends = book.legends.filter(entry => entry.recipe.region === item.id);
      const ready = legends.filter(entry => entry.pair).length;
      const option = element(doc, 'option', '', `${item.name}（なかま ${legends.filter(entry => entry.owned).length}/${legends.length}${ready ? `・はいごうできる ${ready}` : ''}）`);
      option.value = item.id; return option;
    }));
    select.value = region;
    list.replaceChildren(...book.legends.filter(item => item.recipe.region === region).map(item => {
      const row = element(doc, 'li', 'yt-breeding-card'); row.dataset.legendId = item.gotomon.id;
      row.dataset.state = item.owned ? 'met' : item.pair ? 'ready' : 'waiting';
      const portrait = companionPortrait(doc, item.gotomon); portrait.classList.toggle('yt-breeding-shadow', !item.owned);
      if (!item.owned) {
        portrait.querySelector('img')?.setAttribute('alt', 'まだ 会っていない ゴトモン');
        portrait.querySelector('.gt-image-fallback').textContent = '？';
      }
      const body = element(doc, 'div', 'yt-breeding-body');
      body.append(element(doc, 'strong', '', item.owned ? item.gotomon.name : '？？？'));
      const recipe = element(doc, 'p', 'yt-breeding-recipe');
      if (item.revealed || item.owned) recipe.append(side(item.recipe, 'a'), element(doc, 'span', 'yt-breeding-plus', '＋'), side(item.recipe, 'b'));
      else recipe.append(element(doc, 'span', '', `${regionName(item.recipe.region)}の ゴトモンと なかまになると、レシピが わかるよ。`));
      body.append(recipe);
      if (item.owned) body.append(element(doc, 'small', '', item.bred ? 'はいごうで 会えたなかま' : '冒険で なかまになったよ'));
      else if (item.revealed && !item.pair) {
        const aCount = item.a?.length || 0, bCount = item.b?.length || 0;
        body.append(element(doc, 'small', '', `おや候補：地方の ${typeInfo(item.recipe.a).name} ${aCount}ひき・どこでも ${typeInfo(item.recipe.b).name} ${bCount}ひき。レベル${BREED_LEVEL}以上の あいぼうを そだてよう。`));
      }
      row.append(portrait, body);
      if (item.pair && item.revealed) {
        if (choosing === item.gotomon.id) row.append(chooser(item));
        else {
          const go = button(doc, 'おやをえらぶ', () => { choosing = item.gotomon.id; parents = [...item.pair]; render(); }, 'yt-breed-action');
          go.dataset.action = 'breed'; row.append(go);
        }
      }
      return row;
    }));
  };
  const chooser = item => {
    const box = element(doc, 'div', 'yt-breeding-chooser');
    const title = element(doc, 'p', 'yt-breed-chooser-title', '3. おやにする2ひきをえらぼう。えらんだあと「であわせる！」をおすと、伝説のなかまに会えるよ。');
    const pick = (which, options, index) => {
      const isA = which === 'a';
      const wrap = element(doc, 'label', 'yt-breed-parent-field', isA
        ? `${regionName(item.recipe.region)}の ${typeInfo(item.recipe.a).name}タイプ（Lv${BREED_LEVEL}以上）`
        : `どこでもよい ${typeInfo(item.recipe.b).name}タイプ（Lv${BREED_LEVEL}以上）`);
      const field = element(doc, 'select'); field.setAttribute('aria-label', isA ? '配合する親1' : '配合する親2');
      for (const friend of options) {
        const option = element(doc, 'option', '', `${friend.name}（Lv${friend.level}・${regionName(friend.region)}）`);
        option.value = friend.id; field.append(option);
      }
      field.value = parents[index];
      field.onchange = () => { parents[index] = field.value; render(); };
      wrap.append(field, parentCard(field.value)); return wrap;
    };
    const warning = element(doc, 'p', 'yt-breed-warning'); warning.setAttribute('role', 'status');
    const confirm = button(doc, '4. この2ひきで であわせる！', () => {
      const [left, right] = parents;
      if (left === right) { warning.textContent = 'ちがう2ひきを えらんでね。'; return; }
      const result = service.breed({ legendId: item.gotomon.id, parentA: left, parentB: right });
      if (!result.ok) { warning.textContent = 'もう一度 おやをえらんでみよう。'; return; }
      const names = parents.map(id => book.friends.find(friend => friend.id === id)?.name || 'あいぼう');
      choosing = null; parents = null; book = service.getBreedingBook();
      news.replaceChildren(
        element(doc, 'strong', '', `${result.gotomon.name}が なかまに なった！`),
        element(doc, 'span', '', `${names.join('と ')}が いっしょに 会いにきたよ。おやの2ひきも そのまま いっしょ！`));
      const make = button(doc, 'この子を あいぼうにする', () => onSelect?.(result.gotomon), 'yt-breed-make');
      make.dataset.action = 'make-companion'; news.append(make); news.hidden = false; render();
      news.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }, 'yt-breed-confirm');
    confirm.dataset.action = 'confirm-breed';
    const cancel = button(doc, 'やめる', () => { choosing = null; parents = null; render(); }, 'yt-breed-cancel');
    box.append(title, pick('a', item.a, 0), pick('b', item.b, 1), confirm, cancel, warning);
    return box;
  };
  select.onchange = () => { region = select.value; choosing = null; parents = null; render(); };
  region = startRegion();
  render();
  dialog.addEventListener('close', () => { dialog.remove(); onClose?.(); }, { once: true });
  return dialog;
}
