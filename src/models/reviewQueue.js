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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('ReviewQueue の保存に失敗しました:', e);
    }
    import('../services/firebase/firebaseController.js')
      .then(m => m.syncAllCaches?.())
      .catch(() => {});
  };

  load();

  // SM-2 の EF 更新式
  const calcEF = (oldEF, quality) => {
    const q = Math.max(0, Math.min(5, quality));
    const newEF = oldEF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    return Math.max(1.3, newEF);
  };

  return {
    /**
     * 新規にキューへ登録。存在する場合はスキップ。
     * repetition=0, interval=0, eFactor=2.5, nextReviewAt=now で初期化
     */
    add(id) {
      if (items.some(i => i.id === id)) return;
      items.push({
        id,
        repetition: 0,
        interval:   0,
        eFactor:    2.5,
        nextReviewAt: Date.now()
      });
      save();
    },

    /**
     * SM-2 アルゴリズムで結果を登録
     * @param {string|number} id
     * @param {number} quality 0〜5 （0…完全忘却, 5…完全正解）
     */
    updateReview(id, quality) {
      const entry = items.find(i => i.id === id);
      if (!entry) return;
      if (quality < 3) {
        // 再出現を翌日に固定
        entry.repetition = 0;
        entry.interval   = 1;
      } else {
        entry.repetition++;
        if (entry.repetition === 1)      entry.interval = 1;
        else if (entry.repetition === 2) entry.interval = 6;
        else                             entry.interval = Math.round(entry.interval * entry.eFactor);
        entry.eFactor = calcEF(entry.eFactor, quality);
      }
      entry.nextReviewAt = Date.now() + entry.interval * 24 * 60 * 60 * 1000;
      save();
    },

    /**
     * 次回レビュー日時(now <= nextReviewAt) を経過している項目を取得
     * @returns Array<entry>
     */
    getDueReviews() {
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

    /** due 項目の数 */
    size() {
      return this.getDueReviews().length;
    }
  };
})();

export default reviewQueue;
