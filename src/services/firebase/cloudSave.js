import { getDefaultSave, migrateSave, readSaveState, saveNow, captureSaveContext, isSaveContextCurrent } from '../../core/saveData.js';
import { userRootRef } from '../../core/saveSlots.js';
import { withDeadline } from '../../core/asyncDeadline.js';

const baseKey = ({ uid, slot }) => `yomitabi_cloud_base_${uid}_${slot}`;
const refFor = context => userRootRef(context.db, context.uid, context.slot).collection('progress').doc('save_v2');
function validateEnvelope(data) {
  if (data?.schema !== 2 || typeof data.revision !== 'string' || !data.revision || !data.save) throw new Error('Unsupported cloud save');
  return migrateSave(data.save);
}
function preserveRemote(context, data) {
  const key = `yomitabi_cloud_preserved_${context.uid}_${context.slot}_${encodeURIComponent(data?.revision || 'legacy')}`;
  const raw = JSON.stringify(data);
  if (localStorage.getItem(key) === raw) return;
  // A different unversioned remote must not destroy the earlier preserved copy.
  const target = localStorage.getItem(key) === null ? key : `${key}_${Date.now()}_${Math.random()}`;
  localStorage.setItem(target, raw);
  if (localStorage.getItem(target) !== raw) throw new Error('Cloud preservation failed');
}

export async function recoverCloudSave(context, { replaceCorrupt = false } = {}) {
  const status = readSaveState().status;
  const replacing = replaceCorrupt && status === 'corrupt';
  if (status !== 'missing' && !replacing) return { ok: true, recovered: false };
  const captured = captureSaveContext();
  const root = userRootRef(context.db, context.uid, context.slot);
  const snap = await withDeadline(() => refFor(context).get({ source: 'server' }));
  if (!context.isCurrent() || !isSaveContextCurrent(captured)) return { ok: false, stale: true };
  let save, revision = null;
  if (snap.exists) {
    const data = snap.data();
    preserveRemote(context, data);
    save = validateEnvelope(data); revision = data.revision;
  } else {
    // A partial legacy summary cannot safely replace an existing damaged save.
    if (replacing) return { ok: false, error: new Error('復元できる完全なクラウド記録がありません。バックアップを読み込んでください。') };
    const [profileSnap, stateSnap, progressSnap] = await withDeadline(() => Promise.all([
      root.collection('profile').doc('playerStats').get({ source: 'server' }),
      root.collection('progress').doc('state').get({ source: 'server' }),
      root.collection('progress').get({ source: 'server' })
    ]));
    if (!context.isCurrent() || !isSaveContextCurrent(captured)) return { ok: false, stale: true };
    const progress = {};
    progressSnap.forEach(doc => { if (!['state','save_v2'].includes(doc.id)) progress[doc.id] = doc.data(); });
    if (!profileSnap.exists && !stateSnap.exists && !Object.keys(progress).length) return { ok: true, recovered: false };
    const profile = profileSnap.exists ? profileSnap.data() : {};
    const state = stateSnap.exists ? stateSnap.data() : {};
    preserveRemote(context, { profile, state, progress });
    if (!profile || !state || Array.isArray(profile) || Array.isArray(state)) throw new Error('Invalid legacy cloud data');
    if (!Object.keys(profile).length && !Object.keys(state).length && !Object.keys(progress).length) return { ok: true, recovered: false };
    save = getDefaultSave();
    save.player.progress.clearedStages = Object.entries(progress).filter(([, value]) => value?.cleared === true).map(([id]) => id);
    // Old cloud summaries never contained the full learning history. Record that provenance.
    save.meta.legacyCloudRecovery = { incomplete: true, fields: [...Object.keys(profile), ...Object.keys(state)] };
    if (profile.name !== undefined) save.player.name = profile.name;
    for (const [remote, local] of Object.entries({level:'level',currentExp:'exp',maxHp:'maxHp',attack:'attack',nextLevelExp:'nextLevelExp'})) {
      if (profile[remote] !== undefined) save.player.coreStats[local] = profile[remote];
    }
    if (state.monsterDex !== undefined) save.player.collection.gotomonIds = state.monsterDex;
    if (state.kanjiDex !== undefined) save.player.collection.kanjiIds = state.kanjiDex;
    if (state.reviewQueue !== undefined) {
      if (!Array.isArray(state.reviewQueue)) throw new Error('Invalid remote review queue');
      if (state.reviewQueue.every(e => typeof e === 'string')) save.player.study.reviewQueue = state.reviewQueue;
      else save.player.study.reviewQueueDetail = state.reviewQueue;
    }
    save = migrateSave(save);
  }
  const result = saveNow(save, { replace: replacing, extraEntries: { [baseKey(context)]: JSON.stringify({ revision }) } });
  return { ...result, recovered: result.ok };
}

// Serialised by the controller. Firestore's transaction checks the server revision,
// rather than trusting a device clock or overwriting the old summaries.
export async function syncCloudSave(context) {
  const state = readSaveState();
  if (state.status !== 'valid') return { ok: false, error: new Error('No confirmed local snapshot') };
  const captured = captureSaveContext();
  const baseline = JSON.parse(localStorage.getItem(baseKey(context)) || 'null');
  const ref = refFor(context);
  const revision = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  const envelope = { schema: 2, revision, parentRevision: baseline?.revision || null, save: state.save };
  try {
    await context.db.runTransaction(async transaction => {
      const remote = await transaction.get(ref);
      if (!context.isCurrent() || !isSaveContextCurrent(captured)) throw new Error('Save context changed');
      if (remote.exists) {
        const data = remote.data();
        try { validateEnvelope(data); }
        catch (error) { preserveRemote(context, data); throw error; }
        if (!baseline || data.revision !== baseline.revision) {
          preserveRemote(context, data);
          throw new Error('Cloud history diverged; both copies retained');
        }
      } else if (baseline?.revision) throw new Error('Cloud history was removed; local copy retained');
      transaction.set(ref, envelope);
    });
    // The acknowledgement belongs to the captured child, even if a slot was switched.
    localStorage.setItem(baseKey(context), JSON.stringify({ revision }));
    return { ok: true, revision };
  } catch (error) { return { ok: false, error }; }
}
