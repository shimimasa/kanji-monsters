const miniPortrait = id => `/assets/images/monsters/full/mini-game/${id}.webp`;

export const stories = {
  kururu: {
    title: 'クルルと 光を とどけよう',
    subject: '理科',
    guide: 'クルル',
    portrait: '/assets/images/monsters/full/lesson/EL-001.svg',
    opening: '夜の 小道に 明かりを とどけたいんだ。ジッケルと いっしょに、電気を つくって、ためて、むだなく 使う 方法を ためそう。',
    summary: '電気は つくれる。ためて あとで 使える。同じ 電気でも、道具や センサーの 使い方で 明かりの 続く 時間が 変わるね。',
    stages: [
      {
        icon: '⚡', title: 'ハンドルを 回そう', prompt: 'ジッケル「回す 速さで 電圧は どう 変わるかな？」 2つ 以上 ためして 比べよう。',
        ally: { name: 'ジッケル', image: miniPortrait('MG-046'), message: '予想と ちがっても、新しい 発見だよ！' },
        required: 2, discovery: '同じ 手回し発電機では、この 実験の ように 回す 速さを 上げると 電圧が 大きく なる。',
        options: [
          { id: 'slow', icon: '🐢', label: 'ゆっくり 回す', response: '電圧計は 0.8V。少し 電気が できたよ。', meter: 27, metric: '0.8V' },
          { id: 'middle', icon: '🔄', label: 'ふつうに 回す', response: '電圧計は 1.6V。ゆっくり より 上がったね。', meter: 54, metric: '1.6V' },
          { id: 'fast', icon: '⚡', label: 'はやく 回す', response: '電圧計は 2.8V。この 実験では いちばん 高いね。', meter: 93, metric: '2.8V' },
        ],
      },
      {
        icon: '🔋', title: '夜まで 電気を のこそう', prompt: 'まだ 昼だよ。今 つくった 電気を、夜の 明かりに 使うには？ 2つの 方法を ためそう。',
        required: 2, discovery: 'コンデンサーに 電気を ためると、つくった 時とは ちがう 時に 使える。',
        options: [
          { id: 'now', icon: '☀️', label: '今すぐ ランプへ', response: '昼の うちに 光ったよ。夜に 使う 電気は のこらなかったね。', meter: 0, metric: '夜の 電気 0' },
          { id: 'store', icon: '🔋', label: 'コンデンサーに ためる', response: '夜まで 電気を のこせたよ。暗く なってから 光らせられるね。', meter: 75, metric: '夜の 電気 あり' },
        ],
      },
      {
        icon: '💡', title: '長く 光る 道具を えらぼう', prompt: 'ためた 電気は 同じ 量。豆電球と LEDを つないで、光る 時間を 比べよう。',
        required: 2, discovery: 'この 実験条件では、LEDの 方が 少ない 電気で 長く 光った。道具で 電気の 使い方が 変わる。',
        options: [
          { id: 'bulb', icon: '💡', label: '豆電球を つなぐ', response: '明るく 光ったよ。この 実験では、ためた 電気を はやく 使いきった。', meter: 35, metric: '光る 時間 みじかめ' },
          { id: 'led', icon: '✨', label: 'LEDを つなぐ', response: '同じ 電気で、豆電球より 長く 光ったよ。', meter: 85, metric: '光る 時間 ながめ' },
        ],
      },
      {
        icon: '📡', title: '必要な ときに 光らせよう', prompt: 'ジッケル「昼も 夜も つけっぱなしに する？」 2つの 設定を ためそう。',
        ally: { name: 'ジッケル', image: miniPortrait('MG-046'), message: 'センサーの 使い方を 比べてみよう！' },
        required: 2, discovery: '明るさセンサーを 使うと、暗い ときだけ 光らせられる。必要な ときに 使えば 電気を 大切に できる。',
        options: [
          { id: 'always', icon: '🔆', label: 'ずっと 光らせる', response: '昼も 光っているね。明るい ときにも 電気を 使っている。', meter: 20, metric: 'のこる 電気 少なめ' },
          { id: 'sensor', icon: '🌙', label: '暗い ときだけ 光らせる', response: '昼は お休み、夜に 点灯したよ。電気を のこせたね。', meter: 78, metric: 'のこる 電気 多め' },
        ],
      },
      {
        icon: '🌟', title: '小道へ 明かりを とどけよう', prompt: 'いよいよ 夜の 小道へ。これまで ためした ことを 使って、クルルと 計画を 立てよう。',
        required: 1, goalOption: 'nightPlan', hint: 'クルル「昼に ためた 電気を、長く 光る 道具で、暗い ときに 使えたら どうかな？」',
        discovery: 'クルルと ジッケルの 明かりが 小道に とどいた！ 電気を つくる・ためる・使うが つながったね。',
        options: [
          { id: 'dayBulb', icon: '☀️', label: '昼から 豆電球を つける', response: '昼は 光ったね。夜まで 電気を のこす 方法も 考えてみよう。', meter: 15, metric: '夜の 明かり もう少し' },
          { id: 'nightCrank', icon: '🔄', label: '夜に 手回し だけで 光らせる', response: '回している 間は 光るね。電気を ためて おく 方法も 使えるよ。', meter: 45, metric: '夜の 明かり もう少し' },
          { id: 'nightPlan', icon: '🌙', label: '昼に ためて、LEDを 暗い ときだけ', response: '夜の 小道が 光った！ ためた 電気を 大切に 使えたね。', meter: 100, metric: '小道に 明かりが とどいた' },
        ],
      },
    ],
  },
  hitotsubu: {
    title: 'ヒョウと 村の 声を あつめよう',
    subject: '社会',
    guide: 'ヒョウ',
    portrait: '/assets/images/monsters/full/lesson/EL-002.svg',
    opening: '村の 広場に 作る ものを 決めるよ。先に ゴトモンたちの 願いを 聞いて、投票の しくみも たしかめよう。どの 提案を えらんでも、あなたの 考えは 大切だよ。',
    summary: '村には ちがう 願いが ある。だれが 投票できるか、どう 投票するか、何人 参加するかで、決まり方が 変わる。自分の 一票も 大切に しよう。',
    stages: [
      {
        icon: '🏘️', title: '村の 声を 聞こう', prompt: 'まず 3人の 話を 聞こう。それぞれの 願いには 理由が あるよ。',
        required: 3, discovery: '同じ 村でも、ほしい ものは 一人ひとり ちがう。だれの 声も 聞いてから 考えよう。',
        options: [
          { id: 'bridgeVoice', icon: '🌉', label: 'カワワタの 話', portrait: miniPortrait('MG-038'), response: 'カワワタ「川を わたる 橋が あれば、向こう岸の 友だちに 会えるよ。」', metric: '橋が ほしい' },
          { id: 'marketVoice', icon: '🍎', label: 'オネガミの 話', portrait: miniPortrait('MG-014'), response: 'オネガミ「市場が あれば、作った ものを みんなで わけられるよ。」', metric: '市場が ほしい' },
          { id: 'mapVoice', icon: '🗺️', label: 'チズリンの 話', portrait: miniPortrait('MG-048'), response: 'チズリン「案内板が あれば、初めて 来た 子も 道に まよわないよ。」', metric: '案内板が ほしい' },
        ],
      },
      {
        icon: '🕰️', title: '投票できる 人は 変わってきた', prompt: '日本の 選挙の 歴史を 4つ 見よう。昔は だれでも 投票できたのかな？',
        required: 4, discovery: '投票できる 人の 範囲は 広がってきた。今の 18歳以上の 選挙権も、長い 歴史の 上に ある。',
        options: [
          { id: '1889', icon: '一', label: '1889年', response: '満25歳以上の 男性で、一定額 以上の 税を 納めた 人だけが 投票できた。', metric: '投票できる 人は 限られた' },
          { id: '1925', icon: '二', label: '1925年', response: '納税額の 条件が なくなり、満25歳以上の 男性が 投票できる ように なった。女性は まだ 投票できなかった。', metric: '男性の 範囲が 広がった' },
          { id: '1945', icon: '三', label: '1945年', response: '女性にも 選挙権が 認められ、満20歳以上の 男女が 投票できる ように なった。', metric: '女性にも 選挙権' },
          { id: '2016', icon: '四', label: '2016年', response: '選挙権年齢が 満18歳以上に 下がった。今の きまりに つながるよ。', metric: '満18歳以上' },
        ],
      },
      {
        icon: '🗳️', title: 'だれにも 見えない 一票', prompt: '投票する ときの 様子を 2つ 比べてみよう。安心して 自分の 考えを 出せるのは？',
        required: 2, discovery: '秘密投票では、だれに 投票したかを ほかの 人に 知られずに すむ。自分の 考えを 守る 大切な しくみ。',
        options: [
          { id: 'open', icon: '📣', label: 'みんなの 前で 伝える', response: 'まわりの 人に だれを えらんだかが 分かるね。言いにくく 感じる 人も いるかも。', metric: '投票先が 見える' },
          { id: 'secret', icon: '✉️', label: 'かくれて 書いて 箱へ', response: '自分の 考えで 書いて、用紙を 箱に 入れたよ。ほかの 人には 見えないね。', metric: '投票先は ひみつ' },
        ],
      },
      {
        icon: '📊', title: '参加する 人で 結果は？', prompt: '村の 例を 見よう。全員が 投票する 場合と、半分だけの 場合を 比べてね。',
        required: 2, discovery: 'この 村の 例では、参加する 人が 変わると 結果も 変わった。いつも 変わるとは 限らないよ。',
        options: [
          { id: 'all', icon: '👥', label: '20人 みんなが 投票', response: '橋 11票、市場 9票。橋を えらぶ 人が 多かった。', metric: '橋 11 ／ 市場 9', tally: { bridge: 11, market: 9 } },
          { id: 'half', icon: '👤', label: '10人だけが 投票', response: '橋 4票、市場 6票。今度は 市場を えらぶ 人が 多かった。', metric: '橋 4 ／ 市場 6', tally: { bridge: 4, market: 6 } },
        ],
      },
      {
        icon: '✨', title: 'あなたの 一票を 入れよう', prompt: '橋には 2票、市場と 案内板には 1票ずつ 入っているよ。3人の 願いを 思い出して、自分で えらぼう。どれも 正解だよ。',
        required: 1, discovery: '一票で 同数に なる ことも、差が 広がる ことも ある。どの 願いを 大切に したか、ヒョウに 話してみよう。',
        options: [
          { id: 'bridge', icon: '🌉', label: '橋に 一票', response: 'カワワタの 願いを えらんだね。川向こうへ 行きやすく なる かもしれない。' },
          { id: 'market', icon: '🍎', label: '市場に 一票', response: 'オネガミの 願いを えらんだね。作った ものを わけられる かもしれない。' },
          { id: 'map', icon: '🗺️', label: '案内板に 一票', response: 'チズリンの 願いを えらんだね。初めての 子も まよいにくく なるね。' },
        ],
      },
    ],
  },
};

export function canAdvance(stage, seen, selectedId) {
  return seen.size >= stage.required && (!stage.goalOption || selectedId === stage.goalOption);
}

export function outcomeFor(storyId, stageIndex, optionId) {
  const stage = stories[storyId]?.stages[stageIndex];
  const option = stage?.options.find(item => item.id === optionId);
  if (!option) return null;
  if (storyId !== 'hitotsubu' || stageIndex !== 4) return option;
  const votes = { bridge: 2, market: 1, map: 1 };
  votes[optionId]++;
  const label = { bridge: '橋', market: '市場', map: '案内板' };
  const numbers = Object.entries(votes).map(([id, count]) => `${label[id]} ${count}票`).join('・');
  return { ...option, metric: numbers, tally: votes,
    response: `${option.response} 村の 5票は ${numbers}。${optionId === 'bridge' ? '橋が 3票で 先頭に なった。' : '橋と ' + label[optionId] + 'が 2票ずつに なった。'}` };
}

function item(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

function init() {
  const slug = document.body.dataset.lesson;
  const story = stories[slug];
  const root = document.getElementById('lesson-game');
  if (!story || !root) return;
  let stageIndex = -1;
  let seen = new Set();
  let selectedId = null;

  function frame(title, message, progress) {
    root.replaceChildren();
    const shell = item('div', 'lesson-shell');
    const top = item('header', 'lesson-top');
    top.append(item('span', 'lesson-subject', `${story.subject}の旅`), item('span', 'lesson-progress', progress));
    const guide = item('div', 'lesson-guide');
    const portrait = item('img', 'lesson-portrait');
    portrait.src = story.portrait;
    portrait.alt = story.guide;
    const talk = item('div', 'lesson-talk');
    talk.append(item('span', 'lesson-guide-name', story.guide), item('h1', '', title), item('p', '', message));
    guide.append(portrait, talk);
    shell.append(top, guide);
    root.append(shell);
    return shell;
  }

  function action(label, handler, className = '') {
    const button = item('button', `lesson-action ${className}`, label);
    button.type = 'button';
    button.addEventListener('click', handler);
    return button;
  }

  function renderOpening() {
    const shell = frame(story.title, story.opening, 'ゴトモンと 5つの 発見');
    const intro = item('div', 'lesson-intro');
    intro.append(item('span', 'lesson-intro-icon', slug === 'kururu' ? '⚡ 🔋 💡' : '🏘️ 🗳️ ✨'),
      item('p', '', slug === 'kururu'
        ? 'ジッケルも 実験を 手伝うよ。気になる 方法を 選んで、結果を 比べよう。'
        : 'カワワタ・オネガミ・チズリンの 声も 聞けるよ。自分の 考えで 進もう。'));
    intro.append(action('いっしょに ためす', () => { stageIndex = 0; renderStage(); }, 'lesson-primary'));
    shell.append(intro);
  }

  function renderTally(target, tally) {
    const names = { bridge: '橋', market: '市場', map: '案内板' };
    const chart = item('div', 'lesson-tally');
    const maximum = Math.max(...Object.values(tally));
    for (const [key, count] of Object.entries(tally)) {
      const row = item('div', 'lesson-tally-row');
      row.append(item('span', '', names[key]));
      const bar = item('span', 'lesson-tally-track');
      const fill = item('span', 'lesson-tally-fill');
      fill.style.width = `${Math.round(count / maximum * 100)}%`;
      bar.append(fill);
      row.append(bar, item('strong', '', `${count}票`));
      chart.append(row);
    }
    target.append(chart);
  }

  function renderStage({ announce = false } = {}) {
    const stage = story.stages[stageIndex];
    const shell = frame(`${stage.icon} ${stage.title}`, stage.prompt, `${stageIndex + 1} / 5 の 発見`);
    const board = item('section', 'lesson-board');
    if (stage.ally) {
      const ally = item('div', 'lesson-ally');
      const portrait = item('img', 'lesson-ally-portrait');
      portrait.src = stage.ally.image;
      portrait.alt = stage.ally.name;
      ally.append(portrait, item('span', '', `${stage.ally.name}「${stage.ally.message}」`));
      board.append(ally);
    }
    board.append(item('h2', '', 'どうする？'));
    const choices = item('div', 'lesson-choices');
    for (const option of stage.options) {
      const choice = action('', () => {
        seen.add(option.id);
        selectedId = option.id;
        renderStage({ announce: true });
      }, `lesson-choice ${selectedId === option.id ? 'is-selected' : ''}`);
      if (option.portrait) {
        const picture = item('img', 'lesson-visitor');
        picture.src = option.portrait;
        picture.alt = '';
        choice.append(picture);
      } else choice.append(item('span', 'lesson-choice-icon', option.icon));
      choice.append(item('span', '', option.label));
      if (seen.has(option.id)) choice.append(item('span', 'lesson-seen', '✓ ためした'));
      choice.setAttribute('aria-pressed', String(selectedId === option.id));
      choices.append(choice);
    }
    board.append(choices);
    const result = item('div', 'lesson-observation');
    result.setAttribute('aria-live', 'polite');
    result.tabIndex = -1;
    if (selectedId) {
      const outcome = outcomeFor(slug, stageIndex, selectedId);
      result.append(item('strong', '', `🔍 ${outcome.metric || '見つけた こと'}`), item('p', '', outcome.response));
      if (Number.isFinite(outcome.meter)) {
        const meter = item('div', 'lesson-meter');
        const fill = item('span', 'lesson-meter-fill');
        fill.style.width = `${outcome.meter}%`;
        meter.append(fill);
        result.append(meter);
      }
      if (outcome.tally) renderTally(result, outcome.tally);
    } else result.append(item('p', '', '気になる ものを タッチして、クルルや ヒョウと たしかめよう。'));
    if (slug === 'kururu' && stageIndex === 4) {
      const lanterns = item('div', 'lesson-lanterns');
      lanterns.setAttribute('aria-label', `小道の 明かり ${selectedId === 'nightPlan' ? 3 : selectedId === 'nightCrank' ? 1 : 0} / 3`);
      const lit = selectedId === 'nightPlan' ? 3 : selectedId === 'nightCrank' ? 1 : 0;
      for (let lamp = 0; lamp < 3; lamp++) lanterns.append(item('span', lamp < lit ? 'is-lit' : '', '💡'));
      result.append(lanterns);
    }
    board.append(result);
    const footer = item('div', 'lesson-stage-footer');
    const count = seen.size;
    const ready = canAdvance(stage, seen, selectedId);
    footer.append(item('p', 'lesson-discovery-count', count >= stage.required
      ? `${count} こ ためした` : `${count} / ${stage.required} こ ためした`));
    if (ready) footer.append(item('p', 'lesson-discovery', stage.discovery));
    if (stage.goalOption && count && !ready) footer.append(action('クルルと いっしょに 考える', () => {
      const hint = item('p', 'lesson-hint', stage.hint);
      footer.querySelector('.lesson-hint')?.remove();
      footer.insertBefore(hint, footer.querySelector('.lesson-next'));
    }));
    const next = action(stageIndex === 4 ? 'まとめへ すすむ' : '星を あつめて すすむ', () => {
      if (!canAdvance(stage, seen, selectedId)) return;
      window.recordBadge?.(stageIndex + 1, 5);
      stageIndex++;
      seen = new Set();
      selectedId = null;
      if (stageIndex === story.stages.length) renderSummary();
      else renderStage();
    }, 'lesson-primary lesson-next');
    next.disabled = !ready;
    footer.append(next);
    board.append(footer);
    shell.append(board);
    if (announce) requestAnimationFrame(() => result.focus({ preventScroll: false }));
  }

  function renderSummary() {
    const shell = frame(`${story.guide}と 5つの 発見！`, story.summary, '星を 5こ あつめたよ');
    const end = item('section', 'lesson-summary');
    const stars = item('div', 'lesson-stars', '★ ★ ★ ★ ★');
    end.append(stars, item('p', '', slug === 'kururu'
      ? 'ジッケルも「いっしょに ためして 楽しかった！」と よろこんでいるよ。'
      : 'カワワタ・オネガミ・チズリンも、話を 聞いてくれた ことに よろこんでいるよ。'));
    end.append(action(`${story.guide}と なかまに なる`, () => {
      const finish = end.querySelector('.lesson-finish');
      finish.disabled = true;
      window.yomitabiLessonComplete?.(5, 5);
      if (window.parent === window) end.append(item('p', '', 'ヨミタビの 広場から あそぶと、なかまの 記録が のこるよ。'));
    }, 'lesson-primary lesson-finish'));
    shell.append(end);
  }

  renderOpening();
}

if (typeof document !== 'undefined') init();
