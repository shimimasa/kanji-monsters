// Elementary kanji made of two familiar parts, written by hand for 漢字パーツ落とし.
// [kanji, first part, second part, how they sit (lr: left and right, tb: top and
// bottom, out: outside and inside), a reading with its okurigana, grade].
// Each pair of parts makes only one kanji in this list. The teacher's check list is
// docs/kanji-parts-check.csv.
const ROWS = [
  ['休', '亻', '木', 'lr', 'やすむ', 1], ['林', '木', '木', 'lr', 'はやし', 1], ['村', '木', '寸', 'lr', 'むら', 1],
  ['校', '木', '交', 'lr', 'こう', 1], ['町', '田', '丁', 'lr', 'まち', 1], ['男', '田', '力', 'tb', 'おとこ', 1],
  ['字', '宀', '子', 'tb', 'じ', 1], ['花', '艹', '化', 'tb', 'はな', 1], ['草', '艹', '早', 'tb', 'くさ', 1],
  ['早', '日', '十', 'tb', 'はやい', 1], ['音', '立', '日', 'tb', 'おと', 1], ['名', '夕', '口', 'tb', 'な', 1],
  ['空', '穴', '工', 'tb', 'そら', 1],
  ['明', '日', '月', 'lr', 'あかるい', 2], ['体', '亻', '本', 'lr', 'からだ', 2], ['時', '日', '寺', 'lr', 'とき', 2],
  ['晴', '日', '青', 'lr', 'はれる', 2], ['読', '言', '売', 'lr', 'よむ', 2], ['計', '言', '十', 'lr', 'はかる', 2],
  ['記', '言', '己', 'lr', 'しるす', 2], ['紙', '糸', '氏', 'lr', 'かみ', 2], ['絵', '糸', '会', 'lr', 'え', 2],
  ['細', '糸', '田', 'lr', 'ほそい', 2], ['海', '氵', '毎', 'lr', 'うみ', 2], ['姉', '女', '市', 'lr', 'あね', 2],
  ['妹', '女', '未', 'lr', 'いもうと', 2], ['秋', '禾', '火', 'lr', 'あき', 2], ['鳴', '口', '鳥', 'lr', 'なく', 2],
  ['野', '里', '予', 'lr', 'の', 2], ['岩', '山', '石', 'tb', 'いわ', 2], ['星', '日', '生', 'tb', 'ほし', 2],
  ['思', '田', '心', 'tb', 'おもう', 2], ['多', '夕', '夕', 'tb', 'おおい', 2], ['分', '八', '刀', 'tb', 'わける', 2],
  ['間', '門', '日', 'out', 'あいだ', 2], ['聞', '門', '耳', 'out', 'きく', 2],
  ['洋', '氵', '羊', 'lr', 'よう', 3], ['畑', '火', '田', 'lr', 'はたけ', 3], ['味', '口', '未', 'lr', 'あじ', 3],
  ['相', '木', '目', 'lr', 'あい', 3], ['動', '重', '力', 'lr', 'うごく', 3], ['安', '宀', '女', 'tb', 'やすい', 3],
  ['息', '自', '心', 'tb', 'いき', 3], ['意', '音', '心', 'tb', 'い', 3], ['問', '門', '口', 'out', 'とう', 3],
  ['松', '木', '公', 'lr', 'まつ', 4], ['好', '女', '子', 'lr', 'すき', 4],
  ['泉', '白', '水', 'tb', 'いずみ', 6], ['宝', '宀', '玉', 'tb', 'たから', 6],
];
export const KANJI_PARTS = Object.freeze(ROWS.map(([kanji, first, second, layout, reading, grade]) =>
  Object.freeze({ kanji, parts: Object.freeze([first, second]), layout, reading, grade })));
const keyOf = (a, b) => [a, b].sort().join('+');
// The kanji two parts make, whichever falls on which, or null.
export const kanjiOf = (a, b) => KANJI_PARTS.find(item => keyOf(...item.parts) === keyOf(a, b)) ?? null;
