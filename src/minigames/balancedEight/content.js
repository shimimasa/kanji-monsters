// Six teacher-readable rounds per game. Every choice has one unambiguous answer.
// The reward/artifact is earned for taking part, regardless of the selected answer.
const card = (prompt, choices, correct, explain, visual = '', speech = '') =>
  Object.freeze({ prompt, choices: Object.freeze(choices), correct, explain, visual, speech });

export const NEW_GAME_CONTENT = Object.freeze({
  abcPost: Object.freeze({
    title: 'ABCポスト', subject: 'english', skillId: 'english.letter.case',
    intro: '手紙を引っぱるか、ポストをタップしてとどけよう。',
    rounds: Object.freeze([
      card('A の手紙は どのポスト？', ['a', 'd', 'q'], 'a', 'A と a は おなじ文字。', '✉️ A'),
      card('B の手紙は どのポスト？', ['p', 'b', 'd'], 'b', 'B と b は おなじ文字。', '✉️ B'),
      card('G の手紙は どのポスト？', ['g', 'q', 'j'], 'g', 'G と g は おなじ文字。', '✉️ G'),
      card('M の手紙は どのポスト？', ['n', 'w', 'm'], 'm', 'M と m は おなじ文字。', '✉️ M'),
      card('R の手紙は どのポスト？', ['r', 'n', 'h'], 'r', 'R と r は おなじ文字。', '✉️ R'),
      card('S の手紙は どのポスト？', ['s', 'z', 'c'], 's', 'S と s は おなじ文字。', '✉️ S'),
    ]),
  }),
  englishRadio: Object.freeze({
    title: 'えいごのラジオ', subject: 'english', skillId: 'english.phrase.listening',
    intro: '音を聞いて、ぴったりの絵をえらぼう。文字でも見られるよ。',
    rounds: Object.freeze([
      card('何のことを言っているかな？', ['🍎 りんご', '🍌 バナナ', '🍇 ぶどう'], '🍎 りんご', 'an apple は「りんご」。', '📻', 'an apple'),
      card('何のことを言っているかな？', ['🐈 ねこ', '🐕 いぬ', '🐇 うさぎ'], '🐕 いぬ', 'a dog は「いぬ」。', '📻', 'a dog'),
      card('何色かな？', ['🔴 あか', '🔵 あお', '🟡 きいろ'], '🔵 あお', 'blue は「あお」。', '📻', 'blue'),
      card('何のことを言っているかな？', ['☀️ たいよう', '🌙 つき', '⭐ ほし'], '🌙 つき', 'the moon は「つき」。', '📻', 'the moon'),
      card('いくつかな？', ['2️⃣ ふたつ', '3️⃣ みっつ', '4️⃣ よっつ'], '3️⃣ みっつ', 'three は「みっつ」。', '📻', 'three'),
      card('何のことを言っているかな？', ['📕 本', '✏️ えんぴつ', '🪑 いす'], '📕 本', 'a book は「本」。', '📻', 'a book'),
    ]),
  }),
  replyCafe: Object.freeze({
    title: 'おへんじカフェ', subject: 'english', skillId: 'english.phrase.reply',
    intro: 'ゴトモンの声を聞いて、ぴったりの返事をえらぼう。',
    rounds: Object.freeze([
      card('ゴトモン: Hello!', ['Hello!', 'Goodbye!', 'Thank you.'], 'Hello!', 'Hello! には Hello! と あいさつできるよ。', '☕ 👋', 'Hello!'),
      card('ゴトモン: Thank you.', ["You're welcome.", 'Good night.', 'I am ten.'], "You're welcome.", "You're welcome. は「どういたしまして」。", '☕ 🎁', 'Thank you.'),
      card('ゴトモン: Good morning!', ['Good morning!', 'See you!', 'It is blue.'], 'Good morning!', '朝は Good morning! と あいさつするよ。', '☕ ☀️', 'Good morning!'),
      card('ゴトモン: How are you?', ["I'm fine, thank you.", 'This is a pen.', 'See you!'], "I'm fine, thank you.", "I'm fine, thank you. は「元気だよ、ありがとう」。", '☕ 😊', 'How are you?'),
      card('ゴトモン: Goodbye!', ['See you!', 'Here you are.', 'I like cats.'], 'See you!', 'See you! は「またね」。', '☕ 👋', 'Goodbye!'),
      card('ゴトモン: Nice to meet you.', ['Nice to meet you, too.', 'It is rainy.', 'I have a book.'], 'Nice to meet you, too.', 'はじめまして、と言われたら同じ気持ちを返せるよ。', '☕ 🤝', 'Nice to meet you.'),
    ]),
  }),
  englishRoom: Object.freeze({
    title: 'えいごの おへやづくり', subject: 'english', skillId: 'english.position',
    intro: '英語の案内を聞いて、絵の中の置き場所をタップしよう。',
    rounds: Object.freeze([
      card('Put the cat on the box.', ['はこの 上', 'はこの 中', 'はこの 下'], 'はこの 上', 'on は「上に」。ねこが はこの上に すわったよ。', '🐈 📦', 'Put the cat on the box.'),
      card('Put the ball in the box.', ['はこの 下', 'はこの 中', 'はこの 上'], 'はこの 中', 'in は「中に」。ボールが はこの中に 入ったよ。', '⚽ 📦', 'Put the ball in the box.'),
      card('Put the dog under the table.', ['つくえの 上', 'つくえの 下', 'つくえの 中'], 'つくえの 下', 'under は「下に」。いぬは つくえの下だよ。', '🐕 🪑', 'Put the dog under the table.'),
      card('Put the book on the desk.', ['つくえの 下', 'つくえの 中', 'つくえの 上'], 'つくえの 上', 'on は「上に」。本を つくえの上に おいたよ。', '📕 🪑', 'Put the book on the desk.'),
      card('Put the pencil in the bag.', ['かばんの 中', 'かばんの 上', 'かばんの 下'], 'かばんの 中', 'in は「中に」。えんぴつを かばんに 入れたよ。', '✏️ 🎒', 'Put the pencil in the bag.'),
      card('Put the ball under the chair.', ['いすの 中', 'いすの 上', 'いすの 下'], 'いすの 下', 'under は「下に」。ボールは いすの下だよ。', '⚽ 🪑', 'Put the ball under the chair.'),
    ]),
  }),
  wonderLab: Object.freeze({
    title: 'ふしぎ実験室', subject: 'science', skillId: 'science.predict',
    intro: 'どうなるか予想して、実験でたしかめよう。',
    rounds: Object.freeze([
      card('鉄のくぎに じしゃくを近づけたら？', ['くっつく', 'ひかる', 'とける'], 'くっつく', '鉄のくぎは じしゃくに くっつくよ。', '🧲 ＋ 🔩'),
      card('少しの食塩を 水に入れて まぜたら？', ['水に とける', 'こおりになる', '石になる'], '水に とける', '食塩は 水にとけて、見えにくくなるよ。', '🧂 ＋ 💧'),
      card('水を れいとうこで 十分に冷やしたら？', ['こおりになる', '砂になる', '木になる'], 'こおりになる', '水は 冷やすと こおりになるよ。', '💧 ❄️'),
      card('小さな風車に 風をあてたら？', ['まわる', 'とける', 'しずむ'], 'まわる', '風の力で 風車が まわるよ。', '🌬️ ＋ 🎡'),
      card('虫めがねで 近くの小さな文字を見たら？', ['大きく見える', '音がする', '文字が消える'], '大きく見える', '虫めがねで 小さなものを 大きく見られるよ。', '🔍 ＋ 📖'),
      card('水に こおりを そっと入れたら？', ['水に うく', '底に しずむ', 'すぐに 石になる'], '水に うく', 'こおりは 水にうくよ。', '🧊 ＋ 💧'),
    ]),
  }),
  lifeCycle: Object.freeze({
    title: '生きものの一年', subject: 'science', skillId: 'science.lifeCycle.sequence',
    intro: '次のすがたをえらんで、観察ノートをつなごう。',
    rounds: Object.freeze([
      card('チョウの たまごから 生まれるのは？', ['🐛 よう虫', '🦋 成虫', '🌼 花'], '🐛 よう虫', 'チョウは たまごから よう虫になるよ。', '🥚 → ？'),
      card('チョウの よう虫が 次になるのは？', ['🦋 成虫', '🟤 さなぎ', '🥚 たまご'], '🟤 さなぎ', 'よう虫は さなぎになって すがたを変えるよ。', '🐛 → ？'),
      card('チョウの さなぎから 出てくるのは？', ['🐛 よう虫', '🦋 成虫', '🐸 カエル'], '🦋 成虫', 'さなぎから チョウの成虫が 出てくるよ。', '🟤 → ？'),
      card('カエルの たまごから 出てくるのは？', ['🐸 カエル', '🐟 おたまじゃくし', '🦋 チョウ'], '🐟 おたまじゃくし', 'カエルの たまごから おたまじゃくしが かえるよ。', '🥚 → ？'),
      card('アサガオの たねから はじめに出るのは？', ['🌱 め', '🌸 花', '🍎 実'], '🌱 め', 'たねから めが出て、少しずつ育つよ。', '🫘 → ？'),
      card('アサガオの 花がさき、実ができると 中には？', ['🫘 たね', '🐛 よう虫', '🧊 こおり'], '🫘 たね', '実の中に 新しいたねができるよ。', '🌸 → ？'),
    ]),
  }),
  mapTown: Object.freeze({
    title: '地図記号でまちづくり', subject: 'language', skillId: 'social.map.symbol',
    intro: '建物にあう地図記号をえらんで、町の地図をつくろう。',
    rounds: Object.freeze([
      card('小学校・中学校を あらわす地図記号は？', ['文', '〒', '＋'], '文', '小学校・中学校は「文」の形で あらわすよ。', '🏫'),
      card('郵便局を あらわす地図記号は？', ['〒', '文', '＋'], '〒', '郵便局は「〒」の形で あらわすよ。', '📮'),
      card('病院を あらわす地図記号の目印は？', ['十字のしるし', '文の字', '郵便のしるし'], '十字のしるし', '病院の地図記号には 十字のしるしがあるよ。', '🏥'),
      card('図書館を あらわす地図記号の形は？', ['開いた本', '風車', '三角形'], '開いた本', '図書館の地図記号は 本を開いた形だよ。', '📚'),
      card('地図の「文」のしるしへ 行くよ。どこかな？', ['小学校・中学校', '郵便局', '病院'], '小学校・中学校', '「文」は 小学校・中学校のしるしだよ。', '🗺️ 文'),
      card('地図の「〒」のしるしへ 行くよ。どこかな？', ['病院', '図書館', '郵便局'], '郵便局', '「〒」は 郵便局のしるしだよ。', '🗺️ 〒'),
    ]),
  }),
  shapeMosaic: Object.freeze({
    title: 'かたちのモザイク', subject: 'math', skillId: 'math.geometry.shapes',
    intro: '形のタイルをえらんで、モザイクをつくろう。',
    rounds: Object.freeze([
      card('おうちの とがった屋根に ぴったりの形は？', ['▲ 三角形', '● 円', '■ 正方形'], '▲ 三角形', '屋根には 三角形のタイルを置いたよ。', '🏠'),
      card('4つの辺が どれも同じ長さの 窓は？', ['▭ 長方形', '■ 正方形', '● 円'], '■ 正方形', '4つの辺が同じ長さの 正方形だよ。', '🪟'),
      card('車の まるい車輪に ぴったりの形は？', ['▲ 三角形', '▭ 長方形', '● 円'], '● 円', '車輪に 円のタイルを置いたよ。', '🚗'),
      card('細長いドアに ぴったりの形は？', ['▭ 長方形', '■ 正方形', '● 円'], '▭ 長方形', 'ドアには 長方形のタイルを置いたよ。', '🚪'),
      card('3つの まっすぐな辺がある 旗は？', ['● 円', '▲ 三角形', '▭ 長方形'], '▲ 三角形', '3つの辺がある 三角形の旗だよ。', '🚩'),
      card('角がなく、まるい池に ぴったりの形は？', ['■ 正方形', '● 円', '▲ 三角形'], '● 円', '角のない 円のタイルを置いたよ。', '💧'),
    ]),
  }),
});

export const NEW_GAME_IDS = Object.freeze(Object.keys(NEW_GAME_CONTENT));
