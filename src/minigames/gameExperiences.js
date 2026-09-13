// Presentation metadata stays outside the stable v1 registry contract.
export const gameExperiences = Object.freeze({
  mathSprint: { genre: '算数', difficulty: '入門', time: '約1分', icon: '➜', scene: 'race',
    description: 'ためて跳ぶ、計算レース。最速ゴールへ。', goal: '障害の前に力をため、攻めてタイムを縮めよう。', skill: 'ゴトモンダッシュ', effect: '6秒ブースト', unit: 'm', color: '#177a69' },
  mathInvader: { genre: '算数', difficulty: 'ふつう', time: '約2分', icon: '✦', scene: 'shoot',
    description: 'ねらう敵を選び、計算ショットで撃退。', goal: '敵を選ぶ → 計算 → 相棒が発射！', skill: 'スター連射', effect: '次の2発を強化', unit: '撃退', color: '#346bab' },
  englishChoice: { genre: '英語', difficulty: '入門', time: '約1分', icon: '◇', scene: 'treasure',
    description: '安全？レア？扉を開けて4部屋の宝探し。', goal: '意味の合う扉を開けて、宝箱を集めよう。', skill: 'おたからフィーバー', effect: '宝箱の鍵を補充', unit: '箱', color: '#7153a4' },
  sentenceOrder: { genre: '国語', difficulty: 'ふつう', time: '約2分', icon: '▰', scene: 'bridge',
    description: '文節を動かして、相棒の橋をつなごう。', goal: '文節を並べる → 橋がつながる → 相棒が渡る！', skill: '虹のかけ橋', effect: '次の橋を虹色に', unit: '橋', color: '#39774c' },
  timedChoice: { genre: 'ことば', difficulty: '挑戦', time: '約1分', icon: '◷', scene: 'lantern',
    description: '光を守り、5つの灯台に分けよう。', goal: '光を分けて灯台へ。正解で相棒の光が回復！', skill: 'ひかりフィーバー', effect: '光回復・減少を緩和', unit: '灯', color: '#ad6726' },
  multiSelect: { genre: '理科・算数ほか', difficulty: 'ふつう', time: '約2分', icon: '✧', scene: 'craft',
    description: '合う星をつなぎ、3つの星座を完成。', goal: '正しい素材を集めて、相棒と星座をつくろう。', skill: '星座のきらめき', effect: '次の星が1.5倍', unit: '星座', color: '#347b87' },
  asyncChoice: { genre: '教科ミックス', difficulty: 'ふつう', time: '約2分', icon: '⌖', scene: 'explore',
    description: '5地点の順路を選び、手がかりでレア発見。', goal: '林道・海辺の手がかりを遺跡で使おう！', skill: '発見フィーバー', effect: '手がかり＋発見強化', unit: '発見', color: '#447b67' },
  kanjiDefense: { genre: '漢字の読み', difficulty: '挑戦', time: '約3分', icon: '♜', scene: 'defend',
    description: '漢字を読んで相棒と旅路を守りきろう。', goal: '迫る敵を選ぶ → 読みで攻撃 → 旅路を守る！', skill: '相棒エール', effect: '次の2正解で得点UP', unit: '撃退', color: '#ac5838' },
});
