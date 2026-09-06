import * as THREE from 'three/webgpu';
import {
  float,
  length,
  materialOpacity,
  positionWorld,
  smoothstep,
} from 'three/tsl';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildEngine, type EnginePart } from './geometry';
import {
  createEngineMaterials,
  createEngineStudioEnvironment,
} from './materials';
import { composeEnginePart } from './pose';
import { fitCameraToBounds } from './camera-fit';
import {
  initialSettings,
  type EngineInfo,
  type ExplorerSettings,
  type Generation,
} from './types';

type Events = {
  onInfo: (info: EngineInfo) => void;
  onSelect: (id: string, inspect: boolean, generation?: Generation) => void;
  onHover: (v: { name: string; x: number; y: number } | null) => void;
  onError: (message: string) => void;
  onLabels: (
    values: {
      generation: Generation;
      x: number;
      y: number;
      visible: boolean;
    }[],
  ) => void;
};
type Bucket = {
  solid: THREE.InstancedMesh;
  ghost: THREE.InstancedMesh;
  indices: number[];
  solidIds: number[];
  ghostIds: number[];
};
type Engine = {
  generation: Generation;
  root: THREE.Group;
  clip: THREE.ClippingGroup;
  parts: EnginePart[];
  systems: ReturnType<typeof buildEngine>['systems'];
  buckets: Bucket[];
  info: EngineInfo;
  lookup: Map<string, number>;
  matrices: THREE.Matrix4[];
};
export type RaptorController = {
  update: (settings: ExplorerSettings) => void;
  focus: (id: string) => void;
  focusSystem: (id: string) => void;
  view: (name: 'hero' | 'front' | 'right' | 'back' | 'top' | 'fit') => void;
  dispose: () => void;
};
export async function createRaptorViewer(
  canvas: HTMLCanvasElement,
  events: Events,
): Promise<RaptorController> {
  const startup = performance.now();
  for (const name of [
    'deviceInitMs',
    'geometryReadyMs',
    'firstRenderMs',
    'readyMs',
    'framesRendered',
    'frameIntervalMs',
    'submitMs',
  ])
    delete canvas.dataset[name];
  const parent = canvas.parentElement!,
    small = innerWidth < 861;
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1.5 : 1.75));
  renderer.setSize(parent.clientWidth, parent.clientHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  try {
    await renderer.init();
    canvas.dataset.deviceInitMs = (performance.now() - startup).toFixed(0);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  canvas.dataset.renderer = (renderer.backend as { isWebGPUBackend?: boolean })
    .isWebGPUBackend
    ? 'webgpu'
    : 'webgl2';
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#000000');
  const materialLibrary = createEngineMaterials(),
    studio = createEngineStudioEnvironment(renderer);
  scene.environment = studio.texture;
  scene.environmentIntensity = 0.92;
  const ghostMaterials = Object.fromEntries(
    Object.keys(materialLibrary.materials).map((key) => [
      key,
      new THREE.MeshBasicNodeMaterial({
        name: `Assembly context / ${key}`,
        color: '#64717e',
        transparent: true,
        opacity: 0.085,
        depthWrite: false,
        toneMapped: false,
      }),
    ]),
  ) as Record<
    keyof typeof materialLibrary.materials,
    THREE.MeshBasicNodeMaterial
  >;
  const hemisphere = new THREE.HemisphereLight('#dce5f0', '#080b10', 0.24);
  scene.add(hemisphere);
  const key = new THREE.DirectionalLight('#f4f7ff', 2.35);
  key.position.set(-5, 10, 7);
  key.target.position.set(0, 3, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, {
    left: -13,
    right: 13,
    top: 12,
    bottom: -10,
    near: 0.5,
    far: 35,
  });
  key.shadow.normalBias = 0.004;
  key.shadow.bias = -0.00004;
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.autoUpdate = false;
  key.shadow.needsUpdate = true;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#e0ebfa', 1.45);
  fill.position.set(7, 6, -5);
  fill.target.position.set(0, 3, 0);
  scene.add(fill, fill.target);
  const floorMaterial = new THREE.MeshBasicNodeMaterial({
    color: '#030304',
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  floorMaterial.opacityNode = materialOpacity.mul(
    float(1).sub(smoothstep(12, 40, length(positionWorld.xz))),
  );
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    floorMaterial,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.065;
  floor.receiveShadow = false;
  scene.add(floor);
  const perspective = new THREE.PerspectiveCamera(
      36,
      parent.clientWidth / parent.clientHeight,
      0.003,
      150,
    ),
    orthographic = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.003, 150);
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = perspective;
  let orthoHalf = 4.65;
  camera.position.set(8.7, 5.2, 11.3);
  const controls = new OrbitControls<
    THREE.PerspectiveCamera | THREE.OrthographicCamera
  >(camera, canvas);
  controls.target.set(0, 3.15, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.085;
  controls.minDistance = 0.075;
  controls.maxDistance = 70;
  controls.minPolarAngle = 0.008;
  controls.maxPolarAngle = Math.PI - 0.008;
  controls.zoomSpeed = 0.65;
  controls.panSpeed = 0.65;
  controls.rotateSpeed = 0.65;
  controls.update();
  const engines = new Map<Generation, Engine>();
  const selectedColor = new THREE.Color().setRGB(1.24, 1.32, 1.4),
    baseColor = new THREE.Color('#ffffff');
  let settings: ExplorerSettings = { ...initialSettings },
    separation = 0,
    detail = 0,
    dirty = true,
    modelDirty = true,
    poseDirty = true,
    lastInteraction = 0,
    framesRendered = 0,
    sampleStart = 0,
    sampleFrames = 0,
    sampleTime = 0,
    lastPaint = 0,
    disposed = false,
    last = performance.now(),
    hoverTime = 0,
    pointerDown: THREE.Vector2 | null = null;
  let tween: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    targetFrom: THREE.Vector3;
    targetTo: THREE.Vector3;
    start: number;
    duration: number;
  } | null = null;
  const build = (generation: Generation) => {
    const data = buildEngine(generation),
      root = new THREE.Group(),
      clip = new THREE.ClippingGroup();
    clip.enabled = false;
    clip.clipShadows = true;
    clip.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)];
    root.add(clip);
    scene.add(root);
    const groups = new Map<
      string,
      {
        geometry: THREE.BufferGeometry;
        material: EnginePart['material'];
        indices: number[];
      }
    >();
    data.parts.forEach((part, i) => {
      const id = part.geometry.uuid + ':' + part.material;
      if (!groups.has(id))
        groups.set(id, {
          geometry: part.geometry,
          material: part.material,
          indices: [],
        });
      groups.get(id)!.indices.push(i);
    });
    const buckets: Bucket[] = [];
    let triangles = 0;
    groups.forEach((group) => {
      const solid = new THREE.InstancedMesh(
          group.geometry,
          materialLibrary.materials[group.material],
          group.indices.length,
        ),
        ghost = new THREE.InstancedMesh(
          group.geometry,
          ghostMaterials[group.material],
          group.indices.length,
        );
      solid.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      ghost.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      solid.frustumCulled = ghost.frustumCulled = true;
      solid.castShadow = true;
      solid.receiveShadow = true;
      ghost.castShadow = false;
      ghost.receiveShadow = false;
      ghost.renderOrder = 2;
      solid.name = `Raptor ${generation} ${group.material}`;
      ghost.name = 'Surrounding assembly';
      const bucket: Bucket = {
        solid,
        ghost,
        indices: group.indices,
        solidIds: [],
        ghostIds: [],
      };
      solid.userData.bucket = bucket;
      solid.userData.generation = generation;
      ghost.count = 0;
      clip.add(solid, ghost);
      buckets.push(bucket);
      triangles +=
        ((group.geometry.index?.count ??
          group.geometry.getAttribute('position').count) /
          3) *
        group.indices.length;
    });
    const info: EngineInfo = {
      generation,
      parts: data.parts.map((p) => ({
        id: p.id,
        name: p.name,
        system: p.system,
        group: p.group.replace(/-/g, ' '),
        material: p.material,
        internal: !!p.internal,
      })),
      systems: data.systems.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
      groups: new Set(data.parts.map((p) => p.group)).size,
      triangles: Math.round(triangles),
      drawCalls: buckets.length,
    };
    const engine: Engine = {
      generation,
      root,
      clip,
      parts: data.parts,
      systems: data.systems,
      buckets,
      info,
      lookup: new Map(data.parts.map((p, i) => [p.id, i])),
      matrices: data.parts.map(() => new THREE.Matrix4()),
    };
    engines.set(generation, engine);
    return engine;
  };
  // Repeated small geometry is instanced; all three generations share its cached buffers.
  build(3);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  build(2);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  build(1);
  let selectedEngine = engines.get(3)!;
  const applyMatrices = () => {
    const hidden = new Set(settings.hidden);
    engines.forEach((engine) => {
      engine.root.visible =
        settings.compare || engine.generation === settings.generation;
      engine.root.position.x = settings.compare
        ? (engine.generation - 2) * 5.1
        : 0;
      engine.clip.enabled = settings.mode === 'cutaway';
      const radians = (settings.cutAngle * Math.PI) / 180;
      engine.clip.clippingPlanes[0].normal.set(
        Math.sin(radians),
        0,
        -Math.cos(radians),
      );
      engine.clip.clippingPlanes[0].constant =
        settings.cutOffset - engine.root.position.x * Math.sin(radians);
      if (!engine.root.visible) return;
      if (poseDirty)
        engine.parts.forEach((part, i) =>
          composeEnginePart(
            part,
            separation + (settings.systemSeparation[part.system] ?? 0),
            detail,
            settings.transforms[part.id],
            engine.matrices[i],
          ),
        );
      engine.buckets.forEach((bucket) => {
        let solidCount = 0,
          ghostCount = 0;
        bucket.solidIds.length = 0;
        bucket.ghostIds.length = 0;
        for (const i of bucket.indices) {
          const part = engine.parts[i];
          if (
            hidden.has(part.id) ||
            (part.internal && settings.mode === 'surface')
          )
            continue;
          const ghost =
            (!!settings.isolatedSystem &&
              part.system !== settings.isolatedSystem) ||
            (settings.isolated &&
              !!settings.selected &&
              part.id !== settings.selected) ||
            (settings.mode === 'internals' &&
              !part.internal &&
              part.id !== settings.selected);
          if (ghost) {
            bucket.ghost.setMatrixAt(ghostCount++, engine.matrices[i]);
            bucket.ghostIds.push(i);
          } else {
            bucket.solid.setMatrixAt(solidCount, engine.matrices[i]);
            bucket.solid.setColorAt(
              solidCount,
              part.id === settings.selected ? selectedColor : baseColor,
            );
            solidCount++;
            bucket.solidIds.push(i);
          }
        }
        bucket.solid.count = solidCount;
        bucket.ghost.count = ghostCount;
        bucket.solid.computeBoundingSphere();
        bucket.ghost.computeBoundingSphere();
        bucket.solid.instanceMatrix.needsUpdate = true;
        bucket.ghost.instanceMatrix.needsUpdate = true;
        if (bucket.solid.instanceColor)
          bucket.solid.instanceColor.needsUpdate = true;
      });
    });
    floor.position.y =
      -0.065 - (separation + (settings.systemSeparation.nozzle ?? 0)) * 1.72;
    floor.material.opacity = 1 - Math.min(0.72, separation * 0.72);
    key.shadow.needsUpdate = true;
    poseDirty = false;
  };
  const projection = () => {
    const aspect = parent.clientWidth / parent.clientHeight;
    perspective.aspect = aspect;
    perspective.updateProjectionMatrix();
    const half = orthoHalf;
    orthographic.left = -half * aspect;
    orthographic.right = half * aspect;
    orthographic.top = half;
    orthographic.bottom = -half;
    orthographic.updateProjectionMatrix();
  };
  let viewportAspect = parent.clientWidth / parent.clientHeight;
  const resize = () => {
    renderer.setSize(parent.clientWidth, parent.clientHeight, false);
    renderer.setPixelRatio(
      Math.min(devicePixelRatio, innerWidth < 861 ? 1.5 : 1.75),
    );
    projection();
    const nextAspect = parent.clientWidth / parent.clientHeight;
    if (Math.abs(nextAspect - viewportAspect) > 0.15 && !settings.selected)
      view('fit');
    viewportAspect = nextAspect;
    dirty = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  const moveCamera = (
    position: THREE.Vector3,
    target: THREE.Vector3,
    duration = 850,
  ) => {
    tween = {
      from: camera.position.clone(),
      to: position,
      targetFrom: controls.target.clone(),
      targetTo: target,
      start: performance.now(),
      duration: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : duration,
    };
    dirty = true;
  };
  const widenCameraRange = (distance: number) => {
    controls.maxDistance = Math.max(controls.maxDistance, distance * 1.25);
    perspective.far = orthographic.far = Math.max(
      perspective.far,
      distance * 2,
      150,
    );
    projection();
  };
  const frameBounds = (box: THREE.Box3, direction: THREE.Vector3) => {
    if (box.isEmpty()) return;
    const fitted = fitCameraToBounds(
      box,
      direction,
      parent.clientWidth / parent.clientHeight,
      perspective.fov,
    );
    widenCameraRange(fitted.position.distanceTo(fitted.target));
    if (camera === orthographic) {
      orthoHalf = fitted.halfHeight;
      orthographic.zoom = 1;
      projection();
    }
    moveCamera(fitted.position, fitted.target);
  };
  const view = (name: 'hero' | 'front' | 'right' | 'back' | 'top' | 'fit') => {
    if (modelDirty) {
      applyMatrices();
      modelDirty = false;
    }
    const bounds = new THREE.Box3(),
      hidden = new Set(settings.hidden);
    engines.forEach((engine) => {
      if (engine.root.visible)
        engine.parts.forEach((part, i) => {
          if (
            !hidden.has(part.id) &&
            !(part.internal && settings.mode === 'surface')
          )
            bounds.union(partBounds(engine, i));
        });
    });
    const directions = {
      fit: camera.position.clone().sub(controls.target),
      hero: new THREE.Vector3(settings.compare ? 0.12 : 0.55, 0.15, 1),
      front: new THREE.Vector3(0, 0.025, 1),
      right: new THREE.Vector3(1, 0.025, 0),
      back: new THREE.Vector3(0, 0.025, -1),
      top: new THREE.Vector3(0, 1, 0.001),
    };
    frameBounds(bounds, directions[name]);
  };
  const locate = (id: string) => {
    for (const engine of engines.values()) {
      const i = engine.lookup.get(id);
      if (i !== undefined) return { engine, i, part: engine.parts[i] };
    }
    return null;
  };
  const partBounds = (engine: Engine, i: number) => {
    const part = engine.parts[i];
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    const targetMatrix = composeEnginePart(
      part,
      settings.separation + (settings.systemSeparation[part.system] ?? 0),
      settings.detail,
      settings.transforms[part.id],
      new THREE.Matrix4(),
    );
    return part.geometry
      .boundingBox!.clone()
      .applyMatrix4(targetMatrix)
      .translate(engine.root.position);
  };
  const focus = (id: string) => {
    const result = locate(id);
    if (!result) return;
    const box = partBounds(result.engine, result.i);
    frameBounds(box, camera.position.clone().sub(controls.target));
  };
  const focusSystem = (id: string) => {
    const box = new THREE.Box3();
    selectedEngine.parts.forEach((p, i) => {
      if (p.system === id && !p.internal)
        box.union(partBounds(selectedEngine, i));
    });
    frameBounds(box, camera.position.clone().sub(controls.target));
  };
  const update = (next: ExplorerSettings) => {
    const generationChanged = next.generation !== settings.generation,
      compareChanged = next.compare !== settings.compare,
      projectionChanged = next.projection !== settings.projection;
    const poseChanged =
      generationChanged ||
      compareChanged ||
      next.systemSeparation !== settings.systemSeparation ||
      next.transforms !== settings.transforms;
    const geometryChanged =
      poseChanged ||
      next.mode !== settings.mode ||
      next.hidden !== settings.hidden ||
      next.selected !== settings.selected ||
      next.isolated !== settings.isolated ||
      next.isolatedSystem !== settings.isolatedSystem ||
      next.cutAngle !== settings.cutAngle ||
      next.cutOffset !== settings.cutOffset;
    poseDirty ||= poseChanged;
    modelDirty ||= geometryChanged;
    settings = next;
    selectedEngine = engines.get(next.generation)!;
    if (projectionChanged) {
      tween = null;
      const old = camera,
        direction = old.position.clone().sub(controls.target).normalize();
      const halfHeight =
        old === perspective
          ? old.position.distanceTo(controls.target) *
            Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2))
          : orthoHalf / orthographic.zoom;
      camera = next.projection === 'perspective' ? perspective : orthographic;
      camera.position.copy(old.position);
      camera.quaternion.copy(old.quaternion);
      if (camera === orthographic) {
        orthoHalf = halfHeight;
        orthographic.zoom = 1;
      } else
        camera.position
          .copy(controls.target)
          .addScaledVector(
            direction,
            halfHeight /
              Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)),
          );
      widenCameraRange(camera.position.distanceTo(controls.target));
      controls.object = camera;
      projection();
      controls.update();
    }
    if (generationChanged || compareChanged) {
      events.onInfo(selectedEngine.info);
      view('hero');
      projection();
    }
    key.intensity = next.lighting === 'studio' ? 2.35 : 2.8;
    fill.intensity = next.lighting === 'studio' ? 1.45 : 1.25;
    hemisphere.intensity = next.lighting === 'studio' ? 0.24 : 0.1;
    scene.environmentIntensity = next.lighting === 'studio' ? 0.92 : 0.72;
    Object.values(ghostMaterials).forEach((material) => {
      material.opacity = next.isolated
        ? 0.028
        : next.isolatedSystem
          ? 0.05
          : 0.065;
    });
    controls.autoRotate = next.spin;
    controls.autoRotateSpeed = 0.65;
    dirty = true;
  };
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2();
  const pick = (event: PointerEvent | MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    const meshes: THREE.InstancedMesh[] = [];
    engines.forEach((e) => {
      if (e.root.visible)
        e.buckets.forEach((b) => {
          if (b.solid.count) meshes.push(b.solid);
        });
    });
    const hits = raycaster.intersectObjects(meshes, false);
    for (const hit of hits) {
      const engine = engines.get(hit.object.userData.generation as Generation)!,
        bucket = hit.object.userData.bucket as Bucket;
      if (hit.instanceId === undefined) continue;
      if (
        engine.clip.enabled &&
        engine.clip.clippingPlanes[0].distanceToPoint(hit.point) < 0
      )
        continue;
      const index = bucket.solidIds[hit.instanceId];
      return { engine, part: engine.parts[index] };
    }
    return null;
  };
  const down = (e: PointerEvent) => {
    events.onHover(null);
    pointerDown = new THREE.Vector2(e.clientX, e.clientY);
    tween = null;
  };
  const up = (e: PointerEvent) => {
    if (
      !pointerDown ||
      pointerDown.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) > 5
    )
      return;
    pointerDown = null;
    const p = pick(e);
    if (p) {
      if (p.engine.generation !== settings.generation) {
        settings = { ...settings, generation: p.engine.generation };
        selectedEngine = p.engine;
        events.onInfo(selectedEngine.info);
      }
      events.onSelect(p.part.id, false, p.engine.generation);
    } else events.onSelect('', false);
  };
  const double = (e: MouseEvent) => {
    const p = pick(e);
    if (p) {
      events.onSelect(p.part.id, true, p.engine.generation);
      focus(p.part.id);
    }
  };
  const hover = (e: PointerEvent) => {
    if (e.buttons || performance.now() - hoverTime < 140) return;
    hoverTime = performance.now();
    const p = pick(e),
      rect = canvas.getBoundingClientRect();
    canvas.style.cursor = p ? 'pointer' : 'grab';
    events.onHover(
      p
        ? {
            name: p.part.name,
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          }
        : null,
    );
  };
  const leave = () => events.onHover(null);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('dblclick', double);
  canvas.addEventListener('pointermove', hover);
  canvas.addEventListener('pointerleave', leave);
  controls.addEventListener('change', () => {
    dirty = true;
  });
  controls.addEventListener('start', () => {
    tween = null;
  });
  const draw = () => {
    if (disposed || document.hidden) return;
    const now = performance.now(),
      dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const moving =
      Math.abs(settings.separation - separation) > 0.00005 ||
      Math.abs(settings.detail - detail) > 0.00005;
    if (moving) {
      const ease = 1 - Math.exp(-dt * 9);
      separation += (settings.separation - separation) * ease;
      detail += (settings.detail - detail) * ease;
      if (Math.abs(settings.separation - separation) < 0.00005)
        separation = settings.separation;
      if (Math.abs(settings.detail - detail) < 0.00005)
        detail = settings.detail;
      dirty = true;
      modelDirty = true;
      poseDirty = true;
    }
    if (tween) {
      const t =
          tween.duration === 0
            ? 1
            : Math.min(1, (now - tween.start) / tween.duration),
        s = t * t * (3 - 2 * t);
      camera.position.lerpVectors(tween.from, tween.to, s);
      controls.target.lerpVectors(tween.targetFrom, tween.targetTo, s);
      if (t === 1) tween = null;
      dirty = true;
    }
    const changed = controls.update(dt);
    if (changed) {
      dirty = true;
      lastInteraction = now;
    }
    const interacting =
      moving || !!tween || settings.spin || now - lastInteraction < 220;
    const pixelRatio = Math.min(
      devicePixelRatio,
      interacting
        ? settings.compare
          ? 1
          : 1.25
        : innerWidth < 861
          ? 1.5
          : 1.75,
    );
    if (renderer.getPixelRatio() !== pixelRatio) {
      renderer.setPixelRatio(pixelRatio);
      dirty = true;
    }
    if (!dirty) return;
    if (modelDirty) {
      applyMatrices();
      modelDirty = false;
    }
    camera.updateMatrixWorld();
    if (settings.compare) {
      const labels: Parameters<Events['onLabels']>[0] = [];
      engines.forEach((e) => {
        const projected = new THREE.Vector3(
          e.root.position.x,
          -0.28 - separation * 1.72,
          0,
        ).project(camera);
        const x = (projected.x * 0.5 + 0.5) * parent.clientWidth,
          y = (-projected.y * 0.5 + 0.5) * parent.clientHeight;
        labels.push({
          generation: e.generation,
          x,
          y: Math.min(parent.clientHeight - 66, y + 18),
          visible:
            projected.z < 1 &&
            Math.abs(projected.x) < 0.94 &&
            Math.abs(projected.y) < 1.1,
        });
      });
      events.onLabels(labels);
    }
    try {
      renderer.render(scene, camera);
      canvas.dataset.framesRendered = String(++framesRendered);
      if (lastPaint && now - lastPaint < 200) {
        sampleTime += now - lastPaint;
        sampleFrames++;
      }
      lastPaint = now;
      if (now - sampleStart > 800) {
        canvas.dataset.frameIntervalMs = sampleFrames
          ? (sampleTime / sampleFrames).toFixed(2)
          : 'idle';
        canvas.dataset.submitMs = (performance.now() - now).toFixed(2);
        canvas.dataset.drawCalls = String(renderer.info.render.drawCalls);
        canvas.dataset.triangles = String(renderer.info.render.triangles);
        canvas.dataset.pixelRatio = String(pixelRatio);
        sampleStart = now;
        sampleTime = 0;
        sampleFrames = 0;
      }
    } catch (error) {
      console.error('Raptor rendering:', error);
      void renderer.setAnimationLoop(null);
      events.onError(
        'The graphics session stopped. Reload the workspace to restore the engine.',
      );
    }
    dirty = false;
  };
  applyMatrices();
  view('hero');
  events.onInfo(selectedEngine.info);
  canvas.dataset.modelElements = String(selectedEngine.parts.length);
  canvas.dataset.engineBatches = String(selectedEngine.buckets.length);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    void renderer.setAnimationLoop(null);
    observer.disconnect();
    controls.dispose();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('dblclick', double);
    canvas.removeEventListener('pointermove', hover);
    canvas.removeEventListener('pointerleave', leave);
    const geometries = new Set<THREE.BufferGeometry>();
    engines.forEach((e) => {
      e.parts.forEach((p) => geometries.add(p.geometry));
      e.buckets.forEach((b) => {
        b.solid.dispose();
        b.ghost.dispose();
      });
    });
    geometries.forEach((g) => g.dispose());
    floor.geometry.dispose();
    floor.material.dispose();
    Object.values(ghostMaterials).forEach((m) => m.dispose());
    materialLibrary.dispose();
    studio.dispose();
    renderer.dispose();
  };
  try {
    canvas.dataset.geometryReadyMs = (performance.now() - startup).toFixed(0);
    const compileStart = performance.now();
    renderer.render(scene, camera);
    canvas.dataset.firstRenderMs = (performance.now() - compileStart).toFixed(
      0,
    );
    await renderer.setAnimationLoop(draw);
    canvas.dataset.readyMs = (performance.now() - startup).toFixed(0);
  } catch (error) {
    dispose();
    throw error;
  }
  return { update, focus, focusSystem, view, dispose };
}
