// MOTION-01 only. This is not a collection, enemy or learning catalog.
export const HKD_E01_MOTION = Object.freeze({
  monsterId: 'HKD-E01',
  imageUrl: '/assets/images/monsters/full/grade1-hokkaido/HKD-E01.webp',
  motionProfile: 'slime',
  // Preserve the legacy full-image center pivot and 240 x 120 draw rectangle.
  pivot: Object.freeze({ x: .5, y: .5 }),
  floorAnchor: Object.freeze({ x: .5, y: 1 }),
  imageSize: Object.freeze({ width: 240, height: 120 }),
  // Relative to the unchanged full-image rect. Used for QA, never auto-fit.
  fixedEnvelope: Object.freeze({ minX: -.16, minY: -.1, maxX: 1.16, maxY: 1.1 }),
});
