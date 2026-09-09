// glTF 2.0 only: no glTF 1.0, OBJ, STL, splat or extension barrel registration.
import { GLTFFileLoader } from '@babylonjs/loaders/glTF/2.0/glTFLoader.js';

export function parseGLBAsset(scene, data) {
  const loader = new GLTFFileLoader({ animationStartMode: 0, compileMaterials: false,
    loadSkins: false, loadMorphTargets: false, createInstances: false });
  let disposed = false, transferred = false, loaderDisposed = false;
  const partialMeshes = new Set(), partialMaterials = new Set(), released = new WeakSet();
  const release = item => {
    if (!item || released.has(item)) return;
    released.add(item);
    if (!item.isDisposed?.()) item.dispose();
  };
  const meshObserver = loader.onMeshLoadedObservable.add(mesh => partialMeshes.add(mesh));
  const materialObserver = loader.onMaterialLoadedObservable.add(material => partialMaterials.add(material));
  const disposeObserver = loader.onDisposeObservable.add(() => { loaderDisposed = true; });
  const detach = () => {
    loader.onMeshLoadedObservable.remove(meshObserver); loader.onMaterialLoadedObservable.remove(materialObserver);
    loader.onDisposeObservable.remove(disposeObserver);
  };
  const partialCleanup = () => {
    // 9.25.0 records transforms/groups in the parsed document before the container
    // promise resolves. These pinned, tested fields cover failure during parsing.
    for (const animation of data.json.animations || []) release(animation._babylonAnimationGroup);
    // Detach children first to avoid recursively disposing a resource twice.
    const nodes = new Set([...partialMeshes, ...(data.json.nodes || []).map(n => n._babylonTransformNode).filter(Boolean)]);
    for (const node of nodes) node.parent = null;
    for (const node of nodes) release(node);
    for (const material of partialMaterials) release(material);
    partialMeshes.clear(); partialMaterials.clear();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; detach();
    if (!loaderDisposed) { loaderDisposed = true; loader.dispose(); }
    if (!transferred) partialCleanup();
  };
  // Public instance API takes IGLTFLoaderData (JSON + embedded BIN reader).
  // Per-session loader ownership avoids a global plugin-activation observer race.
  const promise = Promise.resolve().then(() => {
    if (disposed) throw new Error('Parser disposed before start');
    return loader.loadAssetContainerAsync(scene, data, '', undefined, 'HKD-E01.v1a.1.glb');
  }).then(container => {
    transferred = true; detach(); partialMeshes.clear(); partialMaterials.clear();
    if (disposed) {
      // Resources already released on cancellation must not be disposed again;
      // any resources created later remain owned by the returned container.
      for (const key of ['meshes','transformNodes','materials','animationGroups']) {
        container[key] = container[key].filter(item => !released.has(item) && !item.isDisposed?.());
      }
    }
    return container;
  }).catch(error => { partialCleanup(); detach(); if (!loaderDisposed) { loaderDisposed=true; loader.dispose(); } throw error; });
  return { promise, dispose, resources: () => ({ observers: disposed || transferred || loaderDisposed ? 0 : 3 }) };
}
