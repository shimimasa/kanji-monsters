// Diagnostic only. Capture requests never mutate game state or drive its animation.
import {writeFile} from 'node:fs/promises';
export function qCapture(c,prefix){
 const records=[],pending=[];let inFlight=false;
 async function capture(reason){
  if(inFlight)return;inFlight=true;
  const row={reason,requestEpoch:Date.now(),file:prefix+'-q-snapshot-'+String(records.length).padStart(3,'0')+'.png'};records.push(row);
  try{const r=await c.send('Page.captureScreenshot',{format:'png',fromSurface:true});row.responseEpoch=Date.now();await writeFile(row.file,Buffer.from(r.data,'base64'),{flag:'wx'});}catch(e){row.error=e.message;}finally{inFlight=false;}
 }
 return {records,capture,notice(e){const work=(async()=>{await capture('Q-draw '+e.t);await new Promise(r=>setTimeout(r,25));await capture('Q-draw + next capture');})();pending.push(work);},async finish(){await Promise.all(pending);}};
}
