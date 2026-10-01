export const LAND_RULES = Object.freeze({
  // A stage is a strip of tiles 9 high; the ground is 2 tiles high. Tile (c, r) covers x c..c+1, y r..r+1.
  rows: 9, base: 2,
  // The companion: 0.7 wide, 0.9 high (x is its middle, y its feet). Speeds in tiles per second.
  // A floaty jump (2.4 tiles up, 3.5 across) leaves about 0.3 s to take off before a 2-wide hole.
  halfW: 0.35, height: 0.9, run: 4.5, gravity: 32, jump: 12.4, maxFall: 16,
  // Kind to small hands: a jump still works this long after leaving the ground, and a press this long before landing.
  coyoteMs: 110, bufferMs: 130,
  // ゆっくり plays the same jumps slower.
  slowTime: 0.75,
  // Rolling acorns: speed, and one every so often from their bush; a bump knocks the companion back.
  acornSpeed: 1.2, acornEveryMs: 4000, knockMs: 250, safeMs: 1200,
  // Moving platforms over wide holes.
  platformW: 2, platformSpeed: 1.3,
  // Falls into holes on one stage: after this many the Gotomon build bridges over every hole.
  bridgeAfter: 3,
  // After a fall the companion comes back after this long; after the answer's door the next stage after this long.
  fallMs: 600, warpMs: 1000,
  stars: 3,
});
const R = LAND_RULES;
// Flat tiles after every piece of a stage: longer than a jump (3.5), so even an early jump lands before the next piece.
const GAP = 4;

function take(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must be in [0, 1)');
  return value;
}
const pick = (list, random) => list[Math.floor(take(random) * list.length)];
const shuffled = (items, random) => {
  const list = [...items];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(take(random) * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
};

// One stage: a start, a run of pieces (holes, steps, a raised block, a moving platform, an acorn lane),
// a checkpoint flag in the middle, and at the end a hall with four doors. Every piece can be
// crossed with one jump (a jump rises 2.4 tiles and goes 3.5 tiles across; holes are 1-2 wide,
// steps 1-2 high, the block 2 wide between 1-wide holes); the moving platform's ends touch both
// sides of its hole. Four flat tiles follow every piece: with fewer, a jump taken early landed on
// the brink of the next piece, and a bot with a child's reaction fell there.
export function buildStage(index, random) {
  const h = [], platforms = [], spawners = [];
  const flat = n => { for (let i = 0; i < n; i++) h.push(R.base); };
  flat(4);
  const kinds = ['hole', 'step', 'pillar', ...(index >= 1 ? ['acorns'] : []), ...(index >= 3 ? ['platform'] : []), ...(index >= 2 ? ['hole'] : [])];
  let last = null;
  while (h.length < 22) {
    let kind = pick(kinds, random);
    if (kind === last) kind = pick(kinds, random);
    last = kind;
    if (kind === 'hole') { const w = index < 2 ? 1 : 1 + Math.floor(take(random) * 2); for (let i = 0; i < w; i++) h.push(0); flat(GAP); }
    else if (kind === 'step') { const up = 1 + Math.floor(take(random) * 2), len = 2 + Math.floor(take(random) * 2); for (let i = 0; i < len; i++) h.push(R.base + up); flat(GAP); }
    else if (kind === 'pillar') { h.push(0, R.base + 1, R.base + 1, 0); flat(GAP); }
    else if (kind === 'acorns') { const start = h.length; flat(6); spawners.push({ spawnerId: `s${spawners.length}`, from: start + 6, to: start, every: R.acornEveryMs, left: 600 + take(random) * 1500 }); flat(GAP - 1); }
    else if (kind === 'platform') {
      const start = h.length;
      for (let i = 0; i < 4; i++) h.push(0);
      platforms.push({ platformId: `p${platforms.length}`, from: start, to: start + 4 - R.platformW, x: start + take(random) * (4 - R.platformW), dir: take(random) < 0.5 ? -1 : 1, y: R.base });
      flat(GAP);
    }
  }
  // The checkpoint: the first flat ground past the middle of the run.
  let checkpoint = 10;
  while (checkpoint < h.length - 1 && !(h[checkpoint] === R.base && h[checkpoint - 1] === R.base)) checkpoint++;
  const hall = h.length;
  flat(10);
  const doors = [hall + 2, hall + 4, hall + 6, hall + 8];
  // The ? block with a friend over flat ground before the checkpoint, stars over the run.
  const flats = h.map((v, c) => c).filter(c => c > 3 && c < hall - 1 && h[c] === R.base && h[c - 1] === R.base && h[c + 1] === R.base
    && !spawners.some(s => c >= s.to && c <= s.from));
  const block = flats.length ? { c: pick(flats, random), r: R.base + 3, used: false } : null;
  const starCols = shuffled(h.map((v, c) => c).filter(c => c > 3 && c < hall && (!block || c !== block.c)), random).slice(0, R.stars);
  const stars = starCols.map((c, i) => ({ starId: `${index}:${i}`, x: c + 0.5, y: Math.max(h[c], R.base) + 1.4 + (h[c] === 0 ? 0.6 : 0), taken: false }));
  return { index, width: h.length, h, platforms, spawners, checkpoint, hall, doors, block, stars, bridges: false };
}

// Nonpersistent Core: a side-scrolling run (like Mario). The companion runs (◀ ▶) and
// jumps over holes, up steps, onto a pillar and onto moving platforms; acorns roll in from
// bushes (a bump knocks the companion back, landing on one turns it into a star). A ? block
// hit from below lets out a Gotomon friend; stars float along the way. At the end of each
// stage four doors stand in a hall, each with a Gotomon holding a plate. A door is entered
// only by pressing はいる in front of it (never by running past), and that is the answer:
// the answer's door leads to the next stage; another door tells its plate, stays shut, and
// the answer's door glows. A hole sends the companion back to the stage start or the
// checkpoint flag, never a game over; after three falls on a stage the Gotomon build bridges
// over every hole. One learning result per stage, on its first door; every door its own problem id.
export function createLandGame({ sessionId, random = Math.random, onEvent = () => {}, content, pace = 'normal' }) {
  const problems = content?.problems ?? null;
  const slow = pace === 'slow';
  let active = true, paused = false, notifying = false, observer = onEvent;
  let phase = 'ready', seq = 0, activeElapsedMs = 0, index = 0, tries = 0, serial = 0, tilesVersion = 0;
  let stage = null, doors = [], acorns = [], acornSerial = 0;
  let x = 0, y = 0, vx = 0, vy = 0, grounded = false, face = 1, steer = 0, sinceGround = 0, jumpAsked = -1e9, knockLeft = 0, safeLeft = 0, ride = null;
  let phaseLeft = 0, falls = 0, totalFalls = 0, reachedCheckpoint = false, starsTaken = 0, friends = 0, bumps = 0, stomps = 0;
  let answered = 0, correct = 0, incorrect = 0, hintPlateId = null;
  let result = null, lastDoor = null, lastFall = null, lastPickup = null, lastBump = null, lastHelp = null, lastBlocked = null, aborted = false, completeEmitted = false;
  let problem = null, attemptId = null;
  const missed = [];

  const current = () => problems?.[index] ?? null;
  const heightAt = c => (c < 0 || c >= stage.width ? 99 : stage.h[c]);
  // Solid tiles: the ground, the ? block, bridges over holes (when built), and the walls at both ends.
  const solid = (c, r) => {
    if (r < 0) return false;
    if (c < 0 || c >= stage.width) return true;
    if (r < stage.h[c]) return true;
    if (stage.bridges && stage.h[c] === 0 && r === R.base - 1) return true;
    return !!stage.block && stage.block.c === c && stage.block.r === r;
  };
  const tiles = () => {
    const out = [];
    for (let c = 0; c < stage.width; c++) {
      for (let r = 0; r < stage.h[c]; r++) out.push(Object.freeze({ c, r, kind: r === stage.h[c] - 1 ? 'grass' : 'ground' }));
      if (stage.bridges && stage.h[c] === 0) out.push(Object.freeze({ c, r: R.base - 1, kind: 'bridge' }));
    }
    if (stage.block) out.push(Object.freeze({ c: stage.block.c, r: stage.block.r, kind: stage.block.used ? 'used' : 'block' }));
    return Object.freeze(out);
  };
  let tileCache = null, tileCacheVersion = -1;
  const doorHere = () => (grounded ? doors.find(d => Math.abs(x - (d.col + 0.5)) < 0.45) ?? null : null);
  const snapshot = () => {
    if (stage && tileCacheVersion !== tilesVersion) { tileCache = tiles(); tileCacheVersion = tilesVersion; }
    const here = phase === 'running' ? doorHere() : null;
    return Object.freeze({
      gameId: 'gotomonLand', mode: 'land', sessionId, phase, paused, active, aborted, seq, activeElapsedMs, pace: slow ? 'slow' : 'normal',
      rows: R.rows,
      stage: stage ? Object.freeze({ index: stage.index, width: stage.width, hall: stage.hall, checkpoint: stage.checkpoint, reachedCheckpoint,
        bridges: stage.bridges, tiles: tileCache, tilesVersion, h: Object.freeze([...stage.h]),
        spawners: Object.freeze(stage.spawners.map(s => Object.freeze({ spawnerId: s.spawnerId, from: s.from, to: s.to }))) }) : null,
      doors: Object.freeze(doors.map(door => Object.freeze({ ...door }))),
      platforms: Object.freeze((stage?.platforms ?? []).map(p => Object.freeze({ platformId: p.platformId, x: p.x, y: p.y, w: R.platformW, from: p.from, to: p.to }))),
      acorns: Object.freeze(acorns.map(a => Object.freeze({ acornId: a.acornId, x: a.x, y: a.y }))),
      stars: Object.freeze((stage?.stars ?? []).filter(s => !s.taken).map(s => Object.freeze({ ...s }))),
      block: stage?.block ? Object.freeze({ ...stage.block }) : null,
      player: Object.freeze({ x, y, vx, vy, grounded, face, safe: safeLeft > 0, knocked: knockLeft > 0 }),
      doorHere: here && !here.gone ? here.doorId : null, canEnter: !!(here && !here.gone),
      falls, totalFalls, bumps, stomps, starsTaken, friends, hintPlateId,
      problemIndex: Math.min(index, problems ? problems.length - 1 : 0), total: problems ? problems.length : 0,
      problem, attemptId, answered, correct, incorrect, result,
      lastDoor, lastFall, lastPickup, lastBump, lastHelp, lastBlocked, missed: Object.freeze([...missed]),
    });
  };
  const notify = (type, payload = {}, problemId = problem?.problemId ?? null) => {
    const event = Object.freeze({ version: 1, gameId: 'gotomonLand', sessionId, seq: ++seq, type,
      problemId, activeElapsedMs, payload: Object.freeze(payload) });
    notifying = true;
    try {
      const outcome = observer?.(event);
      if (outcome && typeof outcome.then === 'function') Promise.resolve(outcome).catch(() => {});
    } catch { /* Presentation observers cannot undo a committed answer. */ }
    finally { notifying = false; }
  };
  const present = () => {
    const item = current();
    problem = Object.freeze({ problemId: `${item.problemId}:${tries}`, contentId: item.contentId, skillId: item.skillId, kind: item.kind,
      prompt: item.prompt, sentence: item.sentence ?? null, answerId: item.answerId, explain: item.explain,
      choices: Object.freeze(doors.map(door => Object.freeze({ choiceId: door.plateId, text: door.text }))), correctChoiceId: item.answerId });
    attemptId = `${problem.problemId}:attempt`;
  };
  const placeAt = col => { x = col + 0.5; y = heightAt(col); vx = 0; vy = 0; grounded = true; ride = null; knockLeft = 0; sinceGround = 0; };
  const startStage = () => {
    const item = current();
    stage = buildStage(index, random); tilesVersion++;
    const plates = shuffled(item.plates, random);
    doors = stage.doors.map((col, i) => ({ doorId: `door${i}`, col, plateId: plates[i].plateId, text: plates[i].text, note: plates[i].note ?? null, cast: index * 4 + i, gone: false }));
    acorns = []; falls = 0; reachedCheckpoint = false; tries = 0; hintPlateId = null; face = 1;
    placeAt(1); phase = 'running';
    present();
    notify('problemPresented', { skillId: item.skillId, kind: item.kind });
  };
  const complete = () => {
    phase = 'completed'; problem = null; attemptId = null; hintPlateId = null;
    result = Object.freeze({ answered, correct, incorrect, accuracy: answered ? correct / answered : 0, stars: starsTaken, friends, falls: totalFalls, finished: true });
    if (!completeEmitted) { completeEmitted = true; notify('sessionComplete', result); }
  };
  const fall = () => {
    lastFall = Object.freeze({ fall: ++serial, x, stage: index });
    falls++; totalFalls++; phase = 'fall'; phaseLeft = R.fallMs; vx = 0; vy = 0;
    if (falls >= R.bridgeAfter && !stage.bridges) {
      stage.bridges = true; tilesVersion++;
      lastHelp = Object.freeze({ help: ++serial, kind: 'bridges' });
    }
  };
  // Pressing はいる in front of a door: the answer for this try.
  const enter = door => {
    const item = current(), right = door.plateId === item.answerId, first = tries === 0;
    const problemId = problem.problemId, committedAttempt = attemptId;
    if (first) { answered++; if (right) correct++; else incorrect++; }
    const answer = item.plates.find(p => p.plateId === item.answerId);
    lastDoor = Object.freeze({ door: ++serial, doorId: door.doorId, correct: right, first, col: door.col, text: door.text, note: door.note, answer: answer.text, explain: item.explain });
    const payload = { attemptId: committedAttempt, contentId: item.contentId, skillId: item.skillId, chosen: door.plateId };
    if (right) {
      hintPlateId = null; phase = 'warp'; phaseLeft = R.warpMs; vx = 0;
      notify(first ? 'correct' : 'passed', payload, problemId);
      attemptId = `${problemId}:warp`;
    } else {
      door.gone = true; hintPlateId = item.answerId;
      if (first) missed.push(Object.freeze({ contentId: item.contentId, prompt: item.prompt, chosen: door.text, explain: item.explain, questionNumber: answered }));
      notify(first ? 'incorrect' : 'retry', payload, problemId);
      tries++; present();
    }
  };
  const overlaps = (cx, cy) => {
    const c1 = Math.floor(cx - R.halfW), c2 = Math.floor(cx + R.halfW - 1e-6), r1 = Math.floor(cy), r2 = Math.floor(cy + R.height - 1e-6);
    for (let c = c1; c <= c2; c++) for (let r = r1; r <= r2; r++) if (solid(c, r)) return { c, r };
    return null;
  };
  const step = dt => {
    // Moving platforms go back and forth across their hole.
    for (const p of stage.platforms) {
      const before = p.x;
      p.x += p.dir * R.platformSpeed * dt;
      if (p.x < p.from) { p.x = p.from; p.dir = 1; }
      if (p.x > p.to) { p.x = p.to; p.dir = -1; }
      if (ride === p) x += p.x - before;
    }
    // Acorns come out of their bush and roll toward the start; they go into the next bush or a hole.
    for (const s of stage.spawners) {
      if ((s.left -= dt * 1000) <= 0) { s.left = s.every; acorns.push({ acornId: `${index}:a${acornSerial++}`, x: s.from - 0.3, y: R.base, to: s.to }); }
    }
    for (const a of acorns) a.x -= R.acornSpeed * dt;
    acorns = acorns.filter(a => a.x > a.to + 0.3);
    if (phase !== 'running') return;
    sinceGround += dt * 1000; knockLeft = Math.max(0, knockLeft - dt * 1000); safeLeft = Math.max(0, safeLeft - dt * 1000);
    if (knockLeft <= 0) { vx = steer * R.run; if (steer) face = steer; }
    // A jump: pressed a moment ago, standing or just left the ground.
    if (activeElapsedMs - jumpAsked <= R.bufferMs && (grounded || sinceGround <= R.coyoteMs)) {
      vy = R.jump; grounded = false; ride = null; jumpAsked = -1e9; sinceGround = 1e9;
    }
    // Across, then up or down, stopping at tiles.
    x += vx * dt;
    let hit = overlaps(x, y);
    if (hit) { x = vx > 0 ? hit.c - R.halfW - 1e-4 : hit.c + 1 + R.halfW + 1e-4; vx = 0; }
    grounded = false;
    vy = Math.max(-R.maxFall, vy - R.gravity * dt);
    const feet = y, falling = vy < 0;
    y += vy * dt;
    hit = overlaps(x, y);
    if (hit) {
      if (vy < 0) { y = hit.r + 1; grounded = true; }
      else {
        y = hit.r - R.height - 1e-4;
        // The ? block, hit from below.
        const b = stage.block;
        if (b && !b.used && hit.c === b.c && hit.r === b.r) {
          b.used = true; friends++; tilesVersion++;
          lastPickup = Object.freeze({ pickup: ++serial, kind: 'friend', x: b.c + 0.5, y: b.r + 1, cast: index });
        }
      }
      vy = 0;
    }
    // Standing on a moving platform: landing on it from above (every step while on it, since gravity pulls).
    if (grounded) ride = null;
    else if (vy <= 0) {
      ride = null;
      for (const p of stage.platforms) {
        if (feet >= p.y - 1e-6 && y <= p.y && x + R.halfW > p.x && x - R.halfW < p.x + R.platformW) { y = p.y; vy = 0; grounded = true; ride = p; break; }
      }
    }
    if (grounded) sinceGround = 0;
    // Acorns: landing on one turns it into a star; running into one knocks the companion back.
    for (const a of [...acorns]) {
      if (Math.abs(a.x - x) > 0.35 + R.halfW * 0.8 || y > a.y + 0.7 || y + R.height < a.y) continue;
      if (falling && feet >= a.y + 0.35) {
        acorns = acorns.filter(o => o !== a); stomps++; starsTaken++; vy = R.jump * 0.65;
        lastPickup = Object.freeze({ pickup: ++serial, kind: 'stomp', x: a.x, y: a.y });
      } else if (safeLeft <= 0) {
        bumps++; knockLeft = R.knockMs; safeLeft = R.safeMs; vx = (x < a.x ? -1 : 1) * 4; vy = 7; grounded = false; ride = null;
        lastBump = Object.freeze({ bump: ++serial, x, y });
      }
    }
    for (const star of stage.stars) {
      if (star.taken || Math.abs(star.x - x) > 0.6 || star.y < y - 0.3 || star.y > y + R.height + 0.4) continue;
      star.taken = true; starsTaken++; lastPickup = Object.freeze({ pickup: ++serial, kind: 'star', x: star.x, y: star.y });
    }
    if (!reachedCheckpoint && x >= stage.checkpoint + 0.5) reachedCheckpoint = true;
    if (y < -1.2) fall();
  };

  return {
    enter() {
      if (!active || phase !== 'ready' || notifying || !Array.isArray(problems) || !problems.length
        || problems.some(item => item.plates?.length !== 4 || !item.plates.some(plate => plate.plateId === item.answerId))) return false;
      startStage();
      return true;
    },
    update(dtMs) {
      if (!active || paused || !['running', 'fall', 'warp'].includes(phase) || !Number.isFinite(dtMs) || notifying) return;
      const real = Math.max(0, Math.min(dtMs, 100));
      activeElapsedMs += real;
      if (phase === 'fall' && (phaseLeft -= real) <= 0) { placeAt(reachedCheckpoint ? stage.checkpoint : 1); safeLeft = R.safeMs; phase = 'running'; }
      if (phase === 'warp' && (phaseLeft -= real) <= 0) {
        if (index + 1 >= problems.length) { complete(); return; }
        index++; startStage(); return;
      }
      // Small steps keep fast falls from passing through a tile.
      const world = real * (slow ? R.slowTime : 1);
      for (let left = world; left > 0 && active; left -= 8) step(Math.min(8, left) / 1000);
    },
    setPaused(value) { if (active) paused = !!value; },
    // Runs: dir -1 / 0 / 1 (held until changed).
    move({ sessionId: s, attemptId: a, dir } = {}) {
      if (!active || paused || notifying || !['running', 'fall'].includes(phase) || s !== sessionId || a !== attemptId || ![-1, 0, 1].includes(dir)) return false;
      steer = dir; return true;
    },
    jump({ sessionId: s, attemptId: a } = {}) {
      if (!active || paused || notifying || phase !== 'running' || s !== sessionId || a !== attemptId) return false;
      jumpAsked = activeElapsedMs; return true;
    },
    // はいる: into the door the companion stands in front of.
    enterDoor({ sessionId: s, attemptId: a } = {}) {
      if (!active || paused || notifying || phase !== 'running' || s !== sessionId || a !== attemptId) return false;
      const door = doorHere();
      if (!door || door.gone) { lastBlocked = Object.freeze({ blocked: ++serial, gone: !!door }); return false; }
      enter(door); return true;
    },
    dispatch(command) {
      if (!command || typeof command !== 'object') return false;
      if (command.type === 'move') return this.move(command.payload);
      if (command.type === 'jump') return this.jump(command.payload);
      if (command.type === 'enter') return this.enterDoor(command.payload);
      return false;
    },
    snapshot,
    exit() {
      if (!active) return;
      active = false; attemptId = null; aborted = phase !== 'completed'; observer = null;
    },
  };
}
