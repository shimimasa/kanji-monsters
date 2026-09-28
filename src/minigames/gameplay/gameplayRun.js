import { createExplorationWorld, createRaceWorld, createTreasureWorld } from './trailWorlds.js';
import { createLanternWorld, createConstellationWorld, createBridgeWorld } from './puzzleWorlds.js';
import { createShootingWorld, createDefenseWorld } from './battleWorlds.js';
import { createRunChallenge } from './runChallenges.js';
const worlds={mathSprint:createRaceWorld, mathInvader:createShootingWorld, englishChoice:createTreasureWorld,
  sentenceOrder:createBridgeWorld, timedChoice:createLanternWorld, multiSelect:createConstellationWorld,
  asyncChoice:createExplorationWorld, kanjiDefense:createDefenseWorld};

export function createGameplayRun(gameId,effects,options={}) {
  const world=worlds[gameId]?.(effects,options);
  const challenge=createRunChallenge(gameId,options.variation);
  if (challenge && world) challenge.observeAction(world.snapshot());
  let state=null, completed=false;
  return {
    context(next){state=next;world?.context?.(next);},
    update(dt){if(!completed && state && !state.paused){world?.update?.(dt,state);if(world)challenge?.observeAction(world.snapshot());}},
    answer(correct,payload,combo){
      const before=world?.snapshot()??{};
      world?.answer(correct,payload,combo);
      challenge?.observeAnswer({correct,combo,before,world:world.snapshot(),state});
    },
    boost(){world?.boost();if(world)challenge?.observeAction(world.snapshot());},
    complete(){if(completed)return;completed=true;world?.complete?.();challenge?.complete();},
    act(action){
      if (!world||!state||state.paused||completed||typeof action!=='string'||!['answering','playing'].includes(state.phase)) return false;
      if (action.startsWith('run-goal-')) return !!challenge?.choose(action);
      const accepted=world.act?.(action);
      if (accepted) challenge?.observeAction(world.snapshot());
      return !!accepted;
    },
    allow(command){return !(gameId==='asyncChoice' && command?.type==='answer' && world.snapshot().waiting);},
    snapshot(){const current=world?.snapshot();return current&&challenge?{...current,challenge:challenge.snapshot()}:current??null;},
  };
}
