// src/utils/romaji.js
//
// ローマ字の読みを、ひらがなに直す。
//
// なぜ要るか:
//   ことわざ400件の reading は、388件がローマ字で入っていた
//   （「焼け石に水」→ "yakeishi ni mizu"）。
//   漢字が読めない子に読み方を渡すのが reading の役目なのに、ローマ字では
//   その役に立たない（小学校でローマ字を習うのは3年生）。
//
// なぜ機械で直してよいか:
//   漢字→読み は文脈で変わるので推測してはいけないが、ローマ字→かな は
//   1対1の書き換えでしかない。推測が入らないので、嘘の読みにはならない。
//   変換できない綴りが残った場合は null を返し、呼び出し側が「読みを出さない」
//   を選べるようにしてある（まちがったかなを見せるより出さないほうがよい）。

/** 3文字の綴り（先に見る） */
const TRIPLE = {
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ', shi: 'し',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ', chi: 'ち',
  tsu: 'つ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
  zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ',
  dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ',
  cya: 'ちゃ', cyu: 'ちゅ', cyo: 'ちょ',
  shy: null, chy: null // 単独では使わない（下の2文字で拾う）
};

/** 2文字の綴り */
const DOUBLE = {
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ', ji: 'じ', je: 'じぇ',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  sa: 'さ', si: 'し', su: 'す', se: 'せ', so: 'そ',
  za: 'ざ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  ta: 'た', ti: 'ち', tu: 'つ', te: 'て', to: 'と',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  fa: 'ふぁ', fi: 'ふぃ', fu: 'ふ', fe: 'ふぇ', fo: 'ふぉ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ'
};

/** 1文字の綴り */
const SINGLE = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  n: 'ん'
};

const VOWELS = 'aiueo';

/** すでに かな（や記号）だけで書かれているか */
export function isKana(text) {
  if (!text) return false;
  return /^[぀-ゟ゠-ヿー　\s]+$/.test(String(text));
}

/**
 * ローマ字をひらがなに直す。
 *
 * @param {string} input
 * @returns {string|null} 直せたひらがな。読めない綴りが混ざっていれば null
 */
export function romajiToKana(input) {
  if (!input) return null;
  const text = String(input).toLowerCase().trim();
  if (!text) return null;

  let out = '';
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    // 区切りはそのまま残す（分かち書きは読みやすさの助けになる）
    if (ch === ' ' || ch === '　' || ch === '-' || ch === '・') {
      out += ' ';
      i++;
      continue;
    }

    // 促音: 同じ子音が続いたら「っ」（kk / tt / pp / ss など）
    if (ch === text[i + 1] && !VOWELS.includes(ch) && ch !== 'n') {
      out += 'っ';
      i++;
      continue;
    }

    // 撥音「ん」: n のうしろが母音でも y でもなければ ん。
    // n' は「ん」を明示する書き方（kawazan'you = かわざんよう）なので、
    // アポストロフィごと読み飛ばす。
    if (ch === 'n') {
      const next = text[i + 1];
      if (next === "'" || next === '’') {
        out += 'ん';
        i += 2;
        continue;
      }
      if (next === undefined || (!VOWELS.includes(next) && next !== 'y')) {
        out += 'ん';
        i++;
        continue;
      }
    }

    const three = text.substr(i, 3);
    if (TRIPLE[three]) { out += TRIPLE[three]; i += 3; continue; }

    const two = text.substr(i, 2);
    if (DOUBLE[two]) { out += DOUBLE[two]; i += 2; continue; }

    if (SINGLE[ch]) { out += SINGLE[ch]; i += 1; continue; }

    // 読めない綴り。まちがったかなを見せるより、読みを出さないほうがよい
    return null;
  }

  const result = out.replace(/\s+/g, ' ').trim();
  return result || null;
}

/**
 * 読みをそのまま使えるか判断し、ローマ字なら直して返す。
 * @param {string} reading
 * @returns {string|null} 見せてよい読み。用意できなければ null
 */
export function toDisplayReading(reading) {
  const text = (reading || '').trim();
  if (!text) return null;
  if (isKana(text)) return text;
  return romajiToKana(text);
}

export default { isKana, romajiToKana, toDisplayReading };
