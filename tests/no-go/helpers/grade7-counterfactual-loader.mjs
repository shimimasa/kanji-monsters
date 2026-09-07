// In-memory historical symptom, never written to product files.
export async function load(url,context,nextLoad) {
  const result=await nextLoad(url,context);
  if(!url.endsWith('/src/loaders/dataLoader.js'))return result;
  let source=String(result.source).replace(/\r\n/g,'\n');
  const fetchUpper='const response = await fetchJsonResponse(`/data/kanji_g${grade}_proto.json`);\n      return [grade, await response.json()];';
  if(source.split(fetchUpper).length!==2)throw Error('Counterfactual upper loader seam changed');
  source=source.replace(fetchUpper,'try { '+fetchUpper+' } catch { return [grade, kanjiByGrade[6]]; }');
  // Current catalog validation is a second defense. Restore the old behavior
  // end to end, including omission of this defense, for an observable success.
  const start=source.indexOf('    const catalogue = validateKanjiCatalog(Object.values(kanjiByGrade).flat());');
  const end=source.indexOf('    return { kanjiData, enemyData, stageData };',start);
  if(start<0||end<start)throw Error('Counterfactual catalog seam changed');
  source=source.slice(0,start)+source.slice(end);
  process.stderr.write('GRADE7_COUNTERFACTUAL_APPLIED\n');
  return {...result,source};
}
