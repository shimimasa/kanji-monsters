// The 47 prefectures on a tile map of Japan (15 columns x 13 rows). Tiles keep the
// rough shape and neighbours of the real map; 北海道 takes 2x2 tiles.
export const REGIONS = Object.freeze([
  { regionId: 'hokkaido-tohoku', name: '北海道・東北地方' },
  { regionId: 'kanto', name: '関東地方' },
  { regionId: 'chubu', name: '中部地方' },
  { regionId: 'kinki', name: '近畿地方' },
  { regionId: 'chugoku-shikoku', name: '中国・四国地方' },
  { regionId: 'kyushu-okinawa', name: '九州・沖縄地方' },
].map(item => Object.freeze(item)));
export const MAP_COLUMNS = 15;
export const MAP_ROWS = 13;

// [name, suffix, regionId, column, row, width, height]
const ROWS = [
  ['北海道', '', 'hokkaido-tohoku', 13, 0, 2, 2],
  ['青森', '県', 'hokkaido-tohoku', 13, 2], ['秋田', '県', 'hokkaido-tohoku', 12, 3], ['岩手', '県', 'hokkaido-tohoku', 13, 3],
  ['山形', '県', 'hokkaido-tohoku', 12, 4], ['宮城', '県', 'hokkaido-tohoku', 13, 4], ['福島', '県', 'hokkaido-tohoku', 12, 5],
  ['茨城', '県', 'kanto', 13, 6], ['栃木', '県', 'kanto', 12, 6], ['群馬', '県', 'kanto', 11, 6], ['埼玉', '県', 'kanto', 11, 7],
  ['千葉', '県', 'kanto', 13, 7], ['東京', '都', 'kanto', 12, 7], ['神奈川', '県', 'kanto', 11, 8],
  ['新潟', '県', 'chubu', 11, 5], ['富山', '県', 'chubu', 10, 5], ['石川', '県', 'chubu', 9, 5], ['福井', '県', 'chubu', 8, 6],
  ['山梨', '県', 'chubu', 10, 7], ['長野', '県', 'chubu', 10, 6], ['岐阜', '県', 'chubu', 9, 6], ['静岡', '県', 'chubu', 10, 8],
  ['愛知', '県', 'chubu', 9, 7],
  ['三重', '県', 'kinki', 8, 8], ['滋賀', '県', 'kinki', 8, 7], ['京都', '府', 'kinki', 7, 7], ['大阪', '府', 'kinki', 6, 8],
  ['兵庫', '県', 'kinki', 6, 7], ['奈良', '県', 'kinki', 7, 8], ['和歌山', '県', 'kinki', 7, 9],
  ['鳥取', '県', 'chugoku-shikoku', 5, 7], ['島根', '県', 'chugoku-shikoku', 4, 7], ['岡山', '県', 'chugoku-shikoku', 5, 8],
  ['広島', '県', 'chugoku-shikoku', 4, 8], ['山口', '県', 'chugoku-shikoku', 3, 8], ['徳島', '県', 'chugoku-shikoku', 5, 10],
  ['香川', '県', 'chugoku-shikoku', 5, 9], ['愛媛', '県', 'chugoku-shikoku', 4, 9], ['高知', '県', 'chugoku-shikoku', 4, 10],
  ['福岡', '県', 'kyushu-okinawa', 2, 9], ['佐賀', '県', 'kyushu-okinawa', 1, 9], ['長崎', '県', 'kyushu-okinawa', 0, 9],
  ['熊本', '県', 'kyushu-okinawa', 1, 10], ['大分', '県', 'kyushu-okinawa', 2, 10], ['宮崎', '県', 'kyushu-okinawa', 2, 11],
  ['鹿児島', '県', 'kyushu-okinawa', 1, 11], ['沖縄', '県', 'kyushu-okinawa', 0, 12],
];
export const PREFECTURES = Object.freeze(ROWS.map(([name, suffix, regionId, column, row, width = 1, height = 1]) => Object.freeze({
  name, fullName: `${name}${suffix}`, regionId, column, row, width, height })));
export const prefectureByName = name => PREFECTURES.find(item => item.name === name) ?? null;
export const regionName = regionId => REGIONS.find(item => item.regionId === regionId)?.name ?? '';
