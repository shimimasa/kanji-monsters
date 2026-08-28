// firebase は index.html の <script> で読み込まれる compat SDK を使用するので import 不要
// import firebase from 'firebase/compat/app';
// import 'firebase/compat/firestore';
import { getCurrentUser } from './firebaseController.js';

// コレクション名
const COLL = 'progress';

// Firestore を遅延取得するヘルパ
function getDb() {
  // Firebase App が初期化されていないときは null
  if (!firebase.apps?.length) {
    console.warn('DataSync: Firebase App is not initialized yet');
    return null;
  }
  return firebase.firestore();
}

// Firestore と localStorage のキー
const LS_KEYS = {
  kanjiDex:      'krb_kanji_dex',
  monsterDex:    'krb_monster_dex',
  reviewQueue:   'krb_review_queue'
};

// 「増える一方」のコレクション。集めた図鑑が減ることは無いので、
// リモートのスナップショットで上書きせず和集合を取る。
const ADDITIVE_FIELDS = new Set(['kanjiDex', 'monsterDex']);

/**
 * ローカルとリモートのID配列を、順序を保ったまま和集合にする。
 * @param {string|null} localRaw localStorage の生の値（JSON配列を想定）
 * @param {unknown} remote Firestore 側の値
 * @returns {string[]}
 */
export function mergeAdditiveIds(localRaw, remote) {
  let local = [];
  try {
    const parsed = localRaw ? JSON.parse(localRaw) : [];
    if (Array.isArray(parsed)) local = parsed.filter(x => typeof x === 'string');
  } catch {}
  const rem = Array.isArray(remote) ? remote.filter(x => typeof x === 'string') : [];
  return [...new Set([...local, ...rem])];
}

const DataSync = {
  // Firestore のドキュメント参照
  _ref() {
    const user = getCurrentUser();
    if (!user) return null;
    const db = getDb();
    if (!db) return null;
    return db.collection('users').doc(user.uid).collection(COLL).doc('state');
  },

  // 初期化：Firestore から取得して localStorage に書き戻し
  async initialize() {
    const ref = this._ref();
    if (!ref) return;
    ref.onSnapshot(snap => {
      const data = snap.data() || {};
      Object.entries(LS_KEYS).forEach(([field, key]) => {
        if (data[field] === undefined) return;
        if (ADDITIVE_FIELDS.has(field)) {
          // NOTE: 以前は無条件に上書きしていたため、リモートが古い場合
          // （前回の同期が失敗した／オフラインで遊んだ後など）に、
          // 最初のスナップショットで集めた図鑑が黙って減る可能性があった。
          const merged = mergeAdditiveIds(localStorage.getItem(key), data[field]);
          localStorage.setItem(key, JSON.stringify(merged));
          return;
        }
        // NOTE: reviewQueue は「覚えたら消える」ため和集合にすると復習済みが
        // 復活してしまう。タイムスタンプが無く安全に解決できないので、
        // ここは従来どおりリモート優先のままにしている（要検討事項）。
        localStorage.setItem(key, JSON.stringify(data[field]));
      });
    });
  },

  // localStorage の全データを Firestore にマージ保存
  async syncAll() {
    const ref = this._ref();
    if (!ref) return;
    const payload = {};
    Object.entries(LS_KEYS).forEach(([field, key]) => {
      const raw = localStorage.getItem(key);
      payload[field] = raw ? JSON.parse(raw) : null;
    });
    try {
      await ref.set(payload, { merge: true });
    } catch (e) {
      console.warn('DataSync.syncAll error:', e);
    }
  }
};

export default DataSync;