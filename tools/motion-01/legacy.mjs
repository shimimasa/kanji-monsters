import { NEUTRAL_POSE } from '../../src/visuals/motion/motionProfile.js';
// Standalone reference of the stable E01 image transform, not a battle implementation.
// Stable hit uses shared Math.random. Here jitter is an explicit deterministic fixture.
export function legacyPose(action, progress, reducedMotion = false) {
  const p = Math.max(0, Math.min(1, progress));
  if (p >= 1 || action === 'idle') return NEUTRAL_POSE;
  if (action === 'attack') return { ...NEUTRAL_POSE,
    x: reducedMotion ? 0 : -(1 - Math.abs(2 * p - 1)) * 30 };
  if (action === 'hit') return { ...NEUTRAL_POSE,
    x: reducedMotion ? 0 : Math.sin(p * 30) * 10,
    y: reducedMotion ? 0 : Math.sin(p * 41) * 5 };
  if (action === 'defeat') return { ...NEUTRAL_POSE, rotation: p * Math.PI / 2, opacity: 1 - p };
  return NEUTRAL_POSE;
}
// E01's normal frame appearance from stable drawMonsterFrame (no boss/elite branches).
export function drawLegacyFrame(ctx, x, y) {
  ctx.save();
  try {
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(45, 55, 72, 0.8)';
    ctx.beginPath(); ctx.roundRect(x, y, 260, 140, 8); ctx.fill();
    ctx.strokeStyle = '#4a5568'; ctx.lineWidth = 6; ctx.stroke();
    ctx.strokeStyle = '#2d3748'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x + 6, y + 6, 248, 128, 6); ctx.stroke();
  } finally { ctx.restore(); }
  return { imageRect: { x: x + 10, y: y + 10, width: 240, height: 120 },
    clipRect: { x: x + 14, y: y + 14, width: 232, height: 112 } };
}
