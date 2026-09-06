export type Generation = 1 | 2 | 3;
export type SurfaceMode = 'surface' | 'cutaway' | 'internals';
export type PartTransform = {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
};
export type ExplorerSettings = {
  generation: Generation;
  compare: boolean;
  mode: SurfaceMode;
  separation: number;
  detail: number;
  selected: string | null;
  isolated: boolean;
  isolatedSystem: string | null;
  systemSeparation: Record<string, number>;
  spin: boolean;
  projection: 'perspective' | 'orthographic';
  lighting: 'studio' | 'contrast';
  cutAngle: number;
  cutOffset: number;
  hidden: string[];
  transforms: Record<string, PartTransform>;
};
export type PartInfo = {
  id: string;
  name: string;
  system: string;
  group: string;
  material: string;
  internal: boolean;
};
export type SystemInfo = { id: string; name: string; description: string };
export type EngineInfo = {
  generation: Generation;
  parts: PartInfo[];
  systems: SystemInfo[];
  groups: number;
  triangles: number;
  drawCalls: number;
};
export const initialSettings: ExplorerSettings = {
  generation: 3,
  compare: false,
  mode: 'surface',
  separation: 0,
  detail: 0,
  selected: null,
  isolated: false,
  isolatedSystem: null,
  systemSeparation: {},
  spin: false,
  projection: 'perspective',
  lighting: 'studio',
  cutAngle: 0,
  cutOffset: 0,
  hidden: [],
  transforms: {},
};
export const zeroTransform: PartTransform = {
  x: 0,
  y: 0,
  z: 0,
  rx: 0,
  ry: 0,
  rz: 0,
};
export const generationCopy = {
  1: {
    subtitle: 'The exposed architecture',
    description:
      'Dense external routing, separate housings and a highly articulated upper assembly.',
    year: 'First generation',
  },
  2: {
    subtitle: 'The refined architecture',
    description:
      'A tighter arrangement of machinery, simplified routing and a distinctive external equipment housing.',
    year: 'Second generation',
  },
  3: {
    subtitle: 'The integrated architecture',
    description:
      'Continuous outer forms, compact upper machinery and a dramatically cleaner exterior.',
    year: 'Third generation',
  },
};
