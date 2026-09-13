// Counts are descriptive per participant. They are not population estimates.
const rate=(numerator,denominator)=>({numerator,denominator,rate:denominator?numerator/denominator:null});
export function summarizePlaytest(data) {
  if(!data||data.truncated)return {usable:false,reason:data?'capacity-limit':'no-observation'};
  const runs=data.runs;
  const summarize=items=>{
    const decisions=items.filter(run=>run.status==='completed'&&run.decision!==null&&!run.decisionCensored&&!run.decisionPrompted&&!run.assisted&&!run.technicalIssue);
    const resolved=items.filter(run=>['completed','quit'].includes(run.status)&&!run.technicalIssue);
    const switches=items.filter(run=>run.companionChangedFromPrevious!==null&&run.availableCompanions>=2&&!run.technicalIssue&&!runs[runs.indexOf(run)-1]?.technicalIssue);
    return {starts:items.length,completed:items.filter(run=>run.status==='completed').length,
      excludedDecisions:items.filter(run=>run.status==='completed').length-decisions.length,
      voluntaryReplay:rate(decisions.filter(run=>run.decision==='replay').length,decisions.length),
      gameSwitch:rate(decisions.filter(run=>run.decision==='switch').length,decisions.length),
      sameGameViaHub:rate(decisions.filter(run=>run.decision==='same-game-via-hub').length,decisions.length),
      companionSwitch:rate(switches.filter(run=>run.companionChangedFromPrevious).length,switches.length),
      earlyExit:rate(resolved.filter(run=>run.quitMidGame).length,resolved.length)};
  };
  return {usable:true,anonymousParticipantId:data.anonymousParticipantId,firstGameId:data.firstGameId,
    ...summarize(runs),byGame:Object.fromEntries([...new Set(runs.map(run=>run.gameId))].map(id=>[id,summarize(runs.filter(run=>run.gameId===id))])),
    secondRunCandidates:runs.filter(run=>run.runNumberForGame===2).map(run=>({gameId:run.gameId,firstSessionId:runs.find(other=>other.gameId===run.gameId).sessionId,secondSessionId:run.sessionId,
      eligibleForObservation:[run,runs.find(other=>other.gameId===run.gameId)].every(item=>item.status==='completed'&&!item.assisted&&!item.technicalIssue),
      strategyChanged:null})),
    caveat:'Replay is only a candidate for voluntary behaviour: reconcile observer prompts, interruptions and misclicks. Strategy change requires observation, not action-count differences.'};
}
