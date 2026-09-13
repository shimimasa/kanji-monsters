const NAMES = ['やさしい弧','つなぐ翼','きらめく冠'];
const FINISH = [18,32,55];
// Three six-star routes; no additional inventory, currency or question rules.
export function createConstellationWorld(effects) {
  let stars=0,bonus=0,answered=0,mistakes=0,rainbow=false,route=1,revision=0,notice='';
  const routes=[0,0,0],lines=[0,0,0],finished=[false,false,false];
  function add(id,amount) {
    for(let n=0;n<3&&amount>.00001;n++) {
      const target=(id+n)%3,used=Math.min(6-routes[target],amount);
      routes[target]+=used;amount-=used;
      const count=Math.floor((routes[target]+.00001)/3);
      if(count>lines[target]) {bonus+=(count-lines[target])*8;lines[target]=count;notice=`${NAMES[target]}のラインがつながった！`;revision++;}
      if(routes[target]>=6&&!finished[target]) {finished[target]=true;bonus+=FINISH[target];notice=`${NAMES[target]} 完成！ +${FINISH[target]}pt`;revision++;}
    }
  }
  return {
    act(action){const id=Number(action.replace('star-route-',''));if(!action.startsWith('star-route-')||!Number.isInteger(id)||id<0||id>2||finished[id])return false;route=id;return true;},
    answer(correct,payload={}) {
      const rate=correct?1:Math.max(0,Math.min(1,payload.score||0));
      const gained=rate*(rainbow?3*effects.potency:2);
      stars+=gained;bonus+=Math.round(gained*12);answered++;notice='';
      if(!correct)mistakes++;
      const main=rainbow?gained*2/3:gained;
      // Safe route retains more partial progress; crown rewards full precision.
      const factor=route===0&&rate>0&&rate<1?1.2:route===2?(rate===1?1.2:.8):1;
      add(route,main*factor);
      if(rainbow)add((route+1)%3,gained/3);
      rainbow=false;
      if(finished.every(Boolean)){notice='3つの星座が、ひとつの空に！';revision++;}
      if(finished[route])route=Math.max(0,finished.findIndex(value=>!value));
    },
    boost(){rainbow=true;},
    snapshot(){const completed=finished.filter(Boolean).length,total=routes.reduce((a,b)=>a+b,0),selected=route<0?0:route;
      return {kind:'craft',bonus,stars,completed,rainbow,route,routes:[...routes],lines:[...lines],finishRevision:revision,notice,
        progress:total/18,climax:answered>=8||total>=15,
        metric:`星座 ${completed}/3 · ${completed===3?'空が完成！':`ライン ${lines.reduce((a,b)=>a+b,0)}/6`}`,
        caption:notice|| (rainbow?'次の正解で2つのルートが光る！':completed===3?'完成した空に、星を増やそう':`${NAMES[selected]}：あと${Math.ceil(6-routes[selected])}つ${selected===2?' · 全部正解で大きく進む':'で完成'}`),
        summary:`星座 ${completed}/3 · ライン ${lines.reduce((a,b)=>a+b,0)}/6`,
        goal:completed===3?(mistakes?'次は部分正解を減らして、星の得点を伸ばそう':'全問正解で星空完成！次は違うルート順でつなごう'):'あと少しのルートに光を集め、3つの星座へ',
        findings:NAMES.map((label,id)=>({label,icon:finished[id]?'✦':'✧',kind:finished[id]?'rare':'normal'})),
        actions:NAMES.map((name,id)=>({id:`star-route-${id}`,label:['左：部分点に強い','中央：バランス','右：完成55pt'][id],selected:route===id,enabled:!finished[id]}))};},
  };
}
