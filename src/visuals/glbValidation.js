import { potatoVisual } from './monsterVisualManifest.js';
const demand = (condition, message) => { if (!condition) throw new Error(`GLB validation: ${message}`); };
const one = (items, name) => { const found = items.filter(x => x.name === name); demand(found.length === 1, name); return found[0]; };
const near = (a, b, tolerance = 0.02) => a.length === b.length && a.every((x, i) => Number.isFinite(x) && Math.abs(x - b[i]) <= tolerance);

export function readGLB(bytes, spec = potatoVisual) {
  demand(bytes.byteLength >= 28, 'short header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  demand(view.getUint32(0, true) === 0x46546c67 && view.getUint32(4, true) === 2, 'header');
  demand(view.getUint32(8, true) === bytes.byteLength, 'length');
  const jsonLength = view.getUint32(12, true), binOffset = 20 + jsonLength;
  demand(view.getUint32(16, true) === 0x4e4f534a && binOffset + 8 <= bytes.byteLength, 'JSON chunk');
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, binOffset)));
  demand(view.getUint32(binOffset + 4, true) === 0x004e4942 && binOffset + 8 + view.getUint32(binOffset, true) === bytes.byteLength, 'BIN chunk');
  const visit = value => {
    if (value && typeof value === 'object') {
      demand(!('uri' in value) && !('extras' in value), 'external URI / extras');
      Object.values(value).forEach(visit);
    } else if (typeof value === 'number') demand(Number.isFinite(value), 'non-finite value');
  };
  visit(json);
  demand(json.asset?.version === '2.0' && json.scenes?.length === 1 && json.scene === 0, 'scene');
  demand(json.meshes?.length === 1 && json.meshes[0].primitives?.length === 1 && json.materials?.length === 1, 'resource counts');
  for (const key of ['textures','images','skins','cameras','extensionsUsed','extensionsRequired']) demand(!json[key]?.length, key);
  demand(json.nodes?.length === 3, 'author nodes');
  const root = one(json.nodes, spec.assetRoot), motion = one(json.nodes, spec.motionNode), mesh = one(json.nodes, spec.mesh);
  demand(root.children?.length === 1 && json.nodes[root.children[0]] === motion && motion.children?.length === 1 && json.nodes[motion.children[0]] === mesh, 'hierarchy');
  for (const node of json.nodes) {
    demand(!node.matrix && near(node.translation || [0,0,0], [0,0,0], 1e-6) && near(node.scale || [1,1,1], [1,1,1], 1e-6) && near(node.rotation || [0,0,0,1], [0,0,0,1], 1e-6), 'neutral TRS');
  }
  demand(json.animations?.length === 4, 'clip count');
  for (const name of Object.keys(spec.clips)) {
    const animation = one(json.animations, name);
    demand(animation.channels.length === 3 && new Set(animation.channels.map(c => c.target.path)).size === 3, 'TRS channels');
    for (const c of animation.channels) demand(json.nodes[c.target.node] === motion && ['translation','rotation','scale'].includes(c.target.path), 'animation target');
  }
  const primitive = json.meshes[0].primitives[0];
  demand(!primitive.targets && (primitive.mode ?? 4) === 4 && primitive.material === 0, 'primitive');
  demand(Object.keys(primitive.attributes).sort().join('/') === 'COLOR_0/NORMAL/POSITION', 'attributes');
  one(json.materials, spec.material);
  return { json, bin: { byteLength: view.getUint32(binOffset, true),
    readAsync: async (offset, length) => {
      demand(offset >= 0 && length >= 0 && offset + length <= view.getUint32(binOffset, true), 'buffer range');
      return bytes.subarray(binOffset + 8 + offset, binOffset + 8 + offset + length);
    } } };
}

export async function verifyGLBHash(bytes, spec = potatoVisual) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  const actual = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  demand(actual === spec.sha256, 'SHA-256 mismatch');
}

export function validateContainer(container, spec = potatoVisual) {
  const nodes = [...container.meshes, ...container.transformNodes];
  const root = one(nodes, spec.assetRoot), motion = one(nodes, spec.motionNode), mesh = one(nodes, spec.mesh);
  const material = one(container.materials, spec.material);
  demand(container.meshes.length === 2 && container.transformNodes.length === 2 && container.materials.length === 1 && container.geometries.length === 1, 'runtime resource counts');
  demand(root.parent?.name === '__root__' && !root.parent.parent && motion.parent === root && mesh.parent === motion, 'runtime hierarchy');
  for (const key of ['textures','skeletons','morphTargetManagers','cameras','lights']) demand(!container[key]?.length, key);
  for (const node of [root,motion,mesh]) demand(near(node.position.asArray(),[0,0,0],1e-6) && near(node.scaling.asArray(),[1,1,1],1e-6) && near(node.rotationQuaternion?.asArray() || [0,0,0,1],[0,0,0,1],1e-6), 'runtime neutral TRS');
  demand(mesh.material === material && mesh.subMeshes.length === 1 && !mesh.skeleton && !mesh.morphTargetManager, 'runtime mesh');
  demand(material.getClassName() === 'PBRMaterial' && material.metallic === 0 && Math.abs(material.roughness - .9) < 1e-6 && material.alpha === 1, 'runtime material');
  const positions = mesh.getVerticesData('position'), min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
  demand(positions?.length > 0 && positions.length % 3 === 0, 'positions');
  for (let i=0; i<positions.length; i++) { const value=positions[i], axis=i%3; demand(Number.isFinite(value),'vertex'); min[axis]=Math.min(min[axis],value); max[axis]=Math.max(max[axis],value); }
  demand(near(min,spec.neutralBounds.min) && near(max,spec.neutralBounds.max) && Math.abs(min[1]) < 1e-6, 'neutral bounds');
  demand(container.animationGroups.length === 4, 'AnimationGroup count');
  const groups = {};
  for (const [name,clip] of Object.entries(spec.clips)) {
    const group = one(container.animationGroups, name); groups[name]=group;
    demand(group.targetedAnimations.length === 3 && !group.isStarted, 'animation auto-start / targets');
    demand(new Set(group.targetedAnimations.map(t => t.animation.targetProperty)).size === 3, 'duplicate property');
    for (const { target, animation } of group.targetedAnimations) {
      demand(target === motion && ['position','rotationQuaternion','scaling'].includes(animation.targetProperty), 'runtime animation target');
      const keys = animation.getKeys();
      demand(keys.length > 1 && Math.abs(keys[0].frame) < 1e-6 && Math.abs(keys.at(-1).frame / animation.framePerSecond - clip.seconds) < 1e-5, 'clip duration');
      for (const key of keys) demand(key.value.asArray().every(Number.isFinite), 'animation finite');
    }
  }
  return { root, loaderRoot: root.parent, motion, mesh, material, groups, bounds: { min, max } };
}
