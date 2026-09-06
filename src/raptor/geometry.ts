/**
 * Raptor Atlas — visually reconstructed exterior assemblies.
 * Public-photo-informed proportions; NOT manufacturer CAD, dimensional data,
 * a service manual, or a representation of proprietary internal routing.
 * Repeated pieces deliberately share geometry for instanced rendering.
 */
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type EngineMaterial =
  | 'steel'
  | 'brushed'
  | 'dark'
  | 'copper'
  | 'titanium'
  | 'ceramic'
  | 'black'
  | 'blue';
export type EnginePart = {
  id: string;
  name: string;
  system: string;
  group: string;
  material: EngineMaterial;
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
  separation: THREE.Vector3;
  detail: THREE.Vector3;
  internal?: boolean;
};
export type EngineSystem = {
  id: string;
  name: string;
  description: string;
  focus: THREE.Vector3;
};
type Point = [number, number, number];
const Y = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const cache = new Map<string, THREE.BufferGeometry>();
const v = (p: Point) => new THREE.Vector3(...p);
const geo = (key: string, make: () => THREE.BufferGeometry) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
};
const lathe = (key: string, points: [number, number][], segments = 96) =>
  geo(key, () => {
    const g = new THREE.LatheGeometry(
      points.map((p) => new THREE.Vector2(...p)),
      segments,
    );
    g.computeVertexNormals();
    return g;
  });
const primitives = {
  cylinder: geo('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 32, 1)),
  sphere: geo('sphere', () => new THREE.SphereGeometry(1, 24, 16)),
  bead: geo('bead', () => new THREE.SphereGeometry(1, 8, 5)),
  box: geo('rounded-box', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.055)),
  washer: lathe(
    'washer',
    [
      [0.55, -0.1],
      [0.98, -0.1],
      [1, -0.06],
      [1, 0.06],
      [0.98, 0.1],
      [0.55, 0.1],
      [0.55, -0.1],
    ],
    24,
  ),
  hex: lathe(
    'hex-head',
    [
      [0.74, -0.5],
      [1, -0.31],
      [1, 0.29],
      [0.79, 0.5],
      [0.3, 0.5],
      [0.3, 0.39],
      [0, 0.39],
      [0, -0.5],
    ],
    6,
  ),
  thread: lathe(
    'thread-ridge',
    [
      [0.7, -0.5],
      [1, -0.13],
      [1, 0.02],
      [0.7, 0.5],
    ],
    16,
  ),
  slot: geo('socket', () => new THREE.CylinderGeometry(1, 1, 1, 6)),
};

export function buildEngine(generation: 1 | 2 | 3): {
  parts: EnginePart[];
  systems: EngineSystem[];
} {
  const parts: EnginePart[] = [];
  const systems: EngineSystem[] = [
    {
      id: 'nozzle',
      name: 'Nozzle & skirt',
      description:
        'The bell-shaped exterior, rolled edge and visible junctions. Its hidden construction is represented schematically.',
      focus: v([0, 1.1, 0]),
    },
    {
      id: 'chamber',
      name: 'Chamber exterior',
      description:
        'The contoured central body and external annular manifolds above the nozzle.',
      focus: v([0, 3.1, 0]),
    },
    {
      id: 'injector',
      name: 'Upper core assembly',
      description:
        'The central upper housing and bolted junctions, reconstructed from exterior photographs.',
      focus: v([-0.18, 5.1, 0]),
    },
    {
      id: 'oxygen',
      name: 'Oxidizer-side machinery',
      description:
        'A visual grouping of the larger upper machinery and its adjoining housings. Internal mechanisms are illustrative.',
      focus: v([-0.24, 4.5, 0]),
    },
    {
      id: 'methane',
      name: 'Fuel-side machinery',
      description:
        'The offset upper machinery and associated exterior casing. Part boundaries are interpretive.',
      focus: v([0.91, 4.4, 0]),
    },
    {
      id: 'feed',
      name: 'External pipework',
      description:
        'Large curved ducts, smaller service lines and connection hardware visible around the engine.',
      focus: v([0.42, 3.45, 0.82]),
    },
    {
      id: 'structure',
      name: 'Mounts & supports',
      description:
        'Mounting interfaces, outer braces, support clevises and attachment hardware.',
      focus: v([0, 5.8, 0]),
    },
    {
      id: 'control',
      name: 'Controls & instrumentation',
      description:
        'Externally visible equipment, service fittings and harnesses; the reductions across generations follow the public reference views.',
      focus: v([0.94, 4.8, 0.63]),
    },
  ];
  const shifts: Record<string, Point> = {
    nozzle: [0, -1.7, 0],
    chamber: [0, 0.05, 0],
    injector: [0, 2.35, 0],
    oxygen: [-2.55, 1.15, -0.1],
    methane: [2.6, 0.65, 0],
    feed: [1.55, -0.05, 2.65],
    structure: [-2.15, 2.15, -1.35],
    control: [2.55, 1.95, 1.05],
  };
  const counters = new Map<string, number>();
  function add(
    name: string,
    system: string,
    group: string,
    material: EngineMaterial,
    geometry: THREE.BufferGeometry,
    position: Point,
    scale: Point = [1, 1, 1],
    quaternion = new THREE.Quaternion(),
    internal = false,
  ) {
    const index = (counters.get(group) ?? 0) + 1;
    counters.set(group, index);
    const radial = new THREE.Vector3(
      position[0],
      0.18 * (position[1] - 3.4),
      position[2],
    );
    if (radial.lengthSq() < 0.005) radial.set(0.12, 0.24, 0.08);
    radial.normalize().multiplyScalar(0.2 + ((index * 7) % 11) * 0.012);
    const part: EnginePart = {
      id: `r${generation}-${group}-${String(index).padStart(4, '0')}`,
      name,
      system,
      group,
      material,
      geometry,
      position: v(position),
      scale: v(scale),
      quaternion,
      separation: v(shifts[system]),
      detail: radial,
    };
    if (internal) part.internal = true;
    parts.push(part);
    return part;
  }
  const orientation = (normal: Point) =>
    new THREE.Quaternion().setFromUnitVectors(Y, v(normal).normalize());
  function rod(
    name: string,
    system: string,
    group: string,
    mat: EngineMaterial,
    a: Point,
    b: Point,
    radius: number,
  ) {
    const av = v(a),
      bv = v(b),
      d = bv.clone().sub(av);
    return add(
      name,
      system,
      group,
      mat,
      primitives.cylinder,
      av.add(bv).multiplyScalar(0.5).toArray() as Point,
      [radius, d.length(), radius],
      new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()),
    );
  }
  function body(
    name: string,
    system: string,
    group: string,
    mat: EngineMaterial,
    profile: [number, number][],
    p: Point = [0, 0, 0],
    segments = 96,
  ) {
    return add(
      name,
      system,
      group,
      mat,
      lathe(`r${generation}:${group}:${name}`, profile, segments),
      p,
    );
  }
  function ring(
    name: string,
    system: string,
    group: string,
    mat: EngineMaterial,
    p: Point,
    r: number,
    thickness: number,
    normal: Point = [0, 1, 0],
  ) {
    const geometry = geo(
      `torus:${r.toFixed(4)}:${thickness.toFixed(4)}`,
      () => {
        const g = new THREE.TorusGeometry(r, thickness, 8, 80);
        g.rotateX(Math.PI / 2);
        return g;
      },
    );
    return add(
      name,
      system,
      group,
      mat,
      geometry,
      p,
      [1, 1, 1],
      orientation(normal),
    );
  }
  function weld(
    name: string,
    system: string,
    group: string,
    p: Point,
    radius: number,
    normal: Point = [0, 1, 0],
    count = 80,
    bead = 0.012,
  ) {
    const q = orientation(normal);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU,
        point = new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius)
          .applyQuaternion(q)
          .add(v(p));
      const tangent = new THREE.Vector3(
        -Math.sin(a),
        0,
        Math.cos(a),
      ).applyQuaternion(q);
      const orientationBead = new THREE.Quaternion().setFromUnitVectors(
        Y,
        tangent,
      );
      const e = 1 + Math.sin(i * 2.07) * 0.12;
      add(
        `${name} · bead ${String(i + 1).padStart(3, '0')}`,
        system,
        group,
        'titanium',
        primitives.bead,
        point.toArray() as Point,
        [bead * 0.7, bead * 1.6 * e, bead],
        orientationBead,
      );
    }
  }
  function bolt(
    name: string,
    system: string,
    group: string,
    p: Point,
    normal: Point = [0, 1, 0],
    size = 0.04,
    threads = 2,
  ) {
    const q = orientation(normal),
      n = v(normal).normalize(),
      pos = v(p);
    const offset = (h: number) =>
      pos.clone().addScaledVector(n, h).toArray() as Point;
    add(
      `${name} · washer`,
      system,
      group,
      'brushed',
      primitives.washer,
      offset(0),
      [size * 1.28, size, size * 1.28],
      q,
    );
    add(
      `${name} · hex head`,
      system,
      group,
      'steel',
      primitives.hex,
      offset(size * 0.58),
      [size, size * 0.92, size],
      q,
    );
    add(
      `${name} · socket`,
      system,
      group,
      'dark',
      primitives.slot,
      offset(size * 1.047),
      [size * 0.26, size * 0.016, size * 0.26],
      q,
    );
    for (let j = 0; j < threads; j++)
      add(
        `${name} · exposed thread ${j + 1}`,
        system,
        group,
        'titanium',
        primitives.thread,
        offset(-size * (0.24 + j * 0.17)),
        [size * 0.66, size * 0.2, size * 0.66],
        q,
      );
    add(
      `${name} · fastener shank`,
      system,
      group,
      'steel',
      primitives.cylinder,
      offset(-size * 0.94),
      [size * 0.63, size * 2.02, size * 0.63],
      q,
    );
    add(
      `${name} · backing washer`,
      system,
      group,
      'brushed',
      primitives.washer,
      offset(-size * 1.77),
      [size * 1.18, size, size * 1.18],
      q,
    );
    add(
      `${name} · retaining nut`,
      system,
      group,
      'steel',
      primitives.hex,
      offset(-size * 2.28),
      [size * 0.94, size * 0.85, size * 0.94],
      q,
    );
    add(
      `${name} · nut bore`,
      system,
      group,
      'dark',
      primitives.slot,
      offset(-size * 2.708),
      [size * 0.29, size * 0.012, size * 0.29],
      q,
    );
  }
  function flange(
    name: string,
    system: string,
    group: string,
    p: Point,
    r: number,
    normal: Point = [0, 1, 0],
    count = 32,
    heavy = false,
  ) {
    const q = orientation(normal),
      pos = v(p);
    const profile: [number, number][] = [
      [r * 0.8, -0.047],
      [r * 0.99, -0.047],
      [r * 1.025, -0.025],
      [r * 1.025, 0.025],
      [r * 0.99, 0.047],
      [r * 0.8, 0.047],
      [r * 0.8, -0.047],
    ];
    add(
      `${name} · machined flange`,
      system,
      group,
      'brushed',
      lathe(`flange:${r}`, profile, 80),
      p,
      [1, 1, 1],
      q,
    );
    ring(
      `${name} · joint line`,
      system,
      group,
      'dark',
      p,
      r * 1.027,
      0.009,
      normal,
    );
    const size = Math.min(0.046, r * 0.088);
    for (let i = 0; i < count; i++) {
      const a = ((i + 0.5) / count) * TAU;
      const b = new THREE.Vector3(
        Math.cos(a) * r * 0.92,
        0.053,
        Math.sin(a) * r * 0.92,
      )
        .applyQuaternion(q)
        .add(pos);
      bolt(
        `${name} · fastener ${String(i + 1).padStart(2, '0')}`,
        system,
        group,
        b.toArray() as Point,
        normal,
        size,
        heavy ? 3 : 2,
      );
    }
  }
  function pipe(
    name: string,
    system: string,
    group: string,
    mat: EngineMaterial,
    points: Point[],
    radius: number,
    connectors = true,
  ) {
    const curve = new THREE.CatmullRomCurve3(
      points.map(v),
      false,
      'centripetal',
    );
    const g = new THREE.TubeGeometry(
      curve,
      Math.max(32, points.length * 12),
      radius,
      radius > 0.1 ? 20 : 8,
      false,
    );
    add(name, system, group, mat, g, [0, 0, 0]);
    if (connectors) {
      for (const t of [0.015, 0.985]) {
        const p = curve.getPoint(t),
          n = curve.getTangent(t);
        flange(
          `${name} · ${t < 0.5 ? 'lower' : 'upper'} coupling`,
          system,
          group,
          p.toArray() as Point,
          radius * 1.4,
          n.toArray() as Point,
          radius > 0.13 ? 16 : 6,
        );
      }
    }
    return curve;
  }

  // A smooth, double-walled bell with a gently rolled lip, not stacked cones.
  const nozzleMat: EngineMaterial =
    generation === 1 ? 'steel' : generation === 2 ? 'titanium' : 'dark';
  const bell: [number, number][] = [];
  const bellRadius = (t: number) => 0.62 + 0.78 * Math.pow(1 - t, 0.72);
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    bell.push([bellRadius(t), 2.05 * t]);
  }
  for (let i = 48; i >= 0; i--) {
    const t = i / 48;
    bell.push([bellRadius(t) - 0.018, 2.05 * t]);
  }
  bell.push([1.4, 0]);
  body(
    'Continuous nozzle shell',
    'nozzle',
    'nozzle-shell',
    nozzleMat,
    bell,
    [0, 0, 0],
    160,
  );
  ring(
    'Rolled nozzle lip',
    'nozzle',
    'nozzle-lip',
    nozzleMat,
    [0, 0.012, 0],
    1.392,
    0.018,
  );
  ring(
    'Skirt weld shoulder',
    'nozzle',
    'nozzle-seams',
    'titanium',
    [0, 1.97, 0],
    bellRadius(1.97 / 2.05) + 0.002,
    0.009,
  );
  ring(
    'Nozzle collar engraving',
    'nozzle',
    'nozzle-seams',
    'dark',
    [0, 1.9, 0],
    bellRadius(1.9 / 2.05) + 0.001,
    0.004,
  );
  body('Upper nozzle transition', 'nozzle', 'nozzle-neck', nozzleMat, [
    [0.62, 2.01],
    [0.635, 2.08],
    [0.64, 2.19],
    [0.68, 2.28],
    [0.72, 2.31],
    [0.7, 2.36],
    [0.59, 2.48],
    [0.49, 2.68],
    [0.44, 2.73],
    [0.43, 2.67],
    [0.57, 2.42],
    [0.62, 2.18],
    [0.6, 2.02],
  ]);
  ring(
    'Lower annular jacket',
    'chamber',
    'lower-jacket',
    nozzleMat,
    [0, 2.26, 0],
    0.691,
    0.058,
  );
  ring(
    'Feed collector ring',
    'chamber',
    'collector-ring',
    generation === 1 ? 'titanium' : 'dark',
    [0, 2.79, 0],
    0.535,
    0.145,
  );
  // Fine welding follows actual junction rings rather than filling the bell with decorative noise.
  weld(
    'Upper skirt seam',
    'nozzle',
    'nozzle-welds',
    [0, 2.075, 0],
    0.635,
    [0, 1, 0],
    144,
    0.006,
  );
  weld(
    'Collector junction',
    'chamber',
    'collector-welds',
    [0, 2.735, 0],
    0.525,
    [0, 1, 0],
    112,
    0.009,
  );

  body(
    'Contoured chamber exterior',
    'chamber',
    'chamber-body',
    generation === 1 ? 'titanium' : 'dark',
    [
      [0.46, 2.65],
      [0.43, 2.79],
      [0.43, 2.94],
      [0.48, 3.04],
      [0.57, 3.12],
      [0.65, 3.29],
      [0.69, 3.5],
      [0.77, 3.66],
      [0.84, 3.7],
      [0.87, 3.81],
      [0.88, 4.0],
      [0.86, 4.12],
      [0.79, 4.18],
      [0.4, 4.18],
      [0.39, 3.21],
      [0.34, 2.83],
      [0.38, 2.65],
    ],
  );
  ring(
    'Chamber intermediate collar',
    'chamber',
    'chamber-collars',
    nozzleMat,
    [0, 3.14, 0],
    0.566,
    0.065,
  );
  ring(
    'Upper casing rolled joint',
    'chamber',
    'chamber-collars',
    nozzleMat,
    [0, 3.77, 0],
    0.85,
    0.105,
  );
  flange(
    'Main casing interface',
    'chamber',
    'main-interface',
    [0, 4.075, 0],
    0.9,
    [0, 1, 0],
    generation === 1 ? 64 : 48,
    true,
  );
  body(
    'Main upper plenum housing',
    'oxygen',
    'oxygen-plenum',
    generation === 1 ? 'titanium' : 'dark',
    [
      [0.8, -0.1],
      [0.91, -0.06],
      [0.99, 0.05],
      [1.0, 0.16],
      [0.95, 0.28],
      [0.83, 0.35],
      [0.74, 0.31],
      [0.77, 0.05],
      [0.8, -0.1],
    ],
    [-0.07, 4.17, -0.04],
  );
  flange(
    'Plenum upper rim',
    'oxygen',
    'plenum-interface',
    [-0.07, 4.48, -0.04],
    0.82,
    [0, 1, 0],
    generation === 1 ? 56 : 40,
    true,
  );
  ring(
    'Plenum circumferential weld',
    'oxygen',
    'plenum-welds',
    'titanium',
    [-0.07, 4.2, -0.04],
    0.99,
    0.01,
  );
  if (generation < 3)
    weld(
      'Plenum hand-welded seam',
      'oxygen',
      'plenum-welds',
      [-0.07, 4.33, -0.04],
      0.96,
      [0, 1, 0],
      160,
      0.009,
    );

  // Unequal and offset machinery produces the recognizable asymmetric upper silhouette.
  const top = generation === 1 ? 5.86 : generation === 2 ? 5.89 : 5.57;
  body(
    'Central integrated upper housing',
    'injector',
    'upper-core',
    generation === 1 ? 'black' : 'dark',
    [
      [0.52, 4.43],
      [0.62, 4.55],
      [0.61, 4.66],
      [0.48, 4.83],
      [0.46, 5.05],
      [0.5, 5.2],
      [0.56, 5.3],
      [0.55, top - 0.12],
      [0.46, top],
      [0.25, top],
      [0.25, 4.43],
    ],
    [-0.2, 0, -0.14],
  );
  for (let i = 0; i < (generation === 3 ? 3 : 5); i++)
    ring(
      `Core casing transition ${i + 1}`,
      'injector',
      'core-rings',
      nozzleMat,
      [-0.2, 4.64 + i * 0.17, -0.14],
      0.5 + (i % 3) * 0.015,
      0.026,
    );
  flange(
    'Upper core crown',
    'injector',
    'core-crown',
    [-0.2, top, -0.14],
    0.53,
    [0, 1, 0],
    24,
    true,
  );
  const feedTop = generation === 1 ? 6.58 : generation === 2 ? 6.78 : 6.24;
  body(
    'Upper feed neck',
    'feed',
    'upper-feed-neck',
    'brushed',
    [
      [0.35, top],
      [0.36, top + 0.07],
      [0.33, top + 0.12],
      [0.28, top + 0.2],
      [0.28, feedTop - 0.12],
      [0.32, feedTop - 0.08],
      [0.32, feedTop],
      [0.27, feedTop],
      [0.26, top + 0.2],
      [0.31, top],
    ],
    [-0.2, 0, -0.14],
  );
  const neckFins = generation === 2 ? 16 : generation === 1 ? 7 : 3;
  for (let i = 0; i < neckFins; i++)
    ring(
      `Upper feed neck machined ring ${i + 1}`,
      'feed',
      'neck-rings',
      'brushed',
      [
        -0.2,
        top + 0.21 + ((feedTop - top - 0.31) * i) / Math.max(1, neckFins - 1),
        -0.14,
      ],
      0.285,
      0.016,
    );
  ring(
    'Feed neck opening rim',
    'feed',
    'neck-rings',
    'steel',
    [-0.2, feedTop, -0.14],
    0.301,
    0.014,
  );
  if (generation === 3)
    ring(
      'Protective inlet rim',
      'feed',
      'neck-rings',
      'blue',
      [-0.2, feedTop - 0.032, -0.14],
      0.303,
      0.014,
    );
  // Three conspicuous front ports distinguish the clean Raptor 3 core.
  const portCount = generation === 3 ? 3 : 5;
  for (let i = 0; i < portCount; i++) {
    const a = -0.82 + (i / (portCount - 1)) * 1.64,
      normal: Point = [Math.sin(a), 0.12, Math.cos(a)];
    const p: Point = [
      -0.2 + Math.sin(a) * 0.52,
      top - 0.3 + (i % 2) * 0.035,
      -0.14 + Math.cos(a) * 0.52,
    ];
    add(
      `Upper core service-port body ${i + 1}`,
      'control',
      'core-service-ports',
      'dark',
      primitives.cylinder,
      p,
      [0.125, 0.145, 0.125],
      orientation(normal),
    );
    flange(
      `Upper core service port ${i + 1}`,
      'control',
      'core-service-ports',
      v(p).addScaledVector(v(normal).normalize(), 0.081).toArray() as Point,
      0.123,
      normal,
      8,
    );
    add(
      `Upper core service-port cap ${i + 1}`,
      'control',
      'core-service-ports',
      'black',
      primitives.cylinder,
      v(p).addScaledVector(v(normal).normalize(), 0.1).toArray() as Point,
      [0.088, 0.018, 0.088],
      orientation(normal),
    );
  }

  const side: Point = [0.93, 0, -0.1];
  body(
    'Offset machinery casing',
    'methane',
    'offset-casing',
    generation === 1 ? 'titanium' : 'dark',
    [
      [0.22, 3.08],
      [0.25, 3.18],
      [0.3, 3.34],
      [0.31, 3.5],
      [0.36, 3.65],
      [0.39, 3.83],
      [0.38, 4.06],
      [0.46, 4.19],
      [0.48, 4.32],
      [0.44, 4.48],
      [0.36, 4.55],
      [0.28, 4.53],
      [0.25, 3.08],
    ],
    side,
  );
  body(
    'Offset upper dome',
    'methane',
    'offset-dome',
    generation === 1 ? 'steel' : 'dark',
    [
      [0.37, 4.38],
      [0.49, 4.48],
      [0.52, 4.63],
      [0.47, 4.82],
      [0.36, 4.92],
      [0.3, 4.96],
      [0.18, 4.96],
      [0.18, 4.4],
    ],
    [0.9, 0, -0.11],
  );
  flange(
    'Offset housing rim',
    'methane',
    'offset-rim',
    [0.91, 4.48, -0.1],
    0.505,
    [0, 1, 0],
    generation === 1 ? 40 : 28,
    true,
  );
  flange(
    'Offset upper feed socket',
    'methane',
    'offset-inlet',
    [0.9, 4.95, -0.11],
    0.3,
    [0, 1, 0],
    16,
  );
  ring(
    'Offset casing lower bead',
    'methane',
    'offset-seams',
    nozzleMat,
    [0.93, 3.69, -0.1],
    0.36,
    0.043,
  );
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU,
      p: Point = [0.91 + Math.sin(a) * 0.46, 4.56, -0.1 + Math.cos(a) * 0.46];
    add(
      `Offset housing radial strengthening web ${i + 1}`,
      'methane',
      'offset-webs',
      nozzleMat,
      primitives.box,
      p,
      [0.045, 0.25, 0.085],
      new THREE.Quaternion().setFromAxisAngle(Y, a),
    );
  }
  weld(
    'Offset casing seam',
    'methane',
    'offset-welds',
    [0.93, 3.52, -0.1],
    0.325,
    [0, 1, 0],
    80,
    0.008,
  );

  // Dominant photographed ducts. R1 keeps the low U; R3 uses the clean diagonal sweep.
  if (generation === 1) {
    pipe(
      'Large front U-shaped transfer duct',
      'feed',
      'main-transfer-duct',
      'titanium',
      [
        [-0.78, 3.76, 0.36],
        [-0.97, 3.47, 0.52],
        [-0.93, 2.91, 0.65],
        [-0.59, 2.76, 0.76],
        [0.02, 2.73, 0.81],
        [0.66, 2.89, 0.7],
        [0.93, 3.48, 0.47],
        [0.85, 4.0, 0.31],
      ],
      0.19,
    );
    pipe(
      'Upper cross-engine manifold',
      'feed',
      'upper-manifold',
      'titanium',
      [
        [-1.04, 4.5, -0.25],
        [-1.16, 4.24, 0.05],
        [-0.97, 4.03, 0.54],
        [-0.33, 4.02, 0.88],
        [0.41, 4.11, 0.81],
        [0.98, 4.22, 0.44],
      ],
      0.17,
    );
  } else {
    pipe(
      'Sweeping main transfer duct',
      'feed',
      'main-transfer-duct',
      generation === 2 ? 'titanium' : 'dark',
      [
        [-0.09, 2.83, 0.56],
        [0.28, 2.91, 0.78],
        [0.55, 3.4, 0.9],
        [0.81, 4.16, 0.77],
        [1.02, 4.56, 0.5],
        [1.16, 4.58, 0.25],
      ],
      generation === 3 ? 0.19 : 0.215,
    );
    if (generation === 2)
      pipe(
        'Upper toroidal cross-engine duct',
        'feed',
        'upper-manifold',
        'titanium',
        [
          [-0.91, 4.52, -0.26],
          [-1.13, 4.42, 0.06],
          [-1.12, 4.17, 0.47],
          [-0.65, 4.04, 0.83],
          [0.02, 4.1, 0.93],
          [0.75, 4.15, 0.53],
        ],
        0.17,
      );
  }
  pipe(
    'Offset lower return elbow',
    'feed',
    'return-duct',
    generation === 1 ? 'titanium' : 'dark',
    [
      [0.99, 3.36, -0.08],
      [1.08, 3.09, -0.07],
      [1.03, 2.78, -0.01],
      [0.77, 2.63, 0.05],
      [0.51, 2.67, 0.05],
    ],
    0.14,
  );
  pipe(
    'Lower jacket service line',
    'feed',
    'jacket-service',
    'steel',
    [
      [0.55, 2.22, 0.27],
      [0.73, 2.28, 0.33],
      [0.77, 2.52, 0.38],
      [0.74, 2.9, 0.46],
      [0.74, 3.18, 0.5],
      [0.57, 3.23, 0.52],
    ],
    0.026,
  );
  pipe(
    'Upper polished crossover',
    'feed',
    'polished-crossover',
    'brushed',
    [
      [0.04, 5.38, 0.24],
      [0.34, 5.42, 0.27],
      [0.66, 5.43, 0.24],
      [0.78, 5.27, 0.21],
      [0.79, 4.91, 0.25],
    ],
    0.047,
  );

  // Braced load paths and clevis joints; R3 retains minimal integrated attachments.
  const supports = generation === 1 ? 4 : generation === 2 ? 3 : 2;
  for (let i = 0; i < supports; i++) {
    const a = (i / supports) * TAU + 0.48;
    const lower: Point = [Math.cos(a) * 0.83, 2.28, Math.sin(a) * 0.83];
    const upper: Point = [Math.cos(a) * 1.03, 4.88, Math.sin(a) * 1.03];
    rod(
      `Outer support strut ${i + 1}`,
      'structure',
      'outer-supports',
      generation === 1 ? 'titanium' : 'brushed',
      lower,
      upper,
      generation === 1 ? 0.065 : 0.04,
    );
    const middle = v(lower).lerp(v(upper), 0.55).toArray() as Point;
    rod(
      `Support strut sliding sleeve ${i + 1}`,
      'structure',
      'support-sleeves',
      'steel',
      middle,
      v(upper).lerp(v(lower), 0.16).toArray() as Point,
      0.064,
    );
    for (const [k, p] of [lower, upper].entries()) {
      const n: Point = [Math.cos(a), 0, Math.sin(a)];
      add(
        `Support ${i + 1} clevis ${k + 1}`,
        'structure',
        'support-clevis',
        'titanium',
        primitives.box,
        p,
        [0.19, 0.24, 0.13],
        new THREE.Quaternion().setFromAxisAngle(Y, -a),
      );
      bolt(
        `Support ${i + 1} clevis pivot ${k + 1}`,
        'structure',
        'support-clevis',
        p,
        n,
        0.079,
        3,
      );
    }
  }
  if (generation === 1) {
    const crownY = 6.62;
    for (const z of [-0.41, 0.41]) {
      add(
        'Gimbal crown cross-member',
        'structure',
        'gimbal-crown',
        'brushed',
        primitives.box,
        [0, crownY, z],
        [1.37, 0.14, 0.22],
      );
      for (const x of [-0.55, 0.55]) {
        rod(
          'Gimbal crown inclined ear',
          'structure',
          'gimbal-crown',
          'steel',
          [x * 0.86, 6.01, z * 0.75],
          [x, crownY - 0.08, z],
          0.11,
        );
        bolt(
          'Gimbal crown attachment',
          'structure',
          'gimbal-fasteners',
          [x, crownY + 0.085, z],
          [0, 1, 0],
          0.065,
          3,
        );
      }
    }
    rod(
      'Gimbal crown left tie',
      'structure',
      'gimbal-crown',
      'steel',
      [-0.61, crownY, -0.39],
      [-0.61, crownY, 0.39],
      0.075,
    );
    rod(
      'Gimbal crown right tie',
      'structure',
      'gimbal-crown',
      'steel',
      [0.61, crownY, -0.39],
      [0.61, crownY, 0.39],
      0.075,
    );
  } else {
    flange(
      'Upper mounting interface',
      'structure',
      'upper-mount',
      [-0.2, top + 0.07, -0.14],
      0.44,
      [0, 1, 0],
      16,
      true,
    );
  }

  // A structured family of service lines, not a random field of greebles.
  // R1 has exposed multi-line racks; R2 has shorter consolidated runs; R3 just selected services.
  const circuitCount = generation === 1 ? 38 : generation === 2 ? 16 : 4;
  for (let i = 0; i < circuitCount; i++) {
    const rack = Math.floor(i / 6),
      lane = i % 6;
    const a = (rack / Math.ceil(circuitCount / 6)) * TAU + 0.18;
    const r = 1.0 + lane * 0.031;
    const startY = 3.04 + (i % 4) * 0.16,
      endY = 4.72 + (i % 5) * 0.14;
    const radial = (rr: number, y: number, angle = a): Point => [
      Math.cos(angle) * rr,
      y,
      Math.sin(angle) * rr,
    ];
    const source = radial(0.56, startY, a - 0.12);
    const route: Point[] = [
      source,
      radial(r - 0.06, startY + 0.11),
      radial(r, startY + 0.31),
      radial(r, endY - 0.19),
      radial(0.84, endY),
      radial(0.57, endY + 0.02, a + 0.16),
    ];
    const curve = pipe(
      `Service-line rack ${rack + 1} · line ${lane + 1}`,
      'feed',
      `service-rack-${rack + 1}`,
      'steel',
      route,
      0.011 + (i % 3) * 0.002,
      false,
    );
    for (const t of [0.09, 0.88]) {
      const p = curve.getPoint(t),
        n = curve.getTangent(t);
      add(
        `Service line ${i + 1} union body`,
        'feed',
        `service-rack-${rack + 1}`,
        'brushed',
        primitives.hex,
        p.toArray() as Point,
        [0.024, 0.069, 0.024],
        orientation(n.toArray() as Point),
      );
      for (let j = 0; j < 3; j++)
        ring(
          `Service line ${i + 1} union thread ${j + 1}`,
          'feed',
          `service-rack-${rack + 1}`,
          'titanium',
          p
            .clone()
            .addScaledVector(n, (j - 1) * 0.011)
            .toArray() as Point,
          0.02,
          0.0035,
          n.toArray() as Point,
        );
      if (i % 4 === 0)
        add(
          `Service line ${i + 1} identification collar`,
          'feed',
          `service-rack-${rack + 1}`,
          'blue',
          primitives.cylinder,
          p.clone().addScaledVector(n, 0.052).toArray() as Point,
          [0.018, 0.023, 0.018],
          orientation(n.toArray() as Point),
        );
    }
    if (lane === 0) {
      for (const yy of [startY + 0.5, endY - 0.4]) {
        const p = radial(r + 0.065, yy);
        add(
          `Service rack ${rack + 1} saddle support`,
          'structure',
          'line-saddles',
          'brushed',
          primitives.box,
          p,
          [0.22, 0.052, 0.035],
          new THREE.Quaternion().setFromAxisAngle(Y, -a + Math.PI / 2),
        );
        bolt(
          `Service rack ${rack + 1} saddle screw`,
          'structure',
          'line-saddles',
          p,
          [Math.cos(a), 0, Math.sin(a)],
          0.021,
          1,
        );
      }
    }
  }

  if (generation === 1) {
    // A broad crown rack and looped front harnesses account for R1's busy upper silhouette.
    for (let i = 0; i < 8; i++) {
      const offset = i * 0.033;
      const curve = pipe(
        `Crown service rack · parallel line ${i + 1}`,
        'feed',
        'crown-service-rack',
        'brushed',
        [
          [-0.84, 5.44 + offset, 0.12],
          [-0.97, 5.88 + offset, 0.27],
          [-0.96, 6.21 + offset, 0.44],
          [-0.63, 6.31 + offset, 0.57],
          [0.17, 6.31 + offset, 0.59],
          [0.77, 6.34 + offset, 0.52],
          [0.95, 6.53 + offset * 0.35, 0.44],
        ],
        0.014,
        false,
      );
      for (const t of [0.23, 0.69, 0.92]) {
        const pp = curve.getPoint(t),
          nn = curve.getTangent(t);
        add(
          `Crown service line ${i + 1} compression fitting`,
          'feed',
          'crown-service-fittings',
          'steel',
          primitives.hex,
          pp.toArray() as Point,
          [0.024, 0.069, 0.024],
          orientation(nn.toArray() as Point),
        );
      }
    }
    for (let i = 0; i < 16; i++) {
      const offset = i * 0.013;
      const route: Point[] =
        i < 8
          ? [
              [-0.43 + offset, 5.47, 0.48],
              [-0.89 + offset, 5.18, 0.66],
              [-1.02 + offset, 4.86, 0.93],
              [-0.63 + offset, 4.65, 1.13],
              [-0.13 + offset, 4.82, 1.11],
              [0.13 + offset, 5.2, 0.83],
              [0.72 + offset, 5.37, 0.49],
            ]
          : [
              [-0.79 + offset, 4.95, 0.67],
              [-1.04 + offset, 4.5, 0.97],
              [-0.78 + offset, 4.03, 1.14],
              [-0.3 + offset, 3.86, 1.2],
              [0.36 + offset, 4.06, 1.07],
              [0.71 + offset, 4.38, 0.71],
            ];
      const curve = pipe(
        `R1 exposed harness bundle · conductor ${i + 1}`,
        'control',
        'exposed-harness-bundles',
        i % 5 === 0 ? 'copper' : i % 3 === 0 ? 'steel' : 'black',
        route,
        0.012,
        false,
      );
      for (const t of [0.17, 0.42, 0.65, 0.86]) {
        const pp = curve.getPoint(t),
          nn = curve.getTangent(t);
        ring(
          `R1 harness ${i + 1} woven retainer`,
          'control',
          'exposed-harness-retainers',
          'ceramic',
          pp.toArray() as Point,
          0.015,
          0.004,
          nn.toArray() as Point,
        );
      }
    }
    const blanket = pipe(
      'Upper insulated service elbow',
      'feed',
      'insulated-service-elbow',
      'brushed',
      [
        [0.45, 4.89, -0.24],
        [0.8, 5.09, -0.3],
        [1.04, 5.36, -0.34],
        [1.06, 5.73, -0.37],
        [0.9, 5.91, -0.34],
      ],
      0.128,
    );
    for (let i = 0; i < 35; i++) {
      const t = (i + 0.5) / 35,
        pp = blanket.getPoint(t),
        nn = blanket.getTangent(t);
      ring(
        `Insulated elbow foil convolution ${i + 1}`,
        'feed',
        'insulation-convolutions',
        'steel',
        pp.toArray() as Point,
        0.131 + (i % 3) * 0.003,
        0.007,
        nn.toArray() as Point,
      );
    }
  }
  if (generation === 2) {
    const loom = pipe(
      'Consolidated upper harness loop',
      'control',
      'upper-harness-loop',
      'copper',
      [
        [-0.75, 4.17, 0.55],
        [-1.02, 4.39, 0.75],
        [-1.0, 5.06, 0.72],
        [-0.73, 5.53, 0.54],
        [-0.2, 5.69, 0.48],
        [0.4, 5.59, 0.51],
        [0.73, 5.37, 0.42],
      ],
      0.037,
      false,
    );
    for (let i = 0; i < 20; i++) {
      const t = (i + 0.5) / 20,
        pp = loom.getPoint(t),
        nn = loom.getTangent(t);
      add(
        `Upper harness woven tie ${i + 1}`,
        'control',
        'upper-harness-ties',
        'ceramic',
        primitives.cylinder,
        pp.toArray() as Point,
        [0.042, 0.04, 0.042],
        orientation(nn.toArray() as Point),
      );
    }
  }

  // Upper service/valve blocks have real bevels, sockets, cover screws and pipe terminations.
  const blockCount = generation === 1 ? 11 : generation === 2 ? 5 : 2;
  for (let i = 0; i < blockCount; i++) {
    const a = (i / blockCount) * TAU + 0.46;
    const radius = generation === 1 ? 1.06 : 0.83;
    const yy = 4.35 + (i % 3) * 0.35;
    const center: Point = [Math.cos(a) * radius, yy, Math.sin(a) * radius];
    const normal: Point = [Math.cos(a), 0, Math.sin(a)];
    const q = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI / 2 - a);
    add(
      `Exterior service block ${i + 1}`,
      'control',
      'service-blocks',
      'brushed',
      primitives.box,
      center,
      [0.27, 0.27, 0.17],
      q,
    );
    const front = v(center).addScaledVector(v(normal), 0.09);
    add(
      `Exterior service block ${i + 1} cover`,
      'control',
      'service-covers',
      'steel',
      primitives.box,
      front.toArray() as Point,
      [0.238, 0.238, 0.024],
      q,
    );
    for (const dx of [-0.081, 0.081])
      for (const dy of [-0.081, 0.081]) {
        const p = new THREE.Vector3(dx, dy, 0.11)
          .applyQuaternion(q)
          .add(v(center));
        bolt(
          `Service block ${i + 1} cover screw`,
          'control',
          'service-block-fasteners',
          p.toArray() as Point,
          normal,
          0.021,
          1,
        );
      }
    flange(
      `Service block ${i + 1} circular port`,
      'control',
      'service-block-ports',
      front.clone().addScaledVector(v(normal), 0.025).toArray() as Point,
      0.066,
      normal,
      6,
    );
    rod(
      `Service block ${i + 1} stem`,
      'control',
      'service-block-stems',
      'brushed',
      [center[0], yy + 0.12, center[2]],
      [center[0], yy + 0.29, center[2]],
      0.032,
    );
    add(
      `Service block ${i + 1} top union`,
      'control',
      'service-block-stems',
      'steel',
      primitives.hex,
      [center[0], yy + 0.27, center[2]],
      [0.048, 0.058, 0.048],
    );
  }
  if (generation < 3) {
    const panel: Point = [0.84, 4.99, 0.65];
    add(
      'Engine controller enclosure',
      'control',
      'controller',
      'brushed',
      primitives.box,
      panel,
      [0.5, 0.63, 0.15],
      new THREE.Quaternion().setFromAxisAngle(Y, 0.1),
    );
    add(
      'Controller recessed face',
      'control',
      'controller',
      'titanium',
      primitives.box,
      [0.845, 4.99, 0.733],
      [0.421, 0.542, 0.015],
    );
    for (const direction of [-1, 1])
      rod(
        'Controller pressed diagonal rib',
        'control',
        'controller',
        'steel',
        [0.64, 4.73, direction < 0 ? 0.75 : 0.746],
        [1.03, 5.25, direction < 0 ? 0.75 : 0.746],
        0.019,
      );
    for (const x of [0.65, 1.03])
      for (const y of [4.74, 5.23])
        bolt(
          'Controller cover screw',
          'control',
          'controller-fasteners',
          [x, y, 0.758],
          [0, 0, 1],
          0.025,
          1,
        );
    const harnesses = generation === 1 ? 9 : 7;
    for (let i = 0; i < harnesses; i++) {
      const curve = pipe(
        `Controller harness conductor ${i + 1}`,
        'control',
        'controller-harness',
        i % 4 === 0 ? 'copper' : 'black',
        [
          [0.7 + i * 0.029, 4.67, 0.73],
          [0.61 + i * 0.024, 4.42, 0.98],
          [0.47 + i * 0.025, 4.05, 1.04],
          [0.5 + i * 0.029, 3.68, 0.93],
          [0.15 + i * 0.023, 3.47, 0.71],
        ],
        0.012,
        false,
      );
      for (const t of [0.22, 0.52, 0.78]) {
        const p = curve.getPoint(t),
          n = curve.getTangent(t);
        ring(
          `Harness ${i + 1} braid retainer`,
          'control',
          'harness-retainers',
          'ceramic',
          p.toArray() as Point,
          0.015,
          0.004,
          n.toArray() as Point,
        );
      }
    }
  }

  // Photographed external joint hardware: detailed individual head / washer / thread pieces.
  // Plate covers and flange circles remain organised into mechanical assemblies.
  const detailJoints = generation === 1 ? 16 : generation === 2 ? 9 : 4;
  for (let i = 0; i < detailJoints; i++) {
    const a = (i / detailJoints) * TAU + 0.29;
    const y = 3.56 + (i % 4) * 0.37;
    const radius = 0.72 + (i % 3) * 0.055;
    const n: Point = [Math.cos(a), 0.06, Math.sin(a)];
    const p: Point = [Math.cos(a) * radius, y, Math.sin(a) * radius];
    const q = orientation(n);
    add(
      `Auxiliary circular access cover ${i + 1}`,
      'control',
      'access-covers',
      generation === 1 ? 'titanium' : 'dark',
      primitives.cylinder,
      p,
      [0.118, 0.04, 0.118],
      q,
    );
    flange(
      `Access-cover rim ${i + 1}`,
      'control',
      'access-cover-fasteners',
      v(p).addScaledVector(v(n).normalize(), 0.036).toArray() as Point,
      0.137,
      n,
      12,
      true,
    );
  }

  // Small illustrative nested pieces are confined to explicitly marked internal mode.
  // Their shapes describe generic component relationships, not actual Raptor internals.
  const internalY = 4.38;
  add(
    'Illustrative core disc',
    'injector',
    'schematic-core',
    'copper',
    primitives.cylinder,
    [0, internalY, 0],
    [0.44, 0.035, 0.44],
    new THREE.Quaternion(),
    true,
  );
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    const p: Point = [
      Math.cos(a) * 0.32,
      internalY + 0.026,
      Math.sin(a) * 0.32,
    ];
    add(
      `Illustrative disc opening ${i + 1}`,
      'injector',
      'schematic-core',
      'dark',
      primitives.cylinder,
      p,
      [0.01, 0.003, 0.01],
      new THREE.Quaternion(),
      true,
    );
  }
  const rotorCount = generation === 1 ? 28 : 24;
  for (const [system, center] of [
    ['oxygen', [-0.21, 4.77, -0.14]],
    ['methane', [0.92, 4.53, -0.11]],
  ] as [string, Point][]) {
    add(
      'Illustrative internal rotor hub',
      system,
      'schematic-rotors',
      'brushed',
      primitives.cylinder,
      center,
      [0.19, 0.09, 0.19],
      new THREE.Quaternion(),
      true,
    );
    for (let i = 0; i < rotorCount; i++) {
      const a = (i / rotorCount) * TAU;
      const p = v(center).add(
        new THREE.Vector3(Math.cos(a) * 0.27, 0, Math.sin(a) * 0.27),
      );
      add(
        `Illustrative rotor vane ${i + 1}`,
        system,
        'schematic-rotors',
        'steel',
        primitives.box,
        p.toArray() as Point,
        [0.12, 0.03, 0.024],
        new THREE.Quaternion().setFromAxisAngle(Y, -a + 0.6),
        true,
      );
    }
  }
  // Named groups retain stable IDs; generation switches can match systems, never invent CAD equivalence.
  return { parts, systems };
}
