export const MIN_TOUCH_TARGET_CSS_PX = 44;

export function getContainedRect(rect, internalWidth, internalHeight) {
  const displayAspect = rect.width / rect.height;
  const internalAspect = internalWidth / internalHeight;
  let width = rect.width;
  let height = rect.height;
  let left = rect.left;
  let top = rect.top;
  if (displayAspect > internalAspect) {
    width = rect.height * internalAspect;
    left += (rect.width - width) / 2;
  } else if (displayAspect < internalAspect) {
    height = rect.width / internalAspect;
    top += (rect.height - height) / 2;
  }
  return { left, top, width, height, scale: width / internalWidth };
}

export function gameUnitsForCssPixels(cssPixels, scale) {
  return cssPixels / Math.max(Number.EPSILON, scale);
}
