import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { createPrimitivePose } from './primitivePose.js';

export function preparePrimitive({ canvas, onFailure }) {
  let engine, scene, disposed = false, listener = false, width = 0, height = 0;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (listener) canvas.removeEventListener('webglcontextlost', lost);
    listener = false;
    try { scene?.dispose(); } finally { engine?.dispose(); }
  };
  const lost = event => {
    event.preventDefault();
    // No automatic context rebuild can revive an exited scene. Re-entry may try again.
    onFailure(new Error('WebGL context lost'));
  };
  try {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: true, preserveDrawingBuffer: false });
    if (!gl) throw new Error('WebGL 2 unavailable');
    engine = new Engine(gl, true, { doNotHandleContextLost: true, audioEngine: false, canvasTabIndex: -1 });
    if (engine.webGLVersion !== 2) throw new Error('WebGL 2 required');
    canvas.tabIndex = -1; // Babylon must not make the decoration a tab stop.
    scene = new Scene(engine);
    scene.detachControl();
    scene.clearColor = new Color4(0.12, 0.20, 0.28, 1);
    const camera = new FreeCamera('fixed', new Vector3(0, 0, -10), scene);
    camera.mode = 1; // orthographic
    camera.setTarget(Vector3.Zero());
    camera.inputs.clear();
    camera.minZ = 0.1; camera.maxZ = 30;
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, -1), scene);
    ambient.intensity = 0.7;
    const main = new DirectionalLight('main', new Vector3(-1, -1, 1), scene);
    main.intensity = 0.65;
    const monster = CreateSphere('HKD-E01-primitive', { diameter: 0.82, segments: 16 }, scene);
    const material = new StandardMaterial('primitive', scene);
    material.diffuseColor = new Color3(0.72, 0.52, 0.26);
    material.specularColor = new Color3(0.1, 0.1, 0.1);
    monster.material = material;
    monster.isPickable = false;
    const ground = CreatePlane('stage-plane', { width: 20, height: 2.2 }, scene);
    ground.position.set(0, -2, 2);
    ground.isPickable = false;
    const groundMaterial = new StandardMaterial('ground', scene);
    groundMaterial.diffuseColor = new Color3(0.23, 0.30, 0.24);
    groundMaterial.specularColor = Color3.Black();
    ground.material = groundMaterial;
    const poses = createPrimitivePose();
    canvas.addEventListener('webglcontextlost', lost);
    listener = true;
    return {
      resize(layout) {
        if (disposed) return;
        const w = Math.max(1, Math.round(layout.content.width * layout.dpr));
        const h = Math.max(1, Math.round(layout.content.height * layout.dpr));
        if (w !== width || h !== height) { width = w; height = h; engine.setSize(w, h); }
        camera.orthoLeft = -layout.width / 200; camera.orthoRight = layout.width / 200;
        camera.orthoTop = layout.height / 200; camera.orthoBottom = -layout.height / 200;
      },
      present(snapshot, dt, layout) {
        if (disposed || gl.isContextLost()) throw new Error('Renderer unavailable');
        const pose = poses.sample(snapshot, dt), rect = snapshot.monsterRect;
        monster.position.set((rect.x + rect.width / 2 - layout.width / 2) / 100 + pose.x,
          (layout.height / 2 - rect.y - rect.height / 2) / 100 + pose.y, 0);
        monster.scaling.setAll(pose.scale);
        monster.rotation.z = pose.rotation;
        material.emissiveColor.set(pose.glow, pose.glow * 0.4, 0);
        engine.beginFrame();
        try { scene.render(); } finally { engine.endFrame(); }
        return scene.isReady();
      },
      resources() {
        return { engines: disposed ? 0 : 1, scenes: disposed ? 0 : 1,
          observers: disposed ? 0 : [engine, scene, camera, monster, ground, material, groundMaterial].reduce((n, owner) =>
            n + Object.values(owner).reduce((m, value) => m + (Array.isArray(value?.observers) ? value.observers.length : 0), 0), 0),
          // Engine(gl) _CommonInit registers 10 DOM listeners in pinned 9.25.0;
          // scene.detachControl removes scene input listeners. Browser diagnostics audit actual registrations.
          listeners: disposed ? 0 : 10 + (listener ? 1 : 0), animations: disposed ? 0 : 1, loops: engine._activeRenderLoops.length };
      },
      dispose,
    };
  } catch (error) { dispose(); throw error; }
}
