import { ENERGY_CAPACITY, VOLTAGE_LEVELS, SPEED_NAMES, compareLamps,
  simulateLightPlan, ELECTION_ERAS, PROPOSALS, turnoutTally, ballotTally } from './lesson-model-v2.js';

const slug = document.body.dataset.lesson;
const root = document.getElementById('lesson-game');
const isScience = slug === 'kururu';
const guide = isScience ? 'クルル' : 'ヒョウ';
const portrait = `/assets/images/monsters/full/lesson/${isScience ? 'EL-001' : 'EL-002'}.svg`;
const stageTitles = isScience
  ? ['発電機を動かそう', '電気を夜へ運ぼう', '光る時間を比べよう', 'センサーを組もう', '夜の小道を照らそう']
  : ['村の声を集めよう', '一票の歴史を見よう', 'ひみつの投票所を作ろう', '参加人数と開票を比べよう', '自分の一票を入れよう'];
let stageIndex = -1;

const node = (tag, className = '', content = '') => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (content) element.textContent = content;
  return element;
};
const button = (label, handler, className = '') => {
  const element = node('button', `lgv-button ${className}`, label);
  element.type = 'button';
  element.addEventListener('click', handler);
  return element;
};
const clear = (target, ...children) => target.replaceChildren(...children);
const paragraph = (text, className = '') => node('p', className, text);
const meter = (label, amount, maximum = ENERGY_CAPACITY) => {
  const wrap = node('div', 'lgv-meter-wrap');
  wrap.append(node('span', '', label));
  const track = node('div', 'lgv-meter');
  const fill = node('span', 'lgv-meter-fill');
  fill.style.width = `${Math.round(Math.max(0, amount) / maximum * 100)}%`;
  track.append(fill);
  wrap.append(track, node('strong', '', `${Math.max(0, amount)}/${maximum}`));
  return wrap;
};

function frame(title, lead, progress) {
  clear(root);
  const shell = node('div', 'lgv-shell');
  const top = node('header', 'lgv-top');
  top.append(node('span', 'lgv-subject', isScience ? '理科の旅' : '社会の旅'),
    node('span', 'lgv-progress', progress));
  const hero = node('div', 'lgv-hero');
  const image = node('img', 'lgv-portrait');
  image.src = portrait;
  image.alt = guide;
  const words = node('div', 'lgv-hero-words');
  words.append(node('span', 'lgv-name', guide), node('h1', '', title), paragraph(lead));
  hero.append(image, words);
  shell.append(top, hero);
  root.append(shell);
  return shell;
}

function stageShell(title, lead) {
  const shell = frame(title, lead, `${stageIndex + 1} / 5 の発見`);
  const board = node('section', 'lgv-board');
  const play = node('div', 'lgv-play');
  const controls = node('div', 'lgv-controls');
  const note = node('div', 'lgv-note', '動かして、変化を見てみよう。');
  note.setAttribute('role', 'status');
  note.setAttribute('aria-live', 'polite');
  const footer = node('div', 'lgv-footer');
  const discovery = paragraph('条件を変えて、もう一度試せるよ。', 'lgv-discovery');
  const next = button(stageIndex === 4 ? 'まとめへすすむ' : '星を受け取ってすすむ', () => {
    if (next.disabled) return;
    window.recordBadge?.(stageIndex + 1, 5);
    stageIndex += 1;
    if (stageIndex === 5) renderSummary();
    else renderStage();
  }, 'lgv-primary lgv-next');
  next.disabled = true;
  footer.append(discovery, next);
  board.append(play, controls, note, footer);
  shell.append(board);
  return {
    play, controls, note,
    say(message) { note.textContent = message; },
    unlock(message) { next.disabled = false; discovery.textContent = message; },
  };
}

function choiceGroup(target, options, selected, onSelect) {
  clear(target);
  for (const option of options) {
    const control = button(option.label, () => onSelect(option.value), `lgv-option ${selected === option.value ? 'is-selected' : ''}`);
    control.setAttribute('aria-pressed', String(selected === option.value));
    target.append(control);
  }
}

function timeline(ticks) {
  const line = node('div', 'lgv-timeline');
  for (const tick of ticks) {
    const cell = node('div', `lgv-tick ${tick.dark ? 'is-night' : 'is-day'} ${tick.lit ? 'is-lit' : ''}`);
    cell.append(node('span', '', tick.dark ? '🌙' : '☀️'), node('strong', '', tick.lit ? '💡' : '·'), node('small', '', tick.label));
    line.append(cell);
  }
  return line;
}

function tallyChart(votes) {
  const chart = node('div', 'lgv-tally');
  const maximum = Math.max(...Object.values(votes));
  for (const proposal of PROPOSALS) {
    const count = votes[proposal.id];
    const row = node('div', 'lgv-tally-row');
    const track = node('div', 'lgv-tally-track');
    const fill = node('span', 'lgv-tally-fill');
    fill.style.width = `${Math.round(count / maximum * 100)}%`;
    track.append(fill);
    row.append(node('span', '', `${proposal.icon} ${proposal.name}`), track, node('strong', '', `${count}票`));
    chart.append(row);
  }
  return chart;
}

function renderOpening() {
  const shell = frame(isScience ? '夜の小道に光をとどけよう' : 'ひとつぶ村の未来を選ぼう',
    isScience ? 'ジッケルと電気を作って、ためて、使ってみよう。小道を照らす方法は、実験で見つけられるよ。'
      : '村を歩いて3人の願いを聞こう。投票のしくみを試してから、自分の一票を考えよう。',
    'ゴトモンと5つの発見');
  const intro = node('section', 'lgv-board lgv-intro');
  const trail = node('div', 'lgv-intro-art', isScience ? '⚙️ → 🔋 → 💡 → 🌙' : '🏘️ → 🕰️ → 🗳️ → 📊');
  intro.append(trail, paragraph('予想と違う結果も発見。何度でも試せるよ。'),
    button('いっしょに始める', () => { stageIndex = 0; renderStage(); }, 'lgv-primary'));
  shell.append(intro);
}

function renderKururuCrank() {
  const ui = stageShell(stageTitles[0], '速さを変え、同じ3回だけ回して電圧計を比べよう。');
  let speed = 'slow', turns = 0, rotation = 0;
  const records = new Set();
  const dial = node('div', 'lgv-segments');
  const machine = node('div', 'lgv-machine');
  const wheel = button('↻', () => {
    turns = Math.min(3, turns + 1);
    rotation += speed === 'fast' ? 145 : speed === 'middle' ? 95 : 55;
    wheel.style.setProperty('--turn', `${rotation}deg`);
    gauge.style.width = `${VOLTAGE_LEVELS[speed]}%`;
    gaugeLabel.textContent = `電圧計の針: ${SPEED_NAMES[speed]}回すと ${speed === 'fast' ? '高い' : speed === 'slow' ? '低い' : '中くらい'}`;
    count.textContent = `${turns} / 3 回`;
    if (turns === 3) {
      records.add(speed);
      observations.textContent = [...records].map(key => `${SPEED_NAMES[key]}: ${key === 'fast' ? '高い' : key === 'slow' ? '低い' : '中くらい'}`).join('　｜　');
      ui.say(`${SPEED_NAMES[speed]}速さで3回回したよ。別の速さでも比べよう。`);
      if (records.size >= 2) ui.unlock('同じ発電機では、速く回すほど電圧計の針が大きく動いたね。');
    }
  }, 'lgv-wheel');
  wheel.setAttribute('aria-label', '発電機を1回回す');
  const count = node('strong', 'lgv-count', '0 / 3 回');
  const gaugeBox = node('div', 'lgv-gauge');
  const gauge = node('span', 'lgv-gauge-fill');
  gaugeBox.append(gauge);
  const gaugeLabel = paragraph('速さを選んで、発電機を回そう。', 'lgv-readout');
  machine.append(node('span', 'lgv-spark', '⚡'), wheel, count, gaugeBox, gaugeLabel);
  const observations = node('div', 'lgv-observations', '観察カードはここに並ぶよ');
  ui.play.append(machine, observations);
  ui.controls.append(paragraph('回す速さを選ぶ', 'lgv-control-label'), dial);
  const drawDial = () => choiceGroup(dial, [
    { value: 'slow', label: '🐢 ゆっくり' }, { value: 'middle', label: '🔄 ふつう' }, { value: 'fast', label: '⚡ はやく' },
  ], speed, value => { speed = value; turns = 0; count.textContent = '0 / 3 回'; drawDial(); ui.say(`${SPEED_NAMES[speed]}速さで、3回回してみよう。`); });
  drawDial();
}

function renderKururuRoute() {
  const ui = stageShell(stageTitles[1], '昼に作った電気を、夜に使うにはどこへ送ればよいかな？');
  let route = 'lamp', dayDone = false;
  const seen = new Set();
  const wire = node('div', 'lgv-wire-world');
  const day = node('div', 'lgv-world-panel', '☀️ 昼　発電機 → ？');
  const night = node('div', 'lgv-world-panel is-night', '🌙 夜　まだ見ていないよ');
  wire.append(day, node('div', 'lgv-wire', '⚡ ⚡ ⚡'), night);
  const routes = node('div', 'lgv-segments');
  const runDay = button('昼に電気を流す', () => {
    dayDone = true;
    day.textContent = route === 'store' ? '☀️ 昼　コンデンサーにたまった 🔋' : '☀️ 昼　ランプが光った 💡';
    night.textContent = '🌙 夜　まだ見ていないよ';
    ui.say('電気の行き先が見えたね。「夜にする」で確かめよう。');
  }, 'lgv-action');
  const runNight = button('夜にする', () => {
    if (!dayDone) { ui.say('先に昼の電気を流そう。'); return; }
    night.textContent = route === 'store' ? '🌙 夜　ためた電気で光った 💡' : '🌙 夜　昼に使ったので残っていない';
    seen.add(route);
    ui.say(route === 'store' ? '昼にためた電気を、夜に取り出せたよ。' : '昼に光ったね。夜にも使う方法を試してみよう。');
    if (seen.size === 2) ui.unlock('コンデンサーにためると、作った時とは違う時に電気を使える。');
  }, 'lgv-action');
  ui.play.append(wire);
  ui.controls.append(paragraph('電気の行き先をつなぐ', 'lgv-control-label'), routes, runDay, runNight);
  const drawRoutes = () => choiceGroup(routes, [
    { value: 'lamp', label: '発電機 → ランプ 💡' }, { value: 'store', label: '発電機 → コンデンサー 🔋' },
  ], route, value => { route = value; dayDone = false; day.textContent = '☀️ 昼　発電機 → ？'; night.textContent = '🌙 夜　まだ見ていないよ'; drawRoutes(); });
  drawRoutes();
}

function renderKururuCompare() {
  const ui = stageShell(stageTitles[2], '同じ量の電気をためたよ。時間を進めて、2つの明かりを観察しよう。');
  let tick = 0, prediction = null;
  const predictions = node('div', 'lgv-segments');
  const comparison = node('div', 'lgv-comparison');
  const clock = node('strong', 'lgv-clock');
  const update = () => {
    const values = compareLamps(tick);
    clock.textContent = `⏱️ ${tick}目盛すすんだ`;
    clear(comparison);
    for (const [key, label, amount] of [['bulb', '豆電球', values.bulb], ['led', 'LED', values.led]]) {
      const card = node('div', `lgv-lamp-card ${amount ? 'is-on' : 'is-off'}`);
      card.append(node('span', 'lgv-lamp-icon', amount ? '💡' : '○'), node('strong', '', label), meter('残り', amount));
      comparison.append(card);
    }
    if (tick >= 4) ui.unlock('同じ電気で比べると、この実験ではLEDが長く光った。');
    if (tick) ui.say(values.bulb === 0 && values.led > 0
      ? '豆電球は消えたけれど、LEDはまだ光っているね。' : '2つの残りの電気を見比べてみよう。');
  };
  ui.play.append(clock, comparison);
  ui.controls.append(paragraph('どちらが長く光ると予想する？', 'lgv-control-label'), predictions,
    button('時間を1目盛進める', () => { tick = Math.min(6, tick + 1); update(); }, 'lgv-action'),
    button('同じ電気でもう一度', () => { tick = 0; update(); ui.say('同じ12目盛から比べ直せるよ。'); }));
  const drawPredictions = () => choiceGroup(predictions, [
    { value: 'bulb', label: '豆電球だと思う' }, { value: 'led', label: 'LEDだと思う' }, { value: 'same', label: '同じくらい' },
  ], prediction, value => { prediction = value; drawPredictions(); ui.say('予想を置いたよ。時間を進めて確かめよう。'); });
  drawPredictions(); update();
}

function renderKururuSensor() {
  const ui = stageShell(stageTitles[3], '昼3目盛・夜4目盛。いつ点灯するかを変えて、同じ電気で比べよう。');
  let rule = 'always';
  const seen = new Set();
  const rules = node('div', 'lgv-segments');
  const result = node('div', 'lgv-simulation', '命令を組んで、一日を動かそう。');
  const run = button('この命令で一日を動かす', () => {
    const outcome = simulateLightPlan({ rule, lamp: 'led', store: true });
    clear(result, timeline(outcome.ticks), meter('残りの電気', outcome.remaining),
      paragraph(`夜に光ったのは 4目盛のうち ${outcome.nightLit}目盛`));
    seen.add(rule);
    ui.say(rule === 'always' ? '昼にも電気を使ったね。夜はどうなったかな？' : '暗い時だけ光ったよ。残りの電気を比べよう。');
    if (seen.size === 2) ui.unlock('「もし暗いなら点灯」という条件で、必要な時に電気を使える。');
  }, 'lgv-action');
  ui.play.append(result);
  ui.controls.append(paragraph('点灯する命令を選ぶ', 'lgv-control-label'), rules, run);
  const drawRules = () => choiceGroup(rules, [
    { value: 'always', label: 'いつも → 点灯' }, { value: 'dark', label: 'もし暗いなら → 点灯' },
  ], rule, value => { rule = value; drawRules(); });
  drawRules();
}

function renderKururuFinal() {
  const ui = stageShell(stageTitles[4], '部品を組み合わせて、夜の小道を4目盛の間、照らしてみよう。');
  const settings = { store: true, lamp: 'bulb', rule: 'always' };
  const groups = [node('div', 'lgv-segments'), node('div', 'lgv-segments'), node('div', 'lgv-segments')];
  const result = node('div', 'lgv-simulation', '組み合わせを選んで試運転しよう。');
  const renderGroups = () => {
    choiceGroup(groups[0], [{ value: false, label: '昼に直接使う' }, { value: true, label: 'ためて夜へ' }], settings.store,
      value => { settings.store = value; renderGroups(); });
    choiceGroup(groups[1], [{ value: 'bulb', label: '豆電球' }, { value: 'led', label: 'LED' }], settings.lamp,
      value => { settings.lamp = value; renderGroups(); });
    choiceGroup(groups[2], [{ value: 'always', label: 'いつも点灯' }, { value: 'dark', label: '暗い時だけ' }], settings.rule,
      value => { settings.rule = value; renderGroups(); });
  };
  ui.play.append(node('div', 'lgv-path', '🏠　💡　💡　💡　🌲'), result);
  ui.controls.append(paragraph('1 電気の行き先', 'lgv-control-label'), groups[0],
    paragraph('2 明かりの道具', 'lgv-control-label'), groups[1],
    paragraph('3 点灯の命令', 'lgv-control-label'), groups[2],
    button('小道で試運転する', () => {
      const outcome = simulateLightPlan(settings);
      clear(result, timeline(outcome.ticks), paragraph(`夜の小道は 4目盛のうち ${outcome.nightLit}目盛 光ったよ。`),
        meter('残りの電気', outcome.remaining));
      ui.say(outcome.nightLit === 4 ? '小道が夜の間ずっと光った！ほかの組み合わせも試せるよ。'
        : 'ここまでの明かりが見えたね。部品を変えてもう一度試せるよ。');
      ui.unlock('作る・ためる・使う方法を組み合わせて考えたね。結果にかかわらず、この発見は星になるよ。');
    }, 'lgv-action'));
  renderGroups();
}

function renderHyouVillage() {
  const ui = stageShell(stageTitles[0], '川、畑、分かれ道へ。好きな順に行って、3人の困りごとを確かめよう。');
  const seen = new Set();
  const map = node('div', 'lgv-village-map');
  const visit = node('div', 'lgv-visit', '場所を選んで村を歩こう。');
  const cards = node('div', 'lgv-wish-cards');
  for (const proposal of PROPOSALS) {
    map.append(button(`${proposal.icon} ${proposal.place}`, () => {
      const face = node('img', 'lgv-visitor'); face.src = proposal.image; face.alt = proposal.gotomon;
      clear(visit, face, node('h2', '', `${proposal.gotomon}のいる${proposal.place}`),
        button(proposal.action, () => {
          seen.add(proposal.id);
          clear(visit, face, node('h2', '', `${proposal.place}で見つけたこと`), paragraph(proposal.need), paragraph(proposal.wish));
          clear(cards);
          for (const found of PROPOSALS.filter(item => seen.has(item.id))) cards.append(node('span', 'lgv-wish-card', `${found.icon} ${found.name}`));
          ui.say(`${proposal.gotomon}の願いを聞いたよ。ほかの場所にも行ってみよう。`);
          if (seen.size === 3) ui.unlock('3人には違う願いがあり、それぞれに理由がある。');
        }, 'lgv-action'));
    }, 'lgv-place'));
  }
  ui.play.append(map, visit, cards);
}

function renderHyouHistory() {
  const ui = stageShell(stageTitles[1], '年を動かして、だれが投票できたかを見比べよう。');
  const seen = new Set();
  const years = node('div', 'lgv-history-years');
  const crowd = node('div', 'lgv-crowd');
  const info = node('div', 'lgv-history-info', '年を選ぶと、投票できる人が見えるよ。');
  ELECTION_ERAS.forEach((era, index) => {
    years.append(button(`${era.year}年`, () => {
      seen.add(era.year);
      clear(crowd);
      for (let person = 0; person < 12; person++) crowd.append(node('span', person < era.crowd ? 'is-eligible' : '', '●'));
      clear(info, node('strong', '', era.headline), paragraph(era.short),
        paragraph(`きまりが変わった年 ${era.year}年 ／ 最初の選挙 ${era.first}年`, 'lgv-small'));
      for (const [buttonIndex, control] of [...years.children].entries()) control.classList.toggle('is-selected', buttonIndex === index);
      ui.say('ほかの年も選んで、投票できる人の広がりを見よう。');
      if (seen.size === 4) ui.unlock('投票できる人は、長い歴史の中で広がってきた。');
    }, 'lgv-option'));
  });
  ui.play.append(years, crowd, info);
  ui.controls.append(paragraph('● は人数の実数ではなく、範囲の広がりを表す絵だよ。', 'lgv-small'));
}

function renderHyouBooth() {
  const ui = stageShell(stageTitles[2], '投票先を周りに見られずに入れるには、何を置けばよいかな？');
  const parts = new Set();
  const booth = node('div', 'lgv-booth');
  const partButtons = node('div', 'lgv-segments');
  const update = () => {
    clear(booth);
    for (const [id, icon, label] of [['desk', '📝', '受付'], ['screen', '🚪', 'ついたて'], ['box', '🗳️', '投票箱']]) {
      booth.append(node('div', `lgv-booth-part ${parts.has(id) ? 'is-placed' : ''}`, `${icon} ${label}`));
    }
    clear(partButtons);
    for (const [id, label] of [['desk', '受付'], ['screen', 'ついたて'], ['box', '投票箱']]) {
      const control = button(`${parts.has(id) ? '✓ ' : '+ '}${label}`, () => {
        if (parts.has(id)) parts.delete(id); else parts.add(id);
        update();
      }, 'lgv-option');
      control.setAttribute('aria-pressed', String(parts.has(id)));
      partButtons.append(control);
    }
  };
  ui.play.append(booth);
  ui.controls.append(paragraph('必要なものを置く・外す', 'lgv-control-label'), partButtons,
    button('投票するところを試す', () => {
      if (!parts.has('desk') || !parts.has('box')) { ui.say('受付と投票箱を置いてみよう。'); return; }
      if (!parts.has('screen')) { ui.say('投票先が周りから見えそう。ついたてを置くとどうなるかな？'); return; }
      ui.say('ついたての中で書いて、投票箱へ。だれに入れたかは周りから見えないね。');
      ui.unlock('秘密選挙は、投票先を知られず自分の考えを守る仕組み。');
    }, 'lgv-action'));
  update();
}

function renderHyouTurnout() {
  const ui = stageShell(stageTitles[3], '村の20人の例。参加が10人と20人のとき、開票を比べよう。');
  const seen = new Set();
  const chart = node('div', 'lgv-ballot-result', '参加人数を選んで開票しよう。');
  const choices = node('div', 'lgv-segments');
  for (const participants of [10, 20]) {
    choices.append(button(`${participants}人が参加`, () => {
      const votes = turnoutTally(participants);
      seen.add(participants);
      clear(chart, node('strong', '', `📬 ${participants} / 20人が参加（投票率 ${participants * 5}%）`), tallyChart(votes));
      ui.say(participants === 10 ? 'この例では市場が先頭だね。20人のときも見てみよう。'
        : 'この例では橋が先頭だね。10人のときと何が変わったかな？');
      if (seen.size === 2) ui.unlock('この例では参加人数が変わると結果も変わった。いつも変わるわけではないよ。');
    }, 'lgv-option'));
  }
  ui.play.append(chart);
  ui.controls.append(paragraph('同じ20人の村で比べる', 'lgv-control-label'), choices);
}

function renderHyouVote() {
  const ui = stageShell(stageTitles[4], '3人の提案を見直し、一票を入れよう。どれを選んでも大切な考えだよ。');
  let selected = null, sample = false, cast = false;
  const mode = node('div', 'lgv-segments');
  const booth = node('div', 'lgv-private-booth');
  const ballot = node('div', 'lgv-ballot-choices');
  const result = node('div', 'lgv-ballot-result');
  const reasons = node('div', 'lgv-segments');
  const castButton = button('投票箱へ入れる', () => {
    if (!selected || cast) return;
    cast = true;
    const votes = ballotTally(selected);
    clear(booth, paragraph(sample ? '先生が動かす架空の一票を入れたよ。' : '自分の一票を入れたよ。投票先は保存されないよ。'));
    clear(result, node('strong', '', '村の小さな模擬投票　開票結果'), tallyChart(votes));
    ui.say('一票を加えると、数字が変わったね。どんな理由で選んだか考えてみよう。');
    const chosen = PROPOSALS.find(proposal => proposal.id === selected);
    clear(reasons, button(`💬 ${chosen.reason}`, () => {
      ui.say('理由を言葉にできたね。ほかの願いにも目を向けてみよう。');
      ui.unlock('自分の考えで一票を選んだ。投票先に正解はないよ。');
    }, 'lgv-option'), button('💬 ほかにも理由がある', () => {
      ui.say('自分だけの理由も大切だよ。先生や家の人に話してみよう。');
      ui.unlock('自分の考えで一票を選んだ。投票先に正解はないよ。');
    }, 'lgv-option'));
    mode.querySelectorAll('button').forEach(control => { control.disabled = true; });
  }, 'lgv-action');
  castButton.disabled = true;
  const drawBallot = () => {
    clear(ballot);
    for (const proposal of PROPOSALS) {
      const control = button(`${proposal.icon} ${proposal.gotomon}：${proposal.name}`, () => {
        selected = proposal.id; castButton.disabled = false; drawBallot();
      }, `lgv-ballot-choice ${selected === proposal.id ? 'is-selected' : ''}`);
      control.setAttribute('aria-pressed', String(selected === proposal.id));
      ballot.append(control);
    }
  };
  const drawMode = () => choiceGroup(mode, [
    { value: false, label: '自分の一票' }, { value: true, label: '授業で見せる架空の一票' },
  ], sample, value => { if (cast) return; sample = value; drawMode(); });
  booth.append(paragraph('🚪 ついたての中で選ぼう。画面をみんなに見せるときは架空の一票を選んでね。'), ballot);
  ui.play.append(booth, result);
  ui.controls.append(paragraph('投票のしかた', 'lgv-control-label'), mode, castButton, reasons);
  drawMode(); drawBallot();
}

function renderStage() {
  const chapters = isScience
    ? [renderKururuCrank, renderKururuRoute, renderKururuCompare, renderKururuSensor, renderKururuFinal]
    : [renderHyouVillage, renderHyouHistory, renderHyouBooth, renderHyouTurnout, renderHyouVote];
  chapters[stageIndex]();
}

function renderSummary() {
  const shell = frame(`${guide}と5つの発見！`, isScience
    ? '電気は作り、ため、道具や命令を工夫して使える。小道で試したことを、身近な道具でも探してみよう。'
    : '違う願いを聞き、投票のしくみを試したね。どの願いを大切にするか、自分の理由で考えられる。',
  '星を5こ集めたよ');
  const end = node('section', 'lgv-board lgv-summary');
  end.append(node('div', 'lgv-stars', '★ ★ ★ ★ ★'), paragraph('結果が思った通りでも、違っていても、試したことが発見だよ。'));
  const finish = button(`${guide}と仲間になる`, () => {
    finish.disabled = true;
    window.yomitabiLessonComplete?.(5, 5);
    if (window.parent === window) end.append(paragraph('ヨミタビの広場から遊ぶと、仲間の記録が残るよ。'));
  }, 'lgv-primary lgv-finish');
  end.append(finish);
  shell.append(end);
}

if (root && ['kururu', 'hitotsubu'].includes(slug)) renderOpening();
