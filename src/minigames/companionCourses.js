// Eight reusable routes. A companion chooses two routes; routes are never copied per monster.
const ROUTES = Object.freeze({
  mathSprint: { id: 'potato-shortcut', name: 'ころころ近道', description: '2回続けて正解ジャンプすると、転がって近道する。' },
  mathInvader: { id: 'corn-barrage', name: '黄金の連射', description: '3回続けて撃破すると、次の一発が黄金弾になる。' },
  englishChoice: { id: 'treasure-key', name: 'ひみつの鍵', description: '2回続けて正解すると鍵ができ、次の宝箱が金の宝箱になる。' },
  sentenceOrder: { id: 'bridge-anchor', name: '虹の支え', description: '2つの文を続けて完成させると、次の橋が虹の橋になる。' },
  timedChoice: { id: 'milk-lantern', name: 'しずくハンマー', description: '2回続けて正解すると、次のひとたたきがしずくハンマーになる。' },
  multiSelect: { id: 'star-reserve', name: '星のたくわえ', description: '星座を2つ続けて完成させると、次の星座に流れ星がかかる。' },
  asyncChoice: { id: 'explorer-compass', name: '発見の羅針盤', description: '2回続けて正しい線路をえらぶと、羅針盤が次の宝を大きくする。' },
  kanjiDefense: { id: 'defense-ward', name: '守りの札', description: '読みの連続正解で札を作り、次の撃退を強める。' },
});

const SIGNATURES = Object.freeze({
  'HKD-E01': ['mathSprint', 'englishChoice'],
  'HKD-E02': ['mathInvader', 'englishChoice'],
  'HKD-E03': ['timedChoice', 'englishChoice'],
});

export function companionCourseGames(gotomon) {
  if (!gotomon?.id) return [];
  if (SIGNATURES[gotomon.id]) return SIGNATURES[gotomon.id];
  const category = gotomon.category || '';
  if (/食|菓子|農|果|野菜|畜産|酒|グルメ/.test(category)) return ['englishChoice', 'timedChoice'];
  if (/自然|動物|植物|生物|海|山|川|地形|鳥|獣|魚|湖|幻獣/.test(category)) return ['asyncChoice', 'multiSelect'];
  if (/工|産業|交通|鉄道|機械|乗物|都市|鉱山/.test(category)) return ['mathSprint', 'mathInvader'];
  if (/歴史|文化|伝説|伝承|神話|祭|芸能|文学|宗教|武士|忍者/.test(category)) return ['sentenceOrder', 'kanjiDefense'];
  return ['kanjiDefense', 'asyncChoice'];
}

export function companionCourse(gotomon, gameId) {
  if (!companionCourseGames(gotomon).includes(gameId)) return null;
  return ROUTES[gameId] || null;
}
