import { createPlaytestRecorder } from './recorder.js';
import { summarizePlaytest } from './summary.js';

export const PLAYTEST_ENABLED = !!(import.meta.env?.MODE==='child-playtest' &&
  import.meta.env?.VITE_PLAYTEST_LOGGER==='1' && ['localhost','127.0.0.1','[::1]'].includes(globalThis.location?.hostname));
let recorder=null;
// Failure in optional instrumentation must never reject a game input or save.
export function trackPlaytest(type,fields) {
  if(!PLAYTEST_ENABLED)return;
  try {recorder?.record(type,fields);} catch { /* Observation can fail; the game cannot. */ }
}
export function observePlaytestCommand(sessionId,{type}={}) {
  trackPlaytest('command',{sessionId,command:type});
}
if(PLAYTEST_ENABLED&&typeof window!=='undefined') {
  recorder=createPlaytestRecorder();
  const api={
    start(options) {
      if(!document.getElementById('miniGameHub')||document.querySelector('.yt-game'))return false;
      const accepted=recorder.start({consentConfirmed:options?.consentConfirmed===true});
      if(accepted)trackPlaytest('hubShown',{});
      return accepted?recorder.snapshot().anonymousParticipantId:false;
    },
    mark:kind=>recorder.mark(kind),end:reason=>recorder.end(reason),clear:()=>recorder.clear(),
    snapshot:()=>recorder.snapshot(),summary:()=>summarizePlaytest(recorder.snapshot()),
    download() {
      const data=recorder.snapshot();if(!data)return false;
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`yomitabi-playtest-${data.anonymousParticipantId}.json`;
      document.body.append(link);link.click();link.remove();URL.revokeObjectURL(url);return true;
    },
  };
  window.yomitabiPlaytest=Object.freeze(api);
  document.addEventListener('visibilitychange',()=>trackPlaytest('visibility',{hidden:document.hidden}));
  window.addEventListener('pagehide',()=>recorder.end('interrupted'));
}
