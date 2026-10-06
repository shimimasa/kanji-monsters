// Adapted from the user's History Build card ideas:
// https://github.com/shimimasa/history-build (names, card types, rice/knowledge/town loop).
// This short reading game does not copy the original engine or use its assets.
export const HISTORY_CARDS = Object.freeze([
  { id: 'rice-small', name: 'こめ袋', reading: 'こめぶくろ', type: 'resource', rice: 1, knowledge: 0, points: 0, icon: '🌾', choices: ['こめぶくろ', 'こめだわら', 'ねんぐ', 'そんらく'] },
  { id: 'rice-medium', name: '米俵', reading: 'こめだわら', type: 'resource', rice: 2, knowledge: 0, points: 0, icon: '🌾', choices: ['こめぶくろ', 'こめだわら', 'よねだわら', 'ねんぐ'] },
  { id: 'mitsuhide', name: '明智光秀', reading: 'あけちみつひで', type: 'person', rice: 0, knowledge: 1, points: 0, icon: '📜', choices: ['あけちみつひで', 'たけだしんげん', 'うえすぎけんしん', 'とよとみひでよし'] },
  { id: 'gate', name: '関所', reading: 'せきしょ', type: 'event', rice: 0, knowledge: 1, points: 0, icon: '🚪', choices: ['せきしょ', 'じょうかまち', 'らくいちらくざ', 'かたながり'] },
  { id: 'nobunaga', name: '織田信長', reading: 'おだのぶなが', type: 'person', rice: 2, knowledge: 0, points: 0, icon: '📜', choices: ['おだのぶなが', 'とくがわいえやす', 'あけちみつひで', 'たけだしんげん'] },
  { id: 'hideyoshi', name: '豊臣秀吉', reading: 'とよとみひでよし', type: 'person', rice: 1, knowledge: 1, points: 0, icon: '📜', choices: ['とよとみひでよし', 'うえすぎけんしん', 'おだのぶなが', 'とくがわいえやす'] },
  { id: 'rakuichi', name: '楽市楽座', reading: 'らくいちらくざ', type: 'event', rice: 1, knowledge: 0, points: 0, icon: '🏮', choices: ['らくいちらくざ', 'じょうかまち', 'かたながり', 'てんかとういつ'] },
  { id: 'katanagari', name: '刀狩', reading: 'かたながり', type: 'event', rice: 0, knowledge: 1, points: 1, icon: '🏮', choices: ['かたながり', 'せきしょ', 'ねんぐ', 'そんらく'] },
  { id: 'kenshin', name: '上杉謙信', reading: 'うえすぎけんしん', type: 'person', rice: 1, knowledge: 2, points: 0, icon: '📜', choices: ['うえすぎけんしん', 'たけだしんげん', 'あけちみつひで', 'とよとみひでよし'] },
  { id: 'ieyasu', name: '徳川家康', reading: 'とくがわいえやす', type: 'person', rice: 1, knowledge: 1, points: 0, icon: '📜', choices: ['とくがわいえやす', 'おだのぶなが', 'たけだしんげん', 'うえすぎけんしん'] },
  { id: 'rice-large', name: '年貢', reading: 'ねんぐ', type: 'resource', rice: 3, knowledge: 0, points: 0, icon: '🌾', choices: ['ねんぐ', 'こめだわら', 'こめぶくろ', 'そんらく'] },
  { id: 'tenka', name: '天下統一', reading: 'てんかとういつ', type: 'event', rice: 1, knowledge: 0, points: 1, icon: '🏮', choices: ['てんかとういつ', 'らくいちらくざ', 'じょうかまち', 'せきしょ'] },
].map(card => Object.freeze({ ...card, choices: Object.freeze(card.choices) })));

export const HISTORY_PAIRS = Object.freeze([
  ['rice-small', 'rice-medium'], ['mitsuhide', 'gate'], ['nobunaga', 'hideyoshi'],
  ['rakuichi', 'katanagari'], ['kenshin', 'ieyasu'], ['rice-large', 'tenka'],
].map(pair => Object.freeze(pair)));

export const HISTORY_BUILDINGS = Object.freeze([
  Object.freeze({ id: 'village', name: '村落', reading: 'そんらく', icon: '🏡', rice: 2, knowledge: 0, points: 1 }),
  Object.freeze({ id: 'town', name: '城下町', reading: 'じょうかまち', icon: '🏯', rice: 4, knowledge: 1, points: 3 }),
  Object.freeze({ id: 'country', name: '一国', reading: 'いっこく', icon: '🗺️', rice: 6, knowledge: 3, points: 6 }),
]);

export const historyCard = id => HISTORY_CARDS.find(card => card.id === id) ?? null;
