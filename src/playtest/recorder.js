// Development observation data only. No game imports, storage, network or free text.
export const PLAYTEST_GAMES = Object.freeze(['mathSprint','mathInvader','englishChoice','sentenceOrder','timedChoice','multiSelect','asyncChoice','kanjiDefense']);
const actions = new Set(['charge','push','safe','rare','light-tower','boost',...Array.from({length:5},(_,i)=>`route-${i}`),...Array.from({length:3},(_,i)=>`star-route-${i}`)]);
const commands = new Set(['select','submit','answer','place','reorder','toggle']);
const integer = (value,max=1e9) => Number.isFinite(value)&&value>=0 ? Math.min(max,Math.round(value)) : null;
const palId = value => typeof value==='string' && /^[A-Z]{2,5}-[A-Z]\d{2,4}$/.test(value) ? value : null;
const clone = value => JSON.parse(JSON.stringify(value));

export function createPlaytestRecorder({now=()=>performance.now(),uuid=()=>crypto.randomUUID(),maxEvents=2000,maxRuns=100}={}) {
  let data=null,origin=0,active=null,pending=null,selection=null,sourceSession=null;
  let visible=true,viewSince=null,preHelp=false;
  const time=()=>Math.max(0,Math.round(now()-origin));
  const running=()=>data?.status==='recording';
  function event(type,fields={}) {
    if(data.events.length>=maxEvents){data.truncated=true;return;}
    data.events.push({at:time(),type,...fields});
  }
  function accrue() {
    if(active?.completedAt!=null&&viewSince!==null){active.resultVisibleMs+=Math.max(0,time()-viewSince);viewSince=null;}
  }
  function choose(kind,nextGameId=null) {
    if(!pending||pending.decision!==null)return;
    pending.decision=kind;pending.decisionAt=time();pending.nextGameId=nextGameId;
    if(kind==='replay')pending.replayPressed=true;
    pending=null;
  }
  function leave(reason) {
    if(!active)return;
    accrue();active.leftAt=time();
    if(active.completedAt!==null)active.resultDwellMs=active.leftAt-active.completedAt;
    else {
      active.quitMidGame=reason==='back'||reason==='child-stop';
      active.status=active.quitMidGame?'quit':'interrupted';
      active.interruption=active.quitMidGame?null:reason;
    }
    event('runLeft',{sessionId:active.sessionId,reason});active=null;sourceSession=null;
  }
  return {
    start({consentConfirmed=false}={}) {
      if(data||!consentConfirmed)return false;
      const id=uuid();if(typeof id!=='string'||!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(id))return false;
      origin=now();active=pending=selection=null;sourceSession=null;visible=true;viewSince=null;preHelp=false;
      data={schemaVersion:1,anonymousParticipantId:`pt-${id}`,clock:'milliseconds-from-observation-start',status:'recording',startedAt:0,endedAt:null,endReason:null,truncated:false,firstGameId:null,events:[],runs:[]};
      event('observationStarted');return true;
    },
    record(type,fields={}) {
      if(!running())return;
      const gameId=PLAYTEST_GAMES.includes(fields.gameId)?fields.gameId:null;
      if(type==='hubShown'){event(type);return;}
      if(type==='gameChosen'&&gameId){
        data.firstGameId??=gameId;selection={gameId,at:time()};
        if(pending)choose(pending.gameId===gameId?'same-game-via-hub':'switch',gameId);
        event(type,{gameId});return;
      }
      if(type==='companionChosen'&&gameId&&palId(fields.gotomonId)){event(type,{gameId,gotomonId:palId(fields.gotomonId)});return;}
      if(type==='runStarted'&&gameId&&palId(fields.gotomonId)){
        if(active&&sourceSession===fields.sessionId)return;
        if(active)leave('interrupted');
        if(data.runs.length>=maxRuns){data.truncated=true;return;}
        if(pending)choose(pending.gameId===gameId?'same-game-via-hub':'switch',gameId);
        const previous=data.runs.at(-1),t=time();sourceSession=fields.sessionId;
        active={sessionId:`run-${data.runs.length+1}`,gameId,gotomonId:palId(fields.gotomonId),
          runNumberForGame:1+data.runs.filter(run=>run.gameId===gameId).length,startedAt:t,completedAt:null,leftAt:null,
          selectionToStartMs:selection?.gameId===gameId?t-selection.at:null,
          availableCompanions:integer(fields.availableCompanions,1000),companionChangedFromPrevious:previous?previous.gotomonId!==fields.gotomonId:null,
          status:'playing',quitMidGame:false,interruption:null,score:null,resultRank:null,correct:null,
          activeElapsedMs:null,levelBefore:integer(fields.level,10),levelAfter:null,earnedXP:null,saveSucceeded:null,
          replayPressed:false,decision:null,decisionAt:null,nextGameId:null,decisionCensored:false,
          resultDwellMs:null,resultVisibleMs:0,assisted:preHelp,decisionPrompted:false,technicalIssue:false,
          actionCounts:{},commandCounts:{}};
        preHelp=false;selection=null;data.runs.push(active);event(type,{sessionId:active.sessionId,gameId,gotomonId:active.gotomonId});return;
      }
      if(type==='visibility'){
        accrue();visible=fields.hidden!==true;
        if(visible&&active?.completedAt!=null)viewSince=time();
        event(type,{hidden:!visible});return;
      }
      if(!active||fields.sessionId!==sourceSession)return;
      if(type==='completed'&&active.completedAt===null){
        active.completedAt=time();active.status='completed';active.score=integer(fields.score);active.correct=integer(fields.correct,12);
        active.resultRank=['C','B','A','S'].includes(fields.resultRank)?fields.resultRank:null;
        active.activeElapsedMs=integer(fields.activeElapsedMs);pending=active;viewSince=visible?time():null;
        event(type,{sessionId:active.sessionId,resultRank:active.resultRank});return;
      }
      if(type==='reward'){
        active.saveSucceeded=fields.ok===true;
        if(fields.ok===true){active.levelAfter=integer(fields.level,10);active.earnedXP=integer(fields.earnedXP,1520);}
        return;
      }
      if(type==='action'&&actions.has(fields.action)&&active.completedAt===null){
        active.actionCounts[fields.action]=(active.actionCounts[fields.action]||0)+1;
        event(type,{sessionId:active.sessionId,action:fields.action});return;
      }
      if(type==='command'&&commands.has(fields.command)&&active.completedAt===null){
        active.commandCounts[fields.command]=(active.commandCounts[fields.command]||0)+1;
        event(type,{sessionId:active.sessionId,command:fields.command});return;
      }
      if(type==='learning'&&['correct','incorrect','partial'].includes(fields.outcome)){
        event(type,{sessionId:active.sessionId,outcome:fields.outcome});return;
      }
      if(type==='replayPressed'&&active.completedAt!==null){choose('replay',active.gameId);event(type,{sessionId:active.sessionId});return;}
      if(type==='runLeft')leave(fields.reason==='back'?'back':'interrupted');
    },
    mark(kind) {
      if(!running()||!['help','replay-prompt','technical','observer-interruption'].includes(kind))return false;
      const run=active||pending;
      if(run){if(kind==='help')run.assisted=true;else if(kind==='replay-prompt')run.decisionPrompted=true;
        else if(kind==='technical')run.technicalIssue=true;else run.decisionCensored=true;}
      else if(kind==='help'||kind==='replay-prompt')preHelp=true;
      event('observerMark',{kind,sessionId:run?.sessionId??null});return true;
    },
    end(reason='time-limit') {
      if(!running()||!['child-stop','time-limit','interrupted'].includes(reason))return false;
      if(reason==='child-stop')choose('stop');else if(pending)pending.decisionCensored=true;
      leave(reason);data.status='ended';data.endedAt=time();data.endReason=reason;event('observationEnded',{reason});return true;
    },
    snapshot() {
      if(!data)return null;
      const copy=clone(data);
      if(active?.completedAt!=null&&viewSince!==null)copy.runs.at(-1).resultVisibleMs+=Math.max(0,time()-viewSince);
      return copy;
    },
    clear() {if(running())return false;data=null;active=pending=selection=null;sourceSession=null;return true;},
  };
}
