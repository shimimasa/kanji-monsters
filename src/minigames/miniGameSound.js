import { gameExperiences } from './gameExperiences.js';

const actionScenes = new Set(['race', 'shoot', 'mole', 'land', 'tag', 'jump', 'grandprix', 'drum', 'slash', 'snake', 'meteor', 'breakout', 'shooter', 'toss', 'defend']);
const puzzleScenes = new Set(['bridge', 'stars', 'mine', 'push', 'trace', 'maze', 'othello', 'link', 'merge', 'parts', 'puyo', 'bubble', 'sort', 'memory', 'bingo',
  'room', 'cycle', 'town', 'mosaic']);

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
  move: 'miniMove', steer: 'miniMove', shift: 'miniMove',
});

export function miniGameCommandSound(command) {
  return commandSounds[command?.type] || null;
}

export function miniGameWorldSound(state) {
  if (state?.gameId === 'gotomonLand' && state.lastPickup) {
    return { id: `land:${state.lastPickup.pickup}`, key: 'miniPickup' };
  }
  if (state?.gameId === 'gotomonTag' && state.lastTouch) {
    return { id: `tag:${state.lastTouch.touch}`, key: state.lastTouch.kind === 'friend' ? 'miniPickup' : null };
  }
  return null;
}
