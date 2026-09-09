const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export const monsterVisualManifest = freeze({ schemaVersion: 1, monsters: {
  'HKD-E01': {
    monsterId: 'HKD-E01', stageIds: ['hokkaido_area1'], assetVersion: 'v1a.1',
    url: '/assets/3d/monsters/HKD-E01/HKD-E01.v1a.1.glb',
    sha256: 'da77cb290755bd40005004ecb4b036b8ac4f268888de29cd37b952bd44048d7f',
    rigKind: 'object-trs-slime-v1', assetRoot: 'HKD_E01_Root', motionNode: 'SlimeMotion',
    mesh: 'HKD_E01_Mesh', material: 'MAT_HKD_E01_Potato',
    neutralBounds: { min: [-0.5, 0, -0.31], max: [0.5, 1.08, 0.31] },
    animationEnvelope: { min: [-0.66, 0, -0.40], max: [0.66, 1.20, 0.40] },
    placementYawRadians: Math.PI, paddingLogicalPx: { x: 12, y: 6 },
    clips: {
      idle: { name: 'idle', loop: true, seconds: 2 },
      attack: { name: 'attack', loop: false, seconds: 0.75 },
      hit: { name: 'hit', loop: false, seconds: 0.5 },
      defeat: { name: 'defeat', loop: false, seconds: 1 },
    },
  },
} });
export const potatoVisual = monsterVisualManifest.monsters['HKD-E01'];

export function fitMonster(rect, layout, spec = potatoVisual) {
  const numbers = [rect?.x, rect?.y, rect?.width, rect?.height, layout?.width, layout?.height];
  if (!numbers.every(Number.isFinite)) return null;
  const { min, max } = spec.animationEnvelope, pad = spec.paddingLogicalPx;
  const width = rect.width - 2 * pad.x, height = rect.height - 2 * pad.y;
  if (width <= 0 || height <= 0 || layout.width <= 0 || layout.height <= 0) return null;
  return { scale: Math.min(width / (100 * (max[0] - min[0])), height / (100 * (max[1] - min[1]))),
    x: (rect.x + rect.width / 2 - layout.width / 2) / 100,
    y: (layout.height / 2 - rect.y - rect.height + pad.y) / 100 };
}
