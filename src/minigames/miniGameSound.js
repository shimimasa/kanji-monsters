import { gameExperiences } from './gameExperiences.js';

const actionScenes = new Set(['race', 'shoot', 'mole', 'land', 'tag', 'jump', 'grandprix', 'drum', 'slash', 'snake', 'meteor', 'breakout', 'shooter', 'toss', 'defend']);
const puzzleScenes = new Set(['bridge', 'stars', 'mine', 'push', 'trace', 'maze', 'othello', 'link', 'merge', 'parts', 'puyo', 'bubble', 'sort', 'memory', 'bingo']);

export function miniGameBgm(gameId) {
  const scene = gameExperiences[gameId]?.scene;
  if (actionScenes.has(scene)) return 'miniGameAction';
  if (puzzleScenes.has(scene)) return 'miniGamePuzzle';
  return 'miniGameRelaxed';
}

const commandSounds = Object.freeze({
  fire: 'miniShot', shoot: 'miniShot', slash: 'miniWhoosh', throw: 'miniWhoosh',
  hop: 'miniHop', hit: 'miniPop', flip: 'miniPop', link: 'miniPop',
  paint: 'miniPop', place: 'miniPop', lay: 'miniPop', deliver: 'miniPop',
  stamp: 'miniPop', slide: 'miniPop',
});

export function miniGameCommandSound(command) {
  return commandSounds[command?.type] || null;
}
