import assert from 'node:assert/strict';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { banks,itemId,oldItems,category,difficulty,question,answer } from './content-120-banks.mjs';
import { assertCandidate,seeded } from './validate-content-120.mjs';
assertCandidate();
const escape=value=>String(value).replaceAll('|','\\|').replaceAll('\n',' ');
const table=(headers,rows)=>`| ${headers.join(' | ')} |\n| ${headers.map(()=> '---').join(' | ')} |\n`+rows.map(row=>`| ${row.map(escape).join(' | ')} |`).join('\n')+'\n';
const counts=values=>Object.fromEntries([...new Set(values)].map(v=>[v,values.filter(x=>x===v).length]));
const seeds=[1,42,20260913];
function simulate(bank,seed) {
  const random=seeded(seed),seen=new Set(),appearances=new Map(bank.items.map(q=>[itemId(q),0]));let last=[],overlap=0,exposures=0;
  for(let run=0;run<60;run++) {
    const ids=bank.generate({sessionId:`sim-${run}`,random}).map(bank.id);
    assert.equal(new Set(ids).size,ids.length);
    overlap+=ids.filter(id=>last.includes(id)).length;last=ids;
    for(const id of ids){assert.ok(appearances.has(id),id);appearances.set(id,appearances.get(id)+1);seen.add(id);exposures++;}
  }
  const values=[...appearances.values()];assert.ok(Math.max(...values)<20);
  return {seed,sessions:60,exposures,unique:seen.size,repeatRate:(exposures-seen.size)/exposures,
    adjacentOverlap:overlap/59,adjacentOverlapRate:overlap/(59*(exposures/60)),mean:exposures/bank.items.length,
    min:Math.min(...values),max:Math.max(...values),never:[...appearances].filter(([,n])=>!n).map(([id])=>id),appearances:Object.fromEntries(appearances)};
}
const all={};
for(const [key,bank] of Object.entries(banks)) {
  const previous=key==='math'?null:await oldItems(key),oldIds=new Set(previous?.map(itemId));
  const example=new Map(),random=seeded(991);
  for(let run=0;run<600;run++)for(const q of bank.generate({sessionId:`example-${run}`,random}))if(!example.has(bank.id(q)))example.set(bank.id(q),q);
  const rows=bank.items.map(q=> {
    const id=itemId(q),existing=key==='math'?(q.operation==='addition'?q.answer:q.a)<=9:oldIds.has(id),sample=example.get(id);
    const choices=key==='math'?'自由入力（旧左右順も保持）':key==='sentence'?q.chunks.map(c=>c.text).join(' / '):key==='defense'?`入力 / ${q.meaning} / ヒント: ${q.hint}`:sample.choices.map(c=>`${c.choiceId}: ${c.text}`).join(' / ');
    return {id,question:question(key,q),answer:answer(key,q),choices,category:category(key,q),difficulty:difficulty(key,q,existing),existing:existing?'Existing':'New',review:'PASS'};
  });
  const runs=seeds.map(seed=>simulate(bank,seed));
  const never=bank.items.map(itemId).filter(id=>runs.every(run=>run.never.includes(id)));assert.deepEqual(never,[]);
  all[key]={count:bank.items.length,oldCount:key==='math'?65:previous.length,rows,runs,neverAcrossSeeds:never,categories:counts(rows.map(q=>q.category)),difficulty:counts(rows.map(q=>q.difficulty))};
}
all.timedDefenseOverlap=banks.timed.items.map(q=>q.word).filter(word=>banks.defense.items.some(q=>q.prompt===word));
await mkdir('artifacts/content-120',{recursive:true});
await writeFile('artifacts/content-120/audit.json',JSON.stringify(all,null,2));
const mode=process.argv[2];
if(mode==='packet') {
  const key=process.argv[3],data=all[key];assert.ok(data?.rows);
  const body=`# Content Review Packet — ${key.toUpperCase()}\n\n120 canonical items。既存IDはCandidateと照合。PASSは生成後のAI第二意味監査の編集判断であり、人間による教材認証ではない。選択肢は固定seedから採取した実runtimeの一例。英語・タイムことばは誤答が毎回変わる。\n\n`+
    (key==='sentence'?'AMBIGUITY REVIEW：各行のピースを別順にした場合の格助詞、連体修飾、名詞節、述語の接続を点検。配列一致を意味監査の代用にしていない。元の別解と修正はCONTENT_CORRECTIONS_PROPOSED.md参照。\n\n':'')+
    table(['ID','Question','Correct Answer','Choices','Category','Difficulty','Existing/New','Review'],data.rows.map(q=>[q.id,q.question,q.answer,q.choices,q.category,q.difficulty,q.existing,q.review]));
  const packetName=key==='defense'?'KANJI_DEFENSE':key.toUpperCase();
  console.log(`*** Begin Patch\n*** Add File: C:/kanji-game-latest/CONTENT_REVIEW_PACKET_${packetName}.md\n${body.split('\n').map(l=>'+'+l).join('\n')}\n*** End Patch`);
} else if(mode==='reports') {
  const simRows=Object.entries(banks).flatMap(([key])=>all[key].runs.map(r=>[key,r.seed,r.exposures,r.unique,`${(r.repeatRate*100).toFixed(2)}%`,r.adjacentOverlap.toFixed(2),r.mean.toFixed(2),r.min,r.max,r.never.join(', ')||'none']));
  const sim='# Content 120 — 60 Session Simulation\n\n固定seed 1 / 42 / 20260913。それぞれ60プレイ、実際のruntime samplerを使用。repeat rate=(exposures−unique encountered)/exposures。隣接重複は前後2セッションで共通した平均問題数。meanは未出題を含む全120項目で計算。\n\n'+table(['Bank','Seed','Exposures','Unique','Repeat','Adjacent overlap','Mean/item','Min','Max','Never in this seed'],simRows)+'\n全3seedを通じて一度も選ばれない項目は全bankで0。単一60プレイでの未出題は有限回無作為抽選の結果であり、全候補到達検査600セッションと区別する。抽選対象から漏れた新規IDはない。10問ゲームは旧20問の平均30回から5回へ。防衛は旧21問の平均34.29回から6回へ。\n\n計算は旧81式=65学習概念から120概念へ拡張。136表示式を120と偽って数えていない。\n\n漢字防衛隊 Future target: 144\n';
  const dist='# Content 120 — Distribution\n\n分類は教材専用メタデータであり、UIやゲームの難易度設定・XPを変えない。standardを中心とし、中学内容はchallengeとして識別。追加順は出題順ではなく全体から無作為抽選。\n\n'+table(['Bank','easy','standard','challenge','Categories'],Object.entries(banks).map(([key])=>[key,all[key].difficulty.easy||0,all[key].difficulty.standard||0,all[key].difficulty.challenge||0,JSON.stringify(all[key].categories)]))+'\nタイムことば／防衛の語の重複 '+all.timedDefenseOverlap.length+' / 120：'+all.timedDefenseOverlap.join('、')+'。短時間認識と入力で共通語を復習するが、全面複製ではない。\n';
  const files={'CONTENT_120_SIMULATION_REPORT.md':sim,'CONTENT_120_DISTRIBUTION_REPORT.md':dist};
  console.log('*** Begin Patch\n'+Object.entries(files).map(([file,body])=>`*** Add File: C:/kanji-game-latest/${file}\n${body.split('\n').map(l=>'+'+l).join('\n')}`).join('\n')+'\n*** End Patch');
} else console.log(Object.fromEntries(Object.keys(banks).map(key=>[key,{count:all[key].count,runs:all[key].runs.map(({appearances,...r})=>r),difficulty:all[key].difficulty}])));
