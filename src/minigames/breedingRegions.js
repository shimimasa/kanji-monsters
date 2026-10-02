// The 12 regions of はいごう: the adventure's areas. A legend's region comes from its id prefix
// (HKD-L01 → 北海道); an ordinary Gotomon's from the stage it lives in (aomori_area1 → 東北).
export const REGIONS = Object.freeze([
  ['hokkaido', '北海道'], ['tohoku', '東北'], ['kanto', '関東'], ['chubu', '中部'], ['kinki', '近畿'], ['chugoku', '中国'],
  ['shikoku', '四国'], ['kyushu', '九州'], ['asia', 'アジア'], ['europe', 'ヨーロッパ'], ['america', 'アメリカ'], ['africa', 'アフリカ'],
].map(([id, name]) => Object.freeze({ id, name })));
export const regionName = id => REGIONS.find(region => region.id === id)?.name ?? '';

export const LEGEND_REGION_BY_PREFIX = Object.freeze({
  HKD: 'hokkaido', TOH: 'tohoku', KNT: 'kanto', CHB: 'chubu', KIN: 'kinki', CHG: 'chugoku',
  SKG: 'shikoku', KYU: 'kyushu', AS: 'asia', EUR: 'europe', AME: 'america', AFR: 'africa',
});
// Old spellings of a stage id's first word.
const ALIASES = Object.freeze({ kantou: 'kanto', touhoku: 'tohoku', chuubu: 'chubu', kyusyu: 'kyushu', kyuusyuu: 'kyushu', chuugoku: 'chugoku' });
export function regionOfStage(stageId) {
  const word = String(stageId ?? '').toLowerCase().split('_')[0];
  const id = ALIASES[word] ?? word;
  return REGIONS.some(region => region.id === id) ? id : null;
}
