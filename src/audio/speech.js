// src/audio/speech.js
//
// 読みを声で確かめられるようにする薄いラッパー。
//
// なぜ要るか:
//   漢字が苦手な子ほど、耳から入れて目で確かめる経路が要る。
//   正解した時・答えを見た時に、その読みが音で返ってくると、
//   「読めた」という手応えが字と音の両方で残る。
//
// 方針:
//   ブラウザ内蔵の音声合成だけを使い、依存は増やさない。
//   使えない端末（日本語の声が入っていない等）では黙って何もしない。
//   BGM・効果音とは別系統なので、音量設定とは独立に on/off できる。

const STORAGE_KEY = 'speakReadings';

/** 日本語の声を1回だけ選んで覚えておく */
let cachedVoice = null;
let voiceResolved = false;

function pickJapaneseVoice() {
  if (voiceResolved) return cachedVoice;
  try {
    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return null; // まだ読み込まれていない。次の機会に選ぶ
    cachedVoice =
      voices.find(v => v.lang === 'ja-JP') ||
      voices.find(v => (v.lang || '').toLowerCase().startsWith('ja')) ||
      null;
    voiceResolved = true;
  } catch {
    cachedVoice = null;
  }
  return cachedVoice;
}

const Speech = {
  /** この端末で音声合成が使えるか */
  isSupported() {
    return typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof window.SpeechSynthesisUtterance === 'function';
  },

  /** 設定でONになっているか（正史は localStorage。既定はON） */
  isEnabled() {
    try {
      return (localStorage.getItem(STORAGE_KEY) ?? '1') === '1';
    } catch {
      return true;
    }
  },

  setEnabled(on) {
    try { localStorage.setItem(STORAGE_KEY, on ? '1' : '0'); } catch {}
    if (!on) this.cancel();
  },

  /**
   * 読みを声に出す。使えない・OFFの時は黙って何もしない。
   * @param {string} text ひらがなの読み
   */
  speak(text) {
    if (!text || !this.isSupported() || !this.isEnabled()) return;
    try {
      const synth = window.speechSynthesis;
      // 前の読み上げが残っていると重なるので、毎回言い直す
      synth.cancel();

      const utter = new SpeechSynthesisUtterance(String(text));
      utter.lang = 'ja-JP';
      // 子どもが聞き取れる速さに落とす
      utter.rate = 0.85;
      utter.pitch = 1.0;
      const voice = pickJapaneseVoice();
      if (voice) utter.voice = voice;
      synth.speak(utter);
    } catch {
      // 声が出せなくてもゲームは続く
    }
  },

  cancel() {
    if (!this.isSupported()) return;
    try { window.speechSynthesis.cancel(); } catch {}
  },

  /**
   * 最初のタップのときに1回だけ呼ぶ。
   *
   * iPad の Safari も Chrome も、音声合成は「ユーザーが操作した流れの中」でしか
   * 始められない（外で呼ぶと not-allowed で黙って落ちる）。ゲーム側の読み上げは
   * Enter → setTimeout → 判定 と何段か越えて呼ばれるので、その流れから外れうる。
   * ここで中身の無い発話を1回通しておくと、以後は素直に鳴るようになる。
   * BGM の自動再生対策と同じ考え方で、同じ最初のタップに相乗りさせている。
   */
  unlock() {
    if (this._unlocked || !this.isSupported()) return;
    this._unlocked = true;
    try {
      const utter = new SpeechSynthesisUtterance('');
      utter.volume = 0;
      utter.lang = 'ja-JP';
      window.speechSynthesis.speak(utter);
    } catch {}
  },

  _unlocked: false,

  /**
   * 声の一覧は非同期に届く端末があるので、起動時に一度あたためておく。
   * 失敗しても実害は無い（次に speak した時に選び直す）。
   */
  warmUp() {
    if (!this.isSupported()) return;
    try {
      pickJapaneseVoice();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => {
        voiceResolved = false;
        pickJapaneseVoice();
      }, { once: true });
    } catch {}
  }
};

export default Speech;
