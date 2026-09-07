// Hold only delivery of the real import; run the product callback and guide unchanged.
export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (!/\/screens\/(courseSelect|regionSelect|stageSelect|title)Screen\.js$/.test(url)) return result;
  const source = String(result.source);
  const expression = "import('../tutorial/TutorialManager.js')";
  if (source.split(expression).length !== 2) throw Error('Tutorial import seam changed: ' + url);
  return { ...result, source: source.replace(expression,
    `globalThis.__holdNavigationTutorial(${expression}, import.meta.url)`) };
}
