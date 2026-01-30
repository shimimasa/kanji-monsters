// js/firebaseController.js
import { gameState } from '../../core/gameState.js'; // ★★★ この行が必須 ★★★
import { getDefaultSave, migrateSave } from '../../core/saveData.js';
import { firebaseConfig } from './firebaseConfig.js';   // ← 追加

// ---------------------------------------------------------------------------
//  このモジュールが初回呼び出し時に:
//   1) firebase.initializeApp(firebaseConfig)  (未初期化なら)
//   2) Auth / Firestore インスタンスをキャッシュ
// ---------------------------------------------------------------------------
let auth  = null;
let db    = null;
let currentUser = null;

// P0-? StepD Step2(Upload): krb_save を起点に Firestore 送信payloadを組み立てる
const KRB_SAVE_STORAGE_KEY = 'krb_save';

function __readKrbSaveNoWrite() {
  try {
    const raw = localStorage.getItem(KRB_SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // StepD Step2-Upload(安全性): krb_save は migrateSave を通した構造を前提に読む（saveNow は呼ばない）
    return migrateSave(parsed);
  } catch {
    return null;
  }
}

function __hasUsableKrbSave() {
  const save = __readKrbSaveNoWrite();
  return !!(save && save.meta && typeof save.meta.version === 'number');
}

function buildProfileSummaryFromSave(save) {
  const name = save?.player?.name;
  const stats = save?.player?.coreStats;
  if (!stats || typeof stats !== 'object') return null;

  return {
    name: typeof name === 'string' ? name : '',
    level: stats.level,
    currentExp: stats.exp,
    maxHp: stats.maxHp,
    attack: stats.attack,
    nextLevelExp: stats.nextLevelExp
  };
}

function buildProgressStateSummaryFromSave(save) {
  // Firestore(progress/state) の既存payload形（DataSync.syncAll と同等）を維持する
  // - kanjiDex / reviewQueue は現状 krb_save に完全な形で保持されていないため、挙動維持のため既存ローカルキーへフォールバックする
  const payload = { kanjiDex: null, monsterDex: null, reviewQueue: null };

  // monsterDex: krb_save.player.collection.gotomonIds があればそれを優先
  const gotomonIds = save?.player?.collection?.gotomonIds;
  if (Array.isArray(gotomonIds)) {
    payload.monsterDex = gotomonIds;
  } else {
    try {
      const raw = localStorage.getItem('krb_monster_dex');
      payload.monsterDex = raw ? JSON.parse(raw) : null;
    } catch {}
  }

  // reviewQueue: 互換のためまず既存ローカルキー形（配列オブジェクト）を維持。krb_save 側に同形があれば優先。
  const rq = save?.player?.study?.reviewQueue;
  if (Array.isArray(rq) && rq.length > 0 && typeof rq[0] === 'object') {
    payload.reviewQueue = rq;
  } else {
    try {
      const raw = localStorage.getItem('krb_review_queue');
      payload.reviewQueue = raw ? JSON.parse(raw) : null;
    } catch {}
  }

  // kanjiDex: 既存ローカルキー形（配列）を維持
  try {
    const raw = localStorage.getItem('krb_kanji_dex');
    payload.kanjiDex = raw ? JSON.parse(raw) : null;
  } catch {}

  return payload;
}

export function initializeFirebaseServices() {
      try {
        if (typeof firebase === 'undefined') {
          console.error('Firebase SDK が読み込まれていません');
          return false;
        }

        // ① app が無ければここで初期化
        if (!firebase.apps.length) {
          if (!firebaseConfig?.apiKey || firebaseConfig.apiKey === 'XXXXXXXXXXXXXXX') {
            alert('⚠ Firebase の API キーが未設定です。\nsrc/firebaseConfig.js を正しく記入してください。');
            return false;
          }
          firebase.initializeApp(firebaseConfig);
          console.log('Firebase.initializeApp() 実行済み');
        }
    
        // ② サービス取得
        auth = firebase.auth();
        db   = firebase.firestore();

        // Firestore のオフライン永続化を有効化（オフライン時もキャッシュを参照）
        db.enablePersistence({ synchronizeTabs: true })
          .catch(err => console.warn('Firestore persistence error:', err));

        console.log('Firebase Auth / Firestore を取得しました');
        return true;
      } catch (err) {
        console.error('Error initializing Firebase services:', err);
        alert('Firebase 初期化に失敗しました。ネット接続と API キーを確認してください。');
        return false;
      }
    }

export async function signInAnonymouslyIfNeeded() {
    if (!auth) {
        console.error("Auth service not initialized.");
        return null;
    }
    if (currentUser) {
        console.log("User already available (cached in controller):", currentUser.uid);
        return currentUser;
    }
    if (auth.currentUser) {
        currentUser = auth.currentUser;
        console.log("User already signed in (from auth.currentUser):", currentUser.uid);
        return currentUser;
    }

    return new Promise((resolve, reject) => {
        console.log("Attempting anonymous sign-in...");
        auth.signInAnonymously()
            .then(async (userCredential) => {
                currentUser = userCredential.user;
                console.log("New anonymous user signed in:", currentUser.uid);
                resolve(currentUser);
            })
            .catch((error) => {
                console.error("Error signing in anonymously:", error);
                currentUser = null;
                reject(error);
            });
    });
}

export function getCurrentUser() {
    return currentUser;
}

export async function initializeNewPlayerData(uid, playerName = "ななしのごんべえ") {
    if (!db || !uid || !playerName || playerName.trim() === "") {
        console.error("initializeNewPlayerData: Firestore service, UID, or playerName is missing or invalid.");
        alert("プレイヤーデータの初期化に失敗しました (情報不足)。"); // ユーザーへのフィードバック
        return null;
    }
    console.log(`Initializing new player data in Firestore for UID: ${uid} with name: ${playerName}`);
    const playerProfileRef = db.collection('users').doc(uid).collection('profile').doc('playerStats');

    const initialStats = {
        name: playerName.trim(), // ★引数のplayerNameを使用
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        level: 1,
        currentExp: 0,
        maxHp: 100,
        attack: 10,
        nextLevelExp: 100, // GDDの初期値
        // healCountはgameStateで管理し、バトル開始時にリセットするのでここでは不要かも
    };

    try {
        await playerProfileRef.set(initialStats); // 新規作成なので .set()
        console.log("New player data initialized and set in Firestore:", initialStats);

        // Firestoreへの保存成功後、ローカルのgameStateも確実に更新
        if (gameState && gameState.playerStats) {
            gameState.playerName = initialStats.name; // 名前を更新
            gameState.playerStats.level = initialStats.level;
            gameState.playerStats.exp = initialStats.currentExp;
            gameState.playerStats.maxHp = initialStats.maxHp;
            gameState.playerStats.attack = initialStats.attack;
            gameState.playerStats.nextLevelExp = initialStats.nextLevelExp;
            gameState.playerStats.healCount = 3; // 初期値
            console.log("Local gameState updated after new player data initialization.");
        } else {
            console.warn("initializeNewPlayerData: gameState or gameState.playerStats not available to update locally.");
        }
        return initialStats; // 作成したデータを返す
    } catch (error) {
        console.error("Error initializing new player data in Firestore:", error);
        alert("プレイヤーデータの初期化中にエラーが発生しました。");
        return null;
    }
}


export async function savePlayerData(playerDataToSave) {
    if (!db || !currentUser || !currentUser.uid) {
        console.warn("Cannot save player data: Firestore or User not signed in.");
        return;
    }
    const playerProfileRef = db.collection('users').doc(currentUser.uid).collection('profile').doc('playerStats');
    const save = __readKrbSaveNoWrite();
    const summaryFromSave = buildProfileSummaryFromSave(save);
    const dataForFirestore = summaryFromSave || (playerDataToSave ? { // 互換fallback（既存呼び出しを壊さない）
      name: playerDataToSave.name,
      level: playerDataToSave.level,
      currentExp: playerDataToSave.exp, // gameState.playerStats.exp とキー名を合わせる
      maxHp: playerDataToSave.maxHp,
      attack: playerDataToSave.attack,
      nextLevelExp: playerDataToSave.nextLevelExp
    } : null);
    if (!dataForFirestore) {
      console.warn("Cannot save player data: payload is missing.");
      return;
    }
    dataForFirestore.lastUpdatedAt = firebase.firestore.FieldValue.serverTimestamp();
    try {
        await playerProfileRef.set(dataForFirestore, { merge: true }); // merge: true で既存フィールドを保持
        console.log("Player data saved to Firestore:", dataForFirestore);
    } catch (error) {
        console.error("Error saving player data to Firestore:", error);
    }
}

export async function loadPlayerData() {
    if (!db || !currentUser || !currentUser.uid) {
        console.warn("Cannot load player data: Firestore or User not signed in.");
        // gameState の playerStats に GDD の初期値を設定
        Object.assign(gameState.playerStats, { level: 1, exp: 0, maxHp: 100, attack: 10, nextLevelExp: 100, healCount: 3 });
        gameState.playerName = "ゲスト";
        return;
    }
    const playerProfileRef = db.collection('users').doc(currentUser.uid).collection('profile').doc('playerStats');
    try {
        console.log(`Loading player data for UID: ${currentUser.uid}`);
        const docSnap = await playerProfileRef.get();
        if (docSnap.exists) {
            const playerDataFromDb = docSnap.data();
            console.log("Player data loaded from Firestore:", playerDataFromDb);
            // gameState.playerStats にデータを反映
            gameState.playerStats.level = playerDataFromDb.level || 1;
            gameState.playerStats.exp = playerDataFromDb.currentExp || 0;
            gameState.playerStats.maxHp = playerDataFromDb.maxHp || 100;
            gameState.playerStats.attack = playerDataFromDb.attack || 10;
            gameState.playerStats.nextLevelExp = playerDataFromDb.nextLevelExp || calculateNextLevelExp(gameState.playerStats.level); // ローカルで計算した方が良い場合も
            gameState.playerName = playerDataFromDb.name || "ななし";
            console.log("gameState updated from Firestore:", gameState.playerStats, gameState.playerName);
        } else {
            console.log("No player data found for this user. Initializing new data.");
            const initialData = await initializeNewPlayerData(currentUser.uid, gameState.playerName || "ななしのごんべえ");
            if (initialData) { // 初期化成功したらgameStateに反映
                gameState.playerStats.level = initialData.level;
                gameState.playerStats.exp = initialData.currentExp;
                gameState.playerStats.maxHp = initialData.maxHp;
                gameState.playerStats.attack = initialData.attack;
                gameState.playerStats.nextLevelExp = initialData.nextLevelExp;
                gameState.playerName = initialData.name;
            }
        }
    } catch (error) {
        console.error("Error loading player data from Firestore:", error);
        // エラー時はデフォルト値でフォールバック
        if (!gameState.playerStats.maxHp) { // 未初期化の場合の安全策
             Object.assign(gameState.playerStats, {level: 1, exp: 0, maxHp: 100, attack: 10, nextLevelExp: 100, healCount: 3});
             gameState.playerName = "ゲスト(エラー)";
        }
    }
}

export async function saveStageClearStatus(stageId) {
    if (!db || !currentUser || !currentUser.uid || !stageId) {
        console.warn("Cannot save stage clear status: Firestore, User not signed in, or stageId is missing.");
        return;
    }
    const stageProgressRef = db.collection('users').doc(currentUser.uid).collection('progress').doc(stageId);
    try {
        await stageProgressRef.set({
            cleared: true,
            clearedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }); // 存在すれば更新、なければ作成
        console.log(`Stage ${stageId} clear status saved to Firestore.`);
        // gameState.stageProgress も更新
        if (!gameState.stageProgress) gameState.stageProgress = {};
        gameState.stageProgress[stageId] = { cleared: true };
    } catch (error) {
        console.error(`Error saving stage ${stageId} clear status:`, error);
    }
}

export async function loadAllStageClearStatus() {
    if (!db || !currentUser || !currentUser.uid) {
        console.warn("Cannot load stage clear status: User not signed in.");
        gameState.stageProgress = {}; // 空のオブジェクトで初期化
        return null;
    }
    const progressCollectionRef = db.collection('users').doc(currentUser.uid).collection('progress');
    try {
        const querySnapshot = await progressCollectionRef.get();
        const allProgress = {};
        querySnapshot.forEach((doc) => {
            allProgress[doc.id] = doc.data();
        });
        console.log("All stage clear status loaded from Firestore:", allProgress);
        gameState.stageProgress = allProgress; // gameState に保存
        return allProgress;
    } catch (error) {
        console.error("Error loading all stage clear status:", error);
        gameState.stageProgress = {}; // エラー時も空で初期化
        return null;
    }
}

// ---------------------------------------------------------------------------
// StepD Step2-Download: Firestore → krb_save 復旧（krb_save が無い/破損のときのみ）
// - gameState へ直流ししない
// - Firestore はあくまで復旧用の同期キャッシュ
// ---------------------------------------------------------------------------
export async function recoverKrbSaveFromFirestoreIfMissing() {
  // krb_save が既にあれば復旧不要
  if (__hasUsableKrbSave()) return false;

  if (!db || !currentUser || !currentUser.uid) {
    console.warn('recoverKrbSaveFromFirestoreIfMissing: Firestore or User not signed in.');
    return false;
  }

  try {
    const uid = currentUser.uid;
    const playerProfileRef = db.collection('users').doc(uid).collection('profile').doc('playerStats');
    const progressStateRef = db.collection('users').doc(uid).collection('progress').doc('state');

    const [profileSnap, stateSnap] = await Promise.all([playerProfileRef.get(), progressStateRef.get()]);
    const profile = profileSnap?.exists ? (profileSnap.data() || {}) : {};
    const state = stateSnap?.exists ? (stateSnap.data() || {}) : {};

    // --- krb_save を生成 ---
    const base = getDefaultSave();
    const save = migrateSave(base);

    // profile/playerStats → krb_save.player.*
    if (typeof profile.name === 'string') save.player.name = profile.name;
    if (save.player && save.player.coreStats && typeof save.player.coreStats === 'object') {
      const cs = save.player.coreStats;
      const level = parseInt(profile.level, 10);
      const exp = parseInt(profile.currentExp, 10);
      const maxHp = parseInt(profile.maxHp, 10);
      const attack = parseInt(profile.attack, 10);
      const nextLevelExp = parseInt(profile.nextLevelExp, 10);
      if (Number.isFinite(level)) cs.level = level;
      if (Number.isFinite(exp)) cs.exp = exp;
      if (Number.isFinite(maxHp)) cs.maxHp = maxHp;
      if (Number.isFinite(attack)) cs.attack = attack;
      if (Number.isFinite(nextLevelExp)) cs.nextLevelExp = nextLevelExp;
    }

    // progress/state → 可能な範囲で krb_save とローカルキャッシュへ
    // monsterDex
    if (Array.isArray(state.monsterDex)) {
      const ids = state.monsterDex.filter(x => typeof x === 'string');
      save.player.collection.gotomonIds = ids;
      try { localStorage.setItem('krb_monster_dex', JSON.stringify(ids)); } catch {}
    }

    // reviewQueue（Firestore側はオブジェクト配列想定。krb_save には id 配列として取り込む）
    if (Array.isArray(state.reviewQueue)) {
      try { localStorage.setItem('krb_review_queue', JSON.stringify(state.reviewQueue)); } catch {}
      const ids = state.reviewQueue
        .map(e => (e && typeof e === 'object' ? e.id : e))
        .filter(Boolean)
        .map(x => String(x));
      save.player.study.reviewQueue = ids;
    }

    // kanjiDex（krb_save の正史スキーマに無いので、現状はキャッシュキーとしてのみ復旧）
    if (Array.isArray(state.kanjiDex)) {
      try { localStorage.setItem('krb_kanji_dex', JSON.stringify(state.kanjiDex)); } catch {}
    }

    save.meta.lastSavedAt = Date.now();

    try {
      localStorage.setItem(KRB_SAVE_STORAGE_KEY, JSON.stringify(save));
      console.log('Recovered krb_save from Firestore (missing/invalid local krb_save).');
      return true;
    } catch (e) {
      console.error('Failed to write recovered krb_save:', e);
      return false;
    }
  } catch (e) {
    console.error('recoverKrbSaveFromFirestoreIfMissing failed:', e);
    return false;
  }
}

export async function deleteUserData(uid) {
  if (!db || !uid) {
    console.warn('deleteUserData: db or uid missing');
    return false;
  }
  try {
    const userRef = db.collection('users').doc(uid);

    // profile/playerStats を削除
    try {
      await userRef.collection('profile').doc('playerStats').delete();
      console.log('Firestore: profile/playerStats deleted');
    } catch (e) {
      console.warn('Firestore: profile/playerStats delete skipped or failed', e);
    }

    // progress コレクション配下の全ドキュメント削除
    try {
      const progressSnap = await userRef.collection('progress').get();
      if (!progressSnap.empty) {
        const batch = db.batch();
        progressSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`Firestore: progress deleted (${progressSnap.size} docs)`);
      }
    } catch (e) {
      console.warn('Firestore: progress delete skipped or failed', e);
    }

    // 必要なら他ドキュメントも削除（存在する場合のみ）
    // 例: state ドキュメント等、運用に合わせて拡張可能

    return true;
  } catch (e) {
    console.error('deleteUserData failed:', e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// StepD Step1-1: Firestore アクセス口の一本化（dataSync.js を外部から触らせない）
// - dataSync.js 自体は変更しない
// - 循環依存を避けるため動的 import を使用
// - 例外は握りつぶさず、DataSync 側の戻り値/Promise をそのまま返す
// ---------------------------------------------------------------------------

/**
 * Firestore → localStorage の監視を開始（旧 DataSync.initialize）
 * @returns {Promise<any>} DataSync.initialize() の戻り値をそのまま返す
 */
export async function startDataSync() {
  const mod = await import('./dataSync.js');
  const DataSync = mod?.default;
  return DataSync.initialize();
}

/**
 * localStorage のキャッシュを Firestore に同期（旧 DataSync.syncAll）
 * @returns {Promise<any>} DataSync.syncAll() の戻り値をそのまま返す
 */
export async function syncAllCaches() {
  if (!db || !currentUser || !currentUser.uid) {
    console.warn('syncAllCaches: Firestore or User not signed in.');
    return;
  }
  const ref = db.collection('users').doc(currentUser.uid).collection('progress').doc('state');
  const save = __readKrbSaveNoWrite();
  const payload = buildProgressStateSummaryFromSave(save);
  try {
    return await ref.set(payload, { merge: true });
  } catch (e) {
    // 既存(DataSync.syncAll)と同様に、同期失敗は警告ログに留める（例外はここで完結）
    console.warn('syncAllCaches error:', e);
  }
}
