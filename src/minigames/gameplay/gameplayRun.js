import { createChestWorld, createMoleWorld, createCartWorld, createStarWorld, createBridgeRunWorld, createPhotoWorld, createCaseWorld, createTripWorld, createBingoWorld, createMemoryWorld, createShopWorld, createSortWorld, createTossWorld, createFishWorld, createDeliveryWorld, createBubbleWorld, createPuyoWorld, createShooterWorld, createBreakoutWorld, createMeteorWorld, createSnakeWorld, createPartsWorld, createSlashWorld, createColoringWorld, createDrumWorld, createRaceWorld, createMergeWorld, createLinkWorld, createOthelloWorld, createSeekWorld, createMazeWorld, createJumpWorld, createTagWorld } from './quizWorlds.js';
import { createDashWorld, createInvaderWorld, createGateWorld } from './arcadeWorlds.js';
import { createRunChallenge } from './runChallenges.js';
const worlds={mathSprint:createDashWorld, mathInvader:createInvaderWorld, englishChoice:createChestWorld,
  sentenceOrder:createBridgeRunWorld, timedChoice:createMoleWorld, multiSelect:createStarWorld,
  asyncChoice:createCartWorld, kanjiDefense:createGateWorld, photoRally:createPhotoWorld, proverbDetective:createCaseWorld, tripSugoroku:createTripWorld, kanjiBingo:createBingoWorld, kanjiMemory:createMemoryWorld, gotomonShop:createShopWorld, kanjiSort:createSortWorld, gotomonToss:createTossWorld, gotomonFishing:createFishWorld, gotomonDelivery:createDeliveryWorld, gotomonBubble:createBubbleWorld, gotomonPuyo:createPuyoWorld, gotomonShooter:createShooterWorld, gotomonBreakout:createBreakoutWorld, gotomonMeteor:createMeteorWorld, gotomonSnake:createSnakeWorld, gotomonParts:createPartsWorld, gotomonSlash:createSlashWorld, gotomonColoring:createColoringWorld, gotomonDrum:createDrumWorld, gotomonRace:createRaceWorld, gotomonMerge:createMergeWorld, gotomonLink:createLinkWorld, gotomonOthello:createOthelloWorld, gotomonSeek:createSeekWorld, gotomonMaze:createMazeWorld, gotomonJump:createJumpWorld, gotomonTag:createTagWorld};

export function createGameplayRun(gameId,effects,options={}) {
  const world=worlds[gameId]?.(effects,options);
  const challenge=createRunChallenge(gameId,options.variation,options.course);
  if (challenge && world) challenge.observeAction(world.snapshot());
  let state=null, completed=false, challengeClosed=false;
  // A world may keep playing its finish (e.g. the runner reaching the goal)
  // after the Core completes; the goal closes once that finish is over.
  const closeChallenge=()=>{if(!challengeClosed&&!world?.snapshot().holdResult){challengeClosed=true;challenge?.complete();}};
  return {
    context(next){state=next;world?.context?.(next);},
    update(dt){
      if(!state || state.paused)return;
      if(!completed){world?.update?.(dt,state);if(world)challenge?.observeAction(world.snapshot());}
      else if(world?.snapshot().holdResult){world.update?.(dt,state);challenge?.observeAction(world.snapshot());closeChallenge();}
    },
    answer(correct,payload,combo){
      world?.answer(correct,payload,combo);
      challenge?.observeAnswer({correct,combo,world:world.snapshot()});
    },
    boost(){world?.boost();if(world)challenge?.observeAction(world.snapshot());},
    complete(){if(completed)return;completed=true;world?.complete?.();closeChallenge();},
    act(action){
      if (!world||!state||state.paused||completed||typeof action!=='string'||!['answering','playing'].includes(state.phase)) return false;
      if (action.startsWith('run-goal-')) return !!challenge?.choose(action);
      const accepted=world.act?.(action);
      if (accepted) challenge?.observeAction(world.snapshot());
      return !!accepted;
    },
    allow(){return true;},
    snapshot(){const current=world?.snapshot();return current?{...current,
      ...(challenge ? {challenge:challenge.snapshot()} : {}),
      ...(options.course ? {course:{id:options.course.id,name:options.course.name,description:options.course.description}} : {})} : null;},
  };
}
