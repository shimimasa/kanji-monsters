import { createExplorationWorld, createRaceWorld, createTreasureWorld } from './trailWorlds.js';
import { createLanternWorld, createConstellationWorld, createBridgeWorld } from './puzzleWorlds.js';
import { createShootingWorld, createDefenseWorld } from './battleWorlds.js';
const worlds={mathSprint:createRaceWorld, mathInvader:createShootingWorld, englishChoice:createTreasureWorld,
  sentenceOrder:createBridgeWorld, timedChoice:createLanternWorld, multiSelect:createConstellationWorld,
  asyncChoice:createExplorationWorld, kanjiDefense:createDefenseWorld};

export function createGameplayRun(gameId,effects,options={}) {
  const world=worlds[gameId]?.(effects,options);
  let state=null, completed=false;
  return {
    context(next){state=next;world?.context?.(next);},
    update(dt){if(!completed && state && !state.paused)world?.update?.(dt,state);},
    answer(correct,payload,combo){world?.answer(correct,payload,combo);},
    boost(){world?.boost();},
    complete(){if(completed)return;completed=true;world?.complete?.();},
    act(action){return !!(world&&state&&!state.paused&&!completed&&['answering','playing'].includes(state.phase)&&world.act?.(action));},
    allow(command){return !(gameId==='asyncChoice' && command?.type==='answer' && world.snapshot().waiting);},
    snapshot(){return world?.snapshot()??null;},
  };
}
