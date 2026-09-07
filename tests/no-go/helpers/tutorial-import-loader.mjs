// Delay only import delivery; keep the real screen callbacks and TutorialManager.
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!/\/screens\/(practiceBattleScreen|battleScreen)\.js$/.test(url)) return result;
  const source = String(result.source);
  const expression = "import('../tutorial/TutorialManager.js')";
  if (source.split(expression).length !== 2) throw Error('Tutorial import seam changed: ' + url);
  return { ...result, source: source.replace(expression,
    `globalThis.__holdTutorialImport(${expression}, import.meta.url)`) };
}
