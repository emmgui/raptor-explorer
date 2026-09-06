import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import * as THREE from 'three/webgpu';
import { moduleURL } from './load-ts.mjs';
const { buildEngine } = await import(
  await moduleURL(resolve('src/raptor/geometry.ts'))
);
const { composeEnginePart } = await import(
  await moduleURL(resolve('src/raptor/pose.ts'))
);
const matrix = new THREE.Matrix4();
const stats = [];
const ids = new Set();
for (const generation of [1, 2, 3]) {
  const engine = buildEngine(generation),
    geometries = new Set(engine.parts.map((p) => p.geometry));
  for (const geometry of geometries) {
    assert(
      [...geometry.getAttribute('position').array].every(Number.isFinite),
      'Finite vertex data',
    );
    assert(
      [...geometry.getAttribute('normal').array].every(Number.isFinite),
      'Finite normals',
    );
    geometry.computeBoundingBox();
  }
  const original = engine.parts.map((part) =>
    composeEnginePart(
      part,
      0,
      0,
      undefined,
      new THREE.Matrix4(),
    ).elements.slice(),
  );
  for (let step = 0; step <= 20; step++)
    for (const part of engine.parts) {
      composeEnginePart(part, step / 20, step / 20, undefined, matrix);
      assert(matrix.elements.every(Number.isFinite));
      assert(
        Math.abs(matrix.determinant()) > 1e-15,
        'Nonsingular part transform',
      );
    }
  engine.parts.forEach((part, i) => {
    assert(!ids.has(part.id), 'Unique selection ID');
    ids.add(part.id);
    assert(engine.systems.some((s) => s.id === part.system));
    assert(Math.abs(part.quaternion.length() - 1) < 0.001);
    assert.deepEqual(
      composeEnginePart(part, 0, 0, undefined, matrix).elements,
      original[i],
      'Exact reassembly',
    );
    const center = part.geometry.boundingBox
      .getCenter(new THREE.Vector3())
      .applyMatrix4(matrix);
    composeEnginePart(
      part,
      0,
      0,
      { x: 0, y: 0, z: 0, rx: 90, ry: 13, rz: -37 },
      matrix,
    );
    const rotatedCenter = part.geometry.boundingBox
      .getCenter(new THREE.Vector3())
      .applyMatrix4(matrix);
    assert(
      center.distanceTo(rotatedCenter) < 1e-10,
      'Individual rotation must preserve its pivot',
    );
    composeEnginePart(
      part,
      0,
      0,
      { x: 1, y: -0.5, z: 0.25, rx: 90, ry: 0, rz: 0 },
      matrix,
    );
    const movedCenter = part.geometry.boundingBox
      .getCenter(new THREE.Vector3())
      .applyMatrix4(matrix);
    assert(
      center.add(new THREE.Vector3(1, -0.5, 0.25)).distanceTo(movedCenter) <
        1e-10,
      'Translation is independent of rotation',
    );
  });
  stats.push({
    generation,
    selectableElements: engine.parts.length,
    groups: new Set(engine.parts.map((p) => p.group)).size,
    geometryBuffers: geometries.size,
    internalStudyElements: engine.parts.filter((p) => p.internal).length,
  });
}
assert(
  stats[0].selectableElements > stats[1].selectableElements &&
    stats[1].selectableElements > stats[2].selectableElements,
);
console.log(
  JSON.stringify(
    {
      result: 'passed',
      models: stats,
      articulation: '21 separation/detail samples per element',
      rotation: 'centre-preserving on every selectable element',
      reassembly: 'exact',
      selectionIDs: ids.size,
    },
    null,
    2,
  ),
);

const { fitCameraToBounds } = await import(
  await moduleURL(resolve('src/raptor/camera-fit.ts'))
);
let cameraCases = 0;
for (const aspect of [0.5, 0.75, 1.3, 2.2])
  for (const direction of [
    new THREE.Vector3(0.55, 0.15, 1),
    new THREE.Vector3(0.12, 0.15, 1),
    new THREE.Vector3(0, 0.025, -1),
    new THREE.Vector3(0, 1, 0.001),
  ]) {
    const bounds = new THREE.Box3(
      new THREE.Vector3(-7, -2, -3),
      new THREE.Vector3(7, 9, 4),
    );
    const fit = fitCameraToBounds(bounds, direction, aspect);
    const camera = new THREE.PerspectiveCamera(36, aspect, 0.003, 150);
    camera.position.copy(fit.position);
    camera.lookAt(fit.target);
    camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          const corner = new THREE.Vector3(x, y, z).project(camera);
          assert(
            Math.abs(corner.x) <= 0.820001 &&
              Math.abs(corner.y) <= 0.740001 &&
              corner.z < 1,
            'Whole assembly must fit even in portrait comparison',
          );
        }
    cameraCases++;
  }
console.log(
  `Camera framing: ${cameraCases} aspect/direction combinations passed.`,
);
