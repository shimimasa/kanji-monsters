import { saveGameData } from '../core/gameState.js';
// reviewQueue.js
// localStorage に SM-2 用のレビューキューを永続化
// 格納データ例：{ id, repetition, interval, eFactor, nextReviewAt }

const reviewQueue = (() => {
  const STORAGE_KEY = 'krb_review_queue';
  /** @type {Array<{id:string, repetition:number, interval:number, eFactor:number, nextReviewAt:number}>} */
  let items = [];

  // ローカルストレージからロード
  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      items = Array.isArray(parsed) ? parsed : [];  // ← 常に配列に矯正
    } catch (e) {
      console.error('ReviewQueue の読み込みに失敗しました:', e);
      items = [];
    }
  };

  // ストレージへ保存
  const save = () => {
    const snapshot = items.map(e => ({ ...e }));
    const result = saveGameData(save => {
      save.player.study.reviewQueueDetail = snapshot;
      save.player.study.reviewQueue = snapshot.map(e => e.id);
    });
    load();
    return result;
  };

  load();

  // SM-2 の EF 更新式
  const calcEF = (oldEF, quality) => {
    const q = Math.max(0, Math.min(5, quality));
    const newEF = oldEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    return Math.max(1.3, newEF);
  };

  /**
   * 次に来る午前4時。初回の復習予定に使う。
   * 以前は登録時刻そのもの（＝即 due）で、1分前に間違えた字がその場で
   * 「復習待ち」に並び、同じ日のうちに詰め込む形になっていた。
   */
  const nextMorning = (now = Date.now()) => {
    const d = new Date(now);
    d.setHours(4, 0, 0, 0);
    if (now >= d.getTime()) d.setDate(d.getDate() + 1);
    return d.getTime();
  };

  const makeEntry = (id, now = Date.now()) => ({
    id, repetition: 0, interval: 0, eFactor: 2.5, nextReviewAt: nextMorning(now)
  });

  const applyQuality = (entry, quality, now = Date.now()) => {
    if (quality < 3) {
      entry.repetition = 0;
      entry.interval = 1;
    } else {
      entry.repetition++;
      if (entry.repetition === 1) entry.interval = 1;
      else if (entry.repetition === 2) entry.interval = 6;
      else entry.interval = Math.round(entry.interval * entry.eFactor);
      entry.eFactor = calcEF(entry.eFactor, quality);
    }
    entry.nextReviewAt = now + entry.interval * 24 * 60 * 60 * 1000;
  };

  return {
    /**
     * 新規にキューへ登録。存在する場合はスキップ。
     * repetition=0, interval=0, eFactor=2.5, nextReviewAt=次の午前4時 で初期化
     */
    add(id) {
      load();
      if (items.some(i => i.id === id)) return;
      items.push(makeEntry(id));
      save();
    },

    /**
     * SM-2 アルゴリズムで結果を登録
     * @param {string|number} id
     * @param {number} quality 0〜5 （0…完全忘却, 5…完全正解）
     */
    updateReview(id, quality) {
      load();
      const entry = items.find(i => i.id === id);
      if (!entry) return;
      applyQuality(entry, quality);
      save();
    },

    /** 1解答の支援状況に応じて、追加または既存予定の更新を1回の保存で行う。 */
    applyOutcome(id, { isCorrect, quality }, now = Date.now()) {
      load();
      let entry = items.find(item => item.id === id);
      let created = false;
      if (!entry && (!isCorrect || quality < 3)) {
        entry = makeEntry(id, now);
        items.push(entry);
        created = true;
      }
      if (entry) {
        // 新規の誤答は従来どおり次の午前4時。既存項目の再誤答・答え表示は翌日に戻す。
        if (!created || isCorrect) applyQuality(entry, quality, now);
      }
      return save();
    },

    /**
     * 次回レビュー日時(now <= nextReviewAt) を経過している項目を取得
     * @returns Array<entry>
     */
    getDueReviews() {
      load();
      const now = Date.now();
      return items.filter(i =>
        i != null &&
        typeof i.nextReviewAt === 'number' &&
        i.nextReviewAt <= now
      );
    },

    // NOTE: かつて popBatch(n) があったが、項目を splice で消してから ID を返すため、
    //       呼び出し側が直後に updateReview() を呼んでも items.find に失敗して
    //       黙って return し、SM-2 が一度も動いていなかった。取り出しは
    //       getDueReviews() を使い、間隔の管理は updateReview に任せること。

    /**
     * キュー全体の写しを返す（並べ替えや書き換えをしても中身は壊れない）。
     * ふりかえりの書き出しで「次にいつ出会う予定か」を出すために要る。
     * @returns Array<entry>
     */
    getAll() {
      load();
      return items.filter(Boolean).map(i => ({ ...i }));
    },

    /** due 項目の数 */
    size() {
      return this.getDueReviews().length;
    }
  };
})();

export default reviewQueue;
