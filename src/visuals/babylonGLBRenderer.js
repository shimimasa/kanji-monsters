import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { createGLBPreparation } from './glbPreparation.js';
import { createGLBPlayback, createGLBTimeline } from './glbTimeline.js';
import { potatoVisual, fitMonster } from './monsterVisualManifest.js';

// Internal factory name retained for the V0 adapter/factory contract.
export function preparePrimitive({ canvas, onFailure, timeline, isCurrent = () => true }) {
  let engine, scene, preparation, playback, placement, disposed = false, listener = false, width = 0, height = 0;
  const localTimeline = timeline || createGLBTimeline();
  const fail = error => { dispose(); onFailure(error); };
  const lost = event => { event.preventDefault(); fail(new Error('WebGL context lost')); };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (listener) canvas.removeEventListener('webglcontextlost', lost);
    listener = false;
    try { playback?.stop(); } finally {
      playback = null;
      try { preparation?.dispose(); } finally {
        placement?.dispose(); placement = null;
        try { scene?.dispose(); } finally { engine?.dispose(); }
      }
    }
  };
  try {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 2 unavailable');
    engine = new Engine(gl, true, { doNotHandleContextLost: true, audioEngine: false, canvasTabIndex: -1 });
    if (engine.webGLVersion !== 2) throw new Error('WebGL 2 required');
    canvas.tabIndex = -1;
    scene = new Scene(engine); scene.detachControl();
    scene.clearColor = new Color4(0.12, 0.20, 0.28, 1);
    const camera = new FreeCamera('fixed', new Vector3(0, 0, -10), scene);
    camera.mode = 1; camera.setTarget(Vector3.Zero()); camera.inputs.clear(); camera.minZ = 0.1; camera.maxZ = 30;
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, -1), scene); ambient.intensity = 0.7;
    const main = new DirectionalLight('main', new Vector3(-1, -1, 1), scene); main.intensity = 0.65;
    const ground = CreatePlane('stage-plane', { width: 20, height: 2.2 }, scene);
    ground.position.set(0, -2, 2); ground.isPickable = false;
    const groundMaterial = new StandardMaterial('ground', scene);
    groundMaterial.diffuseColor = new Color3(0.23, 0.30, 0.24); groundMaterial.specularColor = Color3.Black(); ground.material = groundMaterial;
    canvas.addEventListener('webglcontextlost', lost); listener = true;
    preparation = createGLBPreparation({ scene, isCurrent: () => !disposed && isCurrent(), onFailure: fail,
      materialReady: ({ mesh, material }) => {
        mesh.computeWorldMatrix(true); scene.incrementRenderId();
        return mesh.subMeshes.every(sub => material.isReadyForSubMesh(mesh, sub, false)) && groundMaterial.isReady(ground);
      },
      activate(container, asset) {
        placement = new TransformNode('YomitabiVisualPlacement', scene);
        placement.rotation.y = potatoVisual.placementYawRadians;
        asset.loaderRoot.parent = placement; // Preserve the loader's handedness transform.
        for (const mesh of container.meshes) mesh.isPickable = false;
        playback = createGLBPlayback(asset.groups, asset.motion);
        container.addAllToScene();
      },
    });
    return {
      resize(layout) {
        if (disposed) return;
        const w = Math.max(1, Math.round(layout.content.width * layout.dpr)), h = Math.max(1, Math.round(layout.content.height * layout.dpr));
        if (w !== width || h !== height) { width = w; height = h; engine.setSize(w, h); }
        camera.orthoLeft = -layout.width / 200; camera.orthoRight = layout.width / 200;
        camera.orthoTop = layout.height / 200; camera.orthoBottom = -layout.height / 200;
      },
      present(snapshot, dt, layout) {
        if (disposed || gl.isContextLost()) throw new Error('Renderer unavailable');
        if (!timeline) localTimeline.observe(snapshot, dt);
        if (!preparation.ready) return false;
        if (snapshot.enemyId !== potatoVisual.monsterId || !potatoVisual.stageIds.includes(snapshot.stageId)) return false;
        const fit = fitMonster(snapshot.monsterRect, layout);
        if (!fit) return false;
        placement.position.set(fit.x, fit.y, 0); placement.scaling.setAll(fit.scale);
        playback.sample(localTimeline.current());
        engine.beginFrame();
        try { scene.render(); } finally { engine.endFrame(); }
        return scene.isReady();
      },
      resources() {
        const owners = disposed ? [] : [engine,scene,...scene.meshes,...scene.transformNodes,...scene.materials,...scene.animationGroups];
        const observers = owners.reduce((n, owner) => n + Object.values(owner).reduce((m, value) => m + (Array.isArray(value?.observers) ? value.observers.length : 0), 0), 0);
        return { engines: disposed ? 0 : 1, scenes: disposed ? 0 : 1, observers, listeners: disposed ? 0 : 11,
          loops: engine?._activeRenderLoops.length || 0, ...preparation?.resources(),
          placements: placement ? 1 : 0, meshes: disposed ? 0 : scene.meshes.length,
          geometries: disposed ? 0 : scene.geometries.length, materials: disposed ? 0 : scene.materials.length,
          textures: disposed ? 0 : scene.textures.length, animationGroups: disposed ? 0 : scene.animationGroups.length,
          animatables: disposed ? 0 : scene.animatables.length, animations: playback?.resources().animations || 0,
          clipStarts: playback?.resources().starts || 0, clip: localTimeline.current().clip, progress: localTimeline.current().progress };
      },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
