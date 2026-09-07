// js/firebaseController.js
import { gameState, saveGameData, loadGameData } from '../../core/gameState.js'; // ★★★ この行が必須 ★★★
import { firebaseConfig } from './firebaseConfig.js';   // ← 追加
import { userRootRef, getCurrentSlot } from '../../core/saveSlots.js';
import { recoverCloudSave, syncCloudSave } from './cloudSave.js';
import { withDeadline } from '../../core/asyncDeadline.js';

// ---------------------------------------------------------------------------
//  このモジュールが初回呼び出し時に:
//   1) firebase.initializeApp(firebaseConfig)  (未初期化なら)
//   2) Auth / Firestore インスタンスをキャッシュ
// ---------------------------------------------------------------------------
let auth  = null;
let db    = null;
let currentUser = null;

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
        currentUser = auth.currentUser || null;
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

    const owner = auth;
    const credential = await withDeadline(() => owner.signInAnonymously());
    if (auth !== owner) throw new Error('Authentication context changed');
    currentUser = credential.user;
    return currentUser;
}

export function getCurrentUser() {
    return currentUser;
}

export async function initializeNewPlayerData(uid, playerName) {
  if (!uid || uid !== currentUser?.uid || typeof playerName !== 'string' || !playerName.trim()) return null;
  const previous = gameState.playerName;
  gameState.playerName = playerName.trim();
  const result = saveGameData();
  if (!result.ok) { gameState.playerName = previous; return null; }
  await syncAllCaches();
  return buildProfileSummaryFromSave(result.save);
}

export async function savePlayerData() { return syncAllCaches(); }

export async function loadPlayerData() { return loadGameData(); }

export async function saveStageClearStatus() { return syncAllCaches(); }

export async function loadAllStageClearStatus() {
  const ok = await loadGameData();
  return ok ? gameState.stageProgress : null;
}

function cloudContext() {
  if (!db || !currentUser?.uid) return null;
  const uid = currentUser.uid, slot = getCurrentSlot();
  return { db, uid, slot, isCurrent: () => currentUser?.uid === uid && auth?.currentUser?.uid === uid && getCurrentSlot() === slot };
}
export async function recoverKrbSaveFromFirestoreIfMissing(options) {
  const context = cloudContext();
  if (!context) throw new Error('Cloud recovery is unavailable');
  const current = context.isCurrent;
  context.isCurrent = () => current() && (options?.isCurrent?.() ?? true);
  const result = await recoverCloudSave(context, options);
  if (result.stale) return false;
  if (!result.ok) throw result.error || new Error('Cloud recovery context changed');
  return result.recovered;
}

export async function deleteUserData(uid) {
  if (!db || !uid || uid !== currentUser?.uid) return false;
  const slot = getCurrentSlot();
  const userRef = userRootRef(db, uid, slot);
  try {
    // Finish already-started uploads before deleting the captured child's data.
    await syncTail;
    const progress = await userRef.collection('progress').get({ source: 'server' });
    const batch = db.batch();
    batch.delete(userRef.collection('profile').doc('playerStats'));
    progress.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    localStorage.removeItem(`yomitabi_cloud_base_${uid}_${slot}`);
    return true;
  } catch (error) { console.warn('Cloud reset failed', error); return false; }
}

// Live legacy summaries are deliberately not applied to an active game.
// Recovery hydrates one validated snapshot at startup; uploads use server revisions.
export async function startDataSync() { return { ok: true }; }
let syncTail = Promise.resolve();
export function syncAllCaches() {
  const context = cloudContext();
  if (!context) return Promise.resolve({ ok: false, offline: true });
  const run = () => context.isCurrent() ? syncCloudSave(context) : { ok: false, stale: true };
  syncTail = syncTail.then(run, run);
  return syncTail;
}
