import { publish } from '../core/eventBus.js';
import { images } from '../loaders/assetsLoader.js';
import { HKD_E01_MOTION } from '../visuals/motion/monsterMotionManifest.js';
import { prefersReducedMotion } from '../ui/motionPreferences.js';
import { miniGameRegistry } from './registry.js';
import { readActiveCollection } from './collectionAdapter.js';
import { createCompanionAdapter } from './companionAdapter.js';
import { gotomonService } from './gotomonService.js';
import { createCompanionPlay, answerKind } from './companionPlay.js';
import { createMiniGameShell } from './miniGameShell.js';
import { PLAYTEST_ENABLED, trackPlaytest, observePlaytestCommand } from '../playtest/developmentLogger.js';
import { scoreRank } from './scoreRank.js';
import { englishLearningService } from './englishChoice/englishLearningService.js';
import { timedLearningService } from './timedChoice/timedLearningService.js';
import { sentenceLearningService } from './sentenceOrder/sentenceLearningService.js';
import { hubActivityService } from './hubActivityService.js';
import { notebookContext } from './learningNotebook.js';
import { createRunMistakes } from './runMistakes.js';
import { companionCourse } from './companionCourses.js';
import { castForPlay } from './gotomonCast.js';
import { subjectOf } from './hubCatalog.js';

const layout = Object.freeze({ imageRect: { x: 20, y: 10, width: 240, height: 120 },
  clipRect: { x: 24, y: 14, width: 232, height: 112 } });

// The general monster loader tries other assets and generates a placeholder on
// failure. This slice permits only the existing E01 asset, with a text fallback.
export function loadCompanionImage() {
  if (images['HKD-E01']) return Promise.resolve(images['HKD-E01']);
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = callback => { image.onload = null; image.onerror = null; callback(); };
    image.onload = () => finish(() => resolve(image));
    image.onerror = () => finish(() => reject(new Error('Companion image unavailable')));
    image.src = HKD_E01_MOTION.imageUrl;
  });
}

export function createMiniGameHost({ document: doc = globalThis.document,
  window: win = globalThis.window, collection = readActiveCollection,
  makeSessionId = () => crypto.randomUUID(), random = Math.random,
  loadImage = loadCompanionImage,
  makeCompanion = createCompanionAdapter, makeView = null,
  service = gotomonService, learning = englishLearningService, timedLearning = timedLearningService, sentenceLearning = sentenceLearningService, makeShell = createMiniGameShell,
  reduced = prefersReducedMotion, onBack = () => publish('changeScreen', 'miniGameHub') } = {}) {
  let game = null, view = null, companion = null, valid = false, cleanups = [], props = null;
  let visibilityPaused = false, manualPaused = false;
  let shell = null, play = null;
  let observedResult = false;
  let learningRun = null;
  let learningAnswerCount = 0;
  let learningSaveFailed = false;
  const syncPause = () => game?.setPaused(visibilityPaused || manualPaused);
  const host = {
    enter(nextProps = {}) {
      host.exit(); props = nextProps;
      const definition = miniGameRegistry[nextProps.gameId || 'mathSprint'];
      if (!definition) throw new Error('Unknown mini game');
      const sessionId = makeSessionId(); valid = true; manualPaused = false; visibilityPaused = !!doc.hidden;
      observedResult = false;
      learningAnswerCount = 0;
      learningSaveFailed = false;
      const owned = collection(), selected = service.getSelectedGotomon();
      const gotomon = nextProps.gotomonId && owned.includes(nextProps.gotomonId)
        ? service.getGotomonById(nextProps.gotomonId) : selected;
      // Public play requires a captured companion. Injected contract fixtures can
      // still exercise the host without a DOM or a save session.
      if (doc.querySelector && !makeView && !gotomon) { valid = false; onBack(); return; }
      const owner = service.getOwner();
      const returnContext = nextProps.review && nextProps.notebookContext?.gameId === definition.id ? notebookContext(nextProps.notebookContext) : null;
      const wordLearning = doc.querySelector && !makeView ?
        (definition.id === 'englishChoice' ? learning : definition.id === 'timedChoice' ? timedLearning : definition.id === 'sentenceOrder' ? sentenceLearning : null) : null;
      const history = wordLearning?.getHistory();
      const reviewContentIds = wordLearning && nextProps.review ?
        (nextProps.practiceContentIds !== undefined ? wordLearning.getPracticeIds(nextProps.practiceContentIds) : wordLearning.getReviewIds()) : undefined;
      if (wordLearning && nextProps.review && !reviewContentIds.length) { valid = false; onBack(); return; }
      learningRun = wordLearning?.beginRun(sessionId) || null;
      const flushLearning = () => {
        const saved = learningRun?.flush();
        if (saved) learningSaveFailed = !saved.ok && learningRun.pendingCount() > 0;
        return saved;
      };
      const runMistakes = createRunMistakes({ sessionId, gameId: definition.id });
      const getRunReviewIds = () => {
        if (!wordLearning) return [];
        const savedHistory = wordLearning.getHistory();
        return wordLearning.getPracticeIds(runMistakes.ids()).filter(id => savedHistory[id]?.lastCorrect === false);
      };
      const growth = service.getGrowth?.(gotomon?.id);
      const course = !nextProps.review && nextProps.courseId === companionCourse(gotomon, definition.id)?.id
        ? companionCourse(gotomon, definition.id) : null;
      const ticket = service.beginPlay?.({ sessionId, gameId: definition.id, gotomonId: gotomon?.id });
      const pace = nextProps.pace === 'slow' ? 'slow' : 'normal';
      play = createCompanionPlay(sessionId, doc.querySelector && !makeView
        ? { gameId: definition.id, growth, support: gotomon?.support?.id, bestTimeMs: service.getProgress().games?.[definition.id]?.bestTimeMs, course, pace } : {});
      companion = makeCompanion({ sessionId, ownedMonsterIds: owned, selectedId: gotomon?.id, loadImage });
      // stageId and focusKanjiIds serve content built from the adventure (photo rally); other games ignore them.
      game = definition.create({ sessionId, random, history, reviewContentIds, sentenceLevel: nextProps.sentenceLevel, mathLevel: nextProps.mathLevel, region: nextProps.region, mode: nextProps.mode, pace,
        stageId: nextProps.stageId, focusKanjiIds: service.getFocusKanjiIds?.() ?? [], onEvent: event => {
        if (valid) { companion?.observe(event); play?.observe(event); }
        if (valid) learningRun?.observe(event);
        if (valid && wordLearning) runMistakes.observe(event);
        if (PLAYTEST_ENABLED && valid && ['correct','incorrect'].includes(event.type)) trackPlaytest('learning', {sessionId, outcome:answerKind(event)});
      } });
      const current = game;
      const createView = makeView || definition.createView;
      if (typeof createView !== 'function') throw new Error('Mini game view unavailable');
      const dispatch = command => {
        if (!valid || current !== game) return false;
        play.context(current.snapshot());
        if (!play.allowCommand(command) || current.dispatch(command) !== true) return false;
        flushLearning();
        if (PLAYTEST_ENABLED) observePlaytestCommand(sessionId,command);
        host.update(0); return true;
      };
      const goBack = () => { if (valid && current === game) { if (PLAYTEST_ENABLED) trackPlaytest('runLeft', {sessionId,reason:'back'}); host.exit(); onBack(); } };
      const replay = () => { if (valid && current === game && current.snapshot().result) { if (PLAYTEST_ENABLED) trackPlaytest('replayPressed', {sessionId}); host.enter(props); } };
      const review = () => { if (valid && current === game && current.snapshot().result) host.enter({ ...props, review: true, practiceContentIds: undefined }); };
      const normalPlay = () => { if (valid && current === game && current.snapshot().result) host.enter({ ...props, review: false, practiceContentIds: undefined, notebookContext: undefined }); };
      const retryMistakes = () => {
        if (!valid || current !== game || !current.snapshot().result || current.snapshot().paused || owner !== service.getOwner()) return;
        if (!flushLearning()?.ok) return;
        const ids = getRunReviewIds();
        if (ids.length) host.enter({ ...props, review: true, practiceContentIds: ids });
      };
      const returnToNotebook = returnContext ? () => {
        if (!valid || current !== game || !current.snapshot().result || current.snapshot().paused || !owner || owner !== service.getOwner()) return;
        if (!flushLearning()?.ok) return;
        host.exit(); publish('changeScreen', { name: 'miniGameHub', props: { notebookContext: returnContext } });
      } : null;
      view = createView({ document: doc, getSnapshot: () => current.snapshot(),
        dispatch, cast: doc.querySelector && !makeView ? castForPlay(service, Math.random, gotomon?.id) : undefined,
        onBack: goBack, onReplay: replay });
      shell = makeShell({ doc, view, definition, gotomon, play, reviewMode: !!nextProps.review, pace, course,
        onPause: value => host.setPaused(value), onBack: goBack, onReplay: replay,
        onReview: wordLearning ? review : null, onNormalPlay: normalPlay,
        onNotebook: returnToNotebook,
        onRetryMistakes: wordLearning ? retryMistakes : null, getMistakeCount: () => getRunReviewIds().length,
        getReviewCount: () => wordLearning?.getReviewIds().length || 0,
        getLearningSaveStatus: () => ({ failed: learningSaveFailed, pending: learningRun?.pendingCount() || 0 }),
        onRetryLearningSave: () => { flushLearning(); host.update(0); },
        // The build-again review done to the end: the がんばり mark on this run's sticker.
        onBuildReviewDone: () => service.markReviewSticker?.({ owner, sessionId }) ?? null,
        onRefresh: () => host.update(0),
        onAct: action => { if (play.act(action)) { if (PLAYTEST_ENABLED) trackPlaytest('action', {sessionId,action}); host.update(0); } },
        onAdvance: state => dispatch({ type: 'next', payload: { sessionId: state.sessionId, problemId: state.problem?.problemId } }),
        onBoost: () => {
          if (!play.boost(current.snapshot().paused)) return false;
          if (PLAYTEST_ENABLED) trackPlaytest('action', {sessionId,action:'boost'});
          host.update(0); return true;
        },
        award: result => {
          const saved = flushLearning();
          if (saved && !saved.ok) return saved;
          if (current.snapshot().mode === 'review') return { ok: true, practice: true };
          const outcome = current.snapshot().result?.outcome;
          const receipt=service.awardGotomonPlayResult({ owner, sessionId, ticket, gameId: definition.id, gotomonId: gotomon?.id,
            ...result, memoryFinished: outcome ? ['clear', 'defended'].includes(outcome) : result.finished, subject: subjectOf(definition.id, nextProps.mode) });
          if (PLAYTEST_ENABLED) trackPlaytest('reward', {sessionId,ok:receipt.ok,level:receipt.reward?.after?.level,earnedXP:receipt.reward?.earnedXP});
          return receipt;
        } });
      const visibility = () => { visibilityPaused = !!doc.hidden; syncPause(); host.update(0); };
      doc.addEventListener('visibilitychange', visibility);
      cleanups.push(() => doc.removeEventListener('visibilitychange', visibility));
      // Respect the visible viewport when the OS keyboard shrinks or pans it.
      const root = view.root;
      const viewport = win?.visualViewport;
      const keyboard = win?.navigator?.virtualKeyboard;
      const resize = () => {
        if (!root || !viewport) return;
        const keyboardRect = keyboard?.boundingRect;
        const height = keyboardRect?.height > 0
          ? Math.min(viewport.height, Math.max(1, keyboardRect.y - viewport.offsetTop)) : viewport.height;
        root.style.top = `${viewport.offsetTop}px`; root.style.height = `${height}px`; root.style.bottom = 'auto';
      };
      if (viewport) {
        viewport.addEventListener('resize', resize); viewport.addEventListener('scroll', resize);
        cleanups.push(() => { viewport.removeEventListener('resize', resize); viewport.removeEventListener('scroll', resize); }); resize();
      }
      if (keyboard) {
        keyboard.addEventListener('geometrychange', resize);
        cleanups.push(() => keyboard.removeEventListener('geometrychange', resize));
      }
      // Keep the underlying app out of keyboard focus while this screen owns input.
      for (const node of [...doc.body.children]) {
        if (node === root || node.tagName === 'SCRIPT') continue;
        const previous = node.inert; node.inert = true;
        cleanups.push(() => { node.inert = previous; });
      }
      if (PLAYTEST_ENABLED) trackPlaytest('runStarted', {sessionId,gameId:definition.id,gotomonId:gotomon?.id,level:growth?.level,availableCompanions:owned.length});
      syncPause(); game.enter(); host.update(0);
      // Recommendation metadata is best-effort; failed saves never block play.
      // Short review must not replace the last normal game.
      if (doc.querySelector && !makeView && !nextProps.review) {
        hubActivityService.recordStart({ gameId: definition.id, owner, gameIds: Object.keys(miniGameRegistry) });
      }
    },
    update(dtMs) {
      if (!valid) return;
      game.update(dtMs);
      const state = game.snapshot();
      // Timeouts are committed by update rather than a UI command.
      if (learningRun && state.answered !== learningAnswerCount) {
        learningAnswerCount = state.answered;
        const saved = learningRun.flush();
        learningSaveFailed = !saved.ok && learningRun.pendingCount() > 0;
      }
      play.context(state);
      play.update(state.paused ? 0 : dtMs);
      companion.update(state.paused ? 0 : dtMs, reduced());
      view.update(state, companion.inspect());
      shell?.update(state, state.paused ? 0 : dtMs);
      if (PLAYTEST_ENABLED && state.result && !observedResult) {
        observedResult=true;
        const current=play.snapshot(),gameId=props.gameId||'mathSprint',points=(state.result.score??current.learningPoints)+current.bonus;
        trackPlaytest('completed', {sessionId:state.sessionId,score:points,correct:current.correct,resultRank:scoreRank(gameId,points,current.correct).rank,activeElapsedMs:state.activeElapsedMs});
      }
      const ctx = view.canvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, view.canvas.width, view.canvas.height);
        companion.present(ctx, layout);
      }
    },
    setPaused(value) { manualPaused = !!value; syncPause(); host.update(0); },
    exit() {
      if (!valid) return;
      if (PLAYTEST_ENABLED) trackPlaytest('runLeft', {sessionId:game?.snapshot().sessionId,reason:'interrupted'});
      view?.stopInput(); valid = false;
      game?.exit(); game = null;
      learningRun?.flush(); learningRun?.close(); learningRun = null;
      companion?.dispose(); companion = null;
      shell?.dispose(); shell = null; play = null;
      cleanups.splice(0).forEach(remove => remove());
      view?.dispose(); view = null;
    },
    inspect() { return { valid, session: game?.snapshot() ?? null, companion: companion?.inspect() ?? null, play: play?.snapshot() ?? null, listeners: cleanups.length }; },
  };
  return host;
}

export default createMiniGameHost();
