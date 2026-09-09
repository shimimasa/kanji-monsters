// Display parameters only. No character-specific animation functions.
// Each key: [progress, x/width, y/height, scaleX, scaleY, radians, opacity].
const key = (p, x = 0, y = 0, sx = 1, sy = 1, r = 0, a = 1) =>
  Object.freeze([p, x, y, sx, sy, r, a]);
const clip = (loop, keys) => Object.freeze({ loop, keys: Object.freeze(keys) });
export const MOTION_PROFILES = Object.freeze({
  slime: Object.freeze({
    idle: clip(true, [key(0), key(.25, 0, -.006, .99, 1.012),
      key(.5), key(.75, 0, .003, 1.01, .988), key(1)]),
    attack: clip(false, [key(0), key(.2, .012, .005, 1.025, .975),
      key(.48, -.10, -.01, .98, 1.02), key(1)]),
    hit: clip(false, [key(0), key(.2, .008, .025, 1.05, .90, -.025), key(1)]),
    defeat: clip(false, [key(0), key(.3, 0, .025, 1.04, .74),
      key(1, 0, .07, .2, .2, 0, .08)]),
  }),
});
export const NEUTRAL_POSE = Object.freeze({
  x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, flash: 0, effect: 'none',
});
export function validRect(rect) {
  return !!rect && ['x', 'y', 'width', 'height'].every(k => Number.isFinite(rect[k])) &&
    rect.width > 0 && rect.height > 0 &&
    Number.isFinite(rect.x + rect.width) && Number.isFinite(rect.y + rect.height);
}
// Pure: progress is supplied by the host; sampling never advances a clock.
export function sampleMonsterPose({ profile = 'slime', action = 'idle', progress = 0,
  layout, reducedMotion = false } = {}) {
  if (!validRect(layout)) return null;
  const clips = Object.hasOwn(MOTION_PROFILES, profile) ? MOTION_PROFILES[profile] : null;
  const selected = clips && Object.hasOwn(clips, action) ? clips[action] : null;
  if (!selected || !Number.isFinite(progress)) return NEUTRAL_POSE;
  if (reducedMotion) return action === 'defeat'
    ? Object.freeze({ ...NEUTRAL_POSE, scaleX: .35, scaleY: .35, opacity: .25 })
    : NEUTRAL_POSE;
  const p = selected.loop ? ((progress % 1) + 1) % 1 : Math.max(0, Math.min(1, progress));
  const keys = selected.keys;
  let right = 1;
  while (right < keys.length - 1 && p > keys[right][0]) right++;
  const a = keys[right - 1], b = keys[right];
  const t = Math.max(0, Math.min(1, (p - a[0]) / (b[0] - a[0])));
  const ease = t * t * (3 - 2 * t);
  const at = i => a[i] + (b[i] - a[i]) * ease;
  const result = { x: at(1) * layout.width, y: at(2) * layout.height,
    scaleX: at(3), scaleY: at(4), rotation: at(5), opacity: at(6), flash: 0, effect: 'none' };
  return Object.values(result).filter(v => typeof v === 'number').every(Number.isFinite)
    ? Object.freeze(result) : null;
}
