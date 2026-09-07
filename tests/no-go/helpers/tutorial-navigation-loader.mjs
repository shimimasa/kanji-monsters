export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!/\/screens\/(?:Dex\/)?(battle|practiceBattle|courseSelect|regionSelect|stageSelect|title|resultWin|profile|settings|kanjiDex|monsterDex)Screen\.js$/.test(url)) return result;
  let source = String(result.source);
  const expression = url.includes('/Dex/') ? "import('../../tutorial/TutorialManager.js')" : "import('../tutorial/TutorialManager.js')";
  if (source.split(expression).length !== 2) throw Error('Independent QA: import seam missing or ambiguous: '+url);
  if (url.endsWith('/resultWinScreen.js')) {
    const wait = 'await checkAchievements()';
    if (source.split(wait).length !== 2) throw Error('Result achievement seam changed');
    source = source.replace(wait, 'await globalThis.__holdTutorialAchievements(checkAchievements())');
  }
  return {...result, source:source.replace(expression, 'globalThis.__holdTutorialNavigation('+expression+', import.meta.url)')};
}

