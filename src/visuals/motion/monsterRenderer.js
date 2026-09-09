import { NEUTRAL_POSE, validRect } from './motionProfile.js';

// The host supplies its existing draw rect and clip; no fitting or alpha processing.
export function drawMonsterImage(ctx, image, { imageRect, clipRect, pivot = { x: .5, y: .5 } },
  pose = NEUTRAL_POSE) {
  if (!validRect(imageRect) || !validRect(clipRect) || !pose ||
    !image || image.complete === false || !(image.naturalWidth > 0) ||
    !(image.naturalHeight > 0)) return false;
  if (![pivot.x, pivot.y, pose.x, pose.y, pose.scaleX, pose.scaleY,
    pose.rotation, pose.opacity].every(Number.isFinite) ||
    pivot.x < 0 || pivot.x > 1 || pivot.y < 0 || pivot.y > 1 ||
    pose.scaleX <= 0 || pose.scaleY <= 0 || pose.opacity < 0 || pose.opacity > 1) return false;
  const { x, y, width: w, height: h } = imageRect;
  ctx.save();
  try {
    // Path2D avoids altering the caller's current path (save/restore does not save it).
    const path = new Path2D();
    path.rect(clipRect.x, clipRect.y, clipRect.width, clipRect.height);
    ctx.clip(path);
    ctx.translate(x + w * pivot.x + pose.x, y + h * pivot.y + pose.y);
    ctx.rotate(pose.rotation);
    ctx.scale(pose.scaleX, pose.scaleY);
    ctx.globalAlpha *= pose.opacity;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(image, -w * pivot.x, -h * pivot.y, w, h);
    return true;
  } finally {
    ctx.restore();
  }
}
