import * as THREE from 'three/webgpu';
import { bumpMap, color, float, mix, texture, uv, vec2 } from 'three/tsl';

export type EngineMaterialKey =
  | 'steel'
  | 'brushed'
  | 'dark'
  | 'copper'
  | 'titanium'
  | 'ceramic'
  | 'black'
  | 'blue';
export type EngineMaterials = Record<
  EngineMaterialKey,
  THREE.MeshPhysicalNodeMaterial
>;

/**
 * Shared, restrained aerospace finishes. These are visual approximations of
 * photographed surfaces, not assertions about the alloys SpaceX actually uses.
 * All meshes need ordinary UVs and normals; no custom attributes are required.
 * Call once per viewer and reuse the eight materials across every engine.
 */
export function createEngineMaterials(): {
  materials: EngineMaterials;
  textures: THREE.Texture[];
  dispose: () => void;
} {
  const machining = makeSurfaceTexture(
    'Engine machining · packed scalar data',
    197,
  );
  const casting = makeSurfaceTexture(
    'Engine casting · packed scalar data',
    829,
  );
  const textures: THREE.Texture[] = [machining, casting];

  type Finish = {
    color: string;
    metalness: number;
    roughness: number;
    anisotropy?: number;
    repeat?: [number, number];
    grain?: number;
    roughnessVariation?: number;
    cast?: boolean;
    tint?: string;
    clearcoat?: number;
  };
  const finishes: Record<EngineMaterialKey, Finish> = {
    steel: {
      color: '#c7cccd',
      metalness: 1,
      roughness: 0.255,
      anisotropy: 0.24,
      repeat: [3, 7],
      grain: 0.000023,
      roughnessVariation: 0.085,
    },
    brushed: {
      color: '#b8bfbe',
      metalness: 1,
      roughness: 0.34,
      anisotropy: 0.52,
      repeat: [3, 11],
      grain: 0.000043,
      roughnessVariation: 0.12,
    },
    dark: {
      color: '#53575d',
      metalness: 0.9,
      roughness: 0.33,
      repeat: [4, 7],
      grain: 0.000046,
      roughnessVariation: 0.095,
      cast: true,
      tint: '#606975',
    },
    copper: {
      color: '#bc7954',
      metalness: 1,
      roughness: 0.32,
      anisotropy: 0.3,
      repeat: [4, 9],
      grain: 0.000023,
      roughnessVariation: 0.08,
      tint: '#96755f',
    },
    titanium: {
      color: '#b1ada4',
      metalness: 1,
      roughness: 0.295,
      anisotropy: 0.26,
      repeat: [4, 8],
      grain: 0.000024,
      roughnessVariation: 0.1,
      tint: '#9b8796',
    },
    ceramic: {
      color: '#d9d9cc',
      metalness: 0.035,
      roughness: 0.63,
      repeat: [5, 8],
      grain: 0.00005,
      roughnessVariation: 0.1,
      cast: true,
    },
    black: {
      color: '#202329',
      metalness: 0.22,
      roughness: 0.48,
      repeat: [4, 7],
      grain: 0.000022,
      roughnessVariation: 0.075,
      cast: true,
      clearcoat: 0.055,
    },
    blue: {
      color: '#547a90',
      metalness: 0.86,
      roughness: 0.285,
      anisotropy: 0.2,
      repeat: [3, 6],
      grain: 0.000018,
      roughnessVariation: 0.08,
      tint: '#736082',
    },
  };

  const materials = {} as EngineMaterials;
  for (const key of Object.keys(finishes) as EngineMaterialKey[]) {
    const f = finishes[key];
    const surfaceUV = uv().mul(vec2(...(f.repeat ?? [3, 8])));
    const sample = texture(f.cast ? casting : machining, surfaceUV);
    const variation = texture(casting, uv().mul(vec2(1, 2)));
    const material = new THREE.MeshPhysicalNodeMaterial({
      name: `Aerospace / ${key}`,
      color: f.color,
      metalness: f.metalness,
      roughness: f.roughness,
      anisotropy: f.anisotropy ?? 0,
      anisotropyRotation: 0,
      clearcoat: f.clearcoat ?? 0,
      clearcoatRoughness: 0.42,
      envMapIntensity: 1,
      // Solid shells should keep their back faces. Cutaway surfaces can use a
      // separate inner shell rather than changing every opaque part to doublesided.
      side: THREE.FrontSide,
    });
    material.roughnessNode = float(f.roughness)
      .add(sample.g.sub(0.5).mul(f.roughnessVariation ?? 0.08))
      .add(variation.b.sub(0.5).mul(0.035))
      .clamp(0.09, 0.88);
    material.normalNode = bumpMap(sample.r, float(f.grain ?? 0.000025));
    const albedo = color(f.color).mul(variation.b.sub(0.5).mul(0.045).add(1));
    material.colorNode = f.tint
      ? mix(albedo, color(f.tint), variation.r.mul(0.115))
      : albedo;
    materials[key] = material;
  }

  let disposed = false;
  return {
    materials,
    textures,
    dispose() {
      if (disposed) return;
      disposed = true;
      Object.values(materials).forEach((material) => material.dispose());
      textures.forEach((value) => value.dispose());
    },
  };
}

/** Two 1024² scalar textures are shared by the entire material library. */
function makeSurfaceTexture(name: string, seed: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context)
    throw new Error('The engine material canvas could not be initialized.');
  const image = context.createImageData(size, size);
  const data = image.data;
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const lines = new Float32Array(size);
  const isCasting = seed === 829;
  for (let y = 0; y < size; y++) lines[y] = random() - 0.5;
  const tau = Math.PI * 2;
  const waveX = new Float32Array(size);
  const waveY = new Float32Array(size);
  const waveX2 = new Float32Array(size);
  const waveY2 = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const t = (i / size) * tau;
    waveX[i] = Math.sin(t * 3 + seed) * 0.16 + Math.sin(t * 11 + 0.7) * 0.047;
    waveY[i] = Math.cos(t * 5 + 0.31) * 0.15 + Math.cos(t * 13) * 0.04;
    waveX2[i] = Math.sin(t * 23 + 1.2) * 0.05;
    waveY2[i] = Math.cos(t * 31 + 2.4) * 0.05;
  }
  const byte = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  for (let y = 0; y < size; y++) {
    const line =
      lines[y] * 0.56 +
      lines[(y + size - 1) % size] * 0.22 +
      lines[(y + 1) % size] * 0.22;
    for (let x = 0; x < size; x++) {
      const n = random() - 0.5;
      const cloud = waveX[x] + waveY[y];
      const small = waveX2[x] * waveY2[y] * 20;
      const i = (y * size + x) * 4;
      // R is height; G is directional/coarse roughness; B is low contrast patina.
      data[i] = byte(
        isCasting
          ? 0.5 + n * 0.45 + small * 0.45
          : 0.5 + line * 0.52 + n * 0.095,
      );
      data[i + 1] = byte(
        0.5 +
          (isCasting
            ? n * 0.23 + cloud * 0.36
            : line * 0.5 + n * 0.12 + cloud * 0.16),
      );
      data[i + 2] = byte(0.5 + cloud * 0.73 + small * 0.4 + n * 0.05);
      data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const result = new THREE.CanvasTexture(canvas);
  result.name = name;
  result.wrapS = result.wrapT = THREE.RepeatWrapping;
  result.colorSpace = THREE.NoColorSpace;
  result.minFilter = THREE.LinearMipmapLinearFilter;
  result.magFilter = THREE.LinearFilter;
  result.generateMipmaps = true;
  result.anisotropy = 4;
  return result;
}

/**
 * A neutral photographic cyclorama with broad, narrow and warm reflection cards.
 * Call after `await renderer.init()`. PMREM creation needs a real renderer/device;
 * the material shaders themselves can be generated and inspected in Node.
 * Use result.texture as scene.environment; it should not be scene.background.
 */
export function createEngineStudioEnvironment(renderer: THREE.WebGPURenderer): {
  texture: THREE.Texture;
  dispose: () => void;
} {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#111419');
  const plane = new THREE.PlaneGeometry(1, 1);
  const materials: THREE.MeshBasicNodeMaterial[] = [];
  const target = new THREE.Vector3(0, 2, 0);
  const card = (
    position: [number, number, number],
    size: [number, number],
    tint: string,
    intensity: number,
  ) => {
    const material = new THREE.MeshBasicNodeMaterial({
      color: new THREE.Color(tint).multiplyScalar(intensity),
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    materials.push(material);
    const mesh = new THREE.Mesh(plane, material);
    mesh.position.set(...position);
    mesh.scale.set(size[0], size[1], 1);
    mesh.lookAt(target);
    studio.add(mesh);
  };
  // Bright key and cool edge give small fillets readable, continuous highlights.
  card([-8, 8, 6], [6.5, 12], '#f4f7ff', 5.0);
  card([8, 6, -5], [3, 12], '#e4edfa', 6.2);
  card([0, 12, 0], [8, 6], '#ffffff', 3.1);
  card([1, 3, 10], [10, 8], '#d8e0eb', 1.15);
  card([-3, 5, -10], [6, 10], '#eff3ff', 4.4);
  card([7, 3, 7], [3, 10], '#030406', 0.2);
  card([-8, 2, -6], [3.5, 9], '#050609', 0.2);
  card([0, -6, 0], [18, 18], '#afbac8', 0.32);
  const generator = new THREE.PMREMGenerator(renderer);
  let renderTarget: ReturnType<THREE.PMREMGenerator['fromScene']>;
  try {
    renderTarget = generator.fromScene(studio, 0.025, 0.1, 50, { size: 256 });
    renderTarget.texture.name = 'Aerospace studio PMREM';
  } finally {
    generator.dispose();
    plane.dispose();
    materials.forEach((material) => material.dispose());
  }
  let disposed = false;
  return {
    texture: renderTarget.texture,
    dispose() {
      if (disposed) return;
      disposed = true;
      renderTarget.dispose();
    },
  };
}
