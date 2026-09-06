import * as THREE from 'three/webgpu';
import type { EnginePart } from './geometry';
import type { PartTransform } from './types';
const position = new THREE.Vector3(),
  pivot = new THREE.Vector3(),
  rotation = new THREE.Euler();
const delta = new THREE.Matrix4(),
  turn = new THREE.Matrix4(),
  origin = new THREE.Matrix4();
/** Rotate every component around its own geometric centre, including swept pipes. */
export function composeEnginePart(
  part: EnginePart,
  separation: number,
  detail: number,
  modification: PartTransform | undefined,
  target: THREE.Matrix4,
) {
  position
    .copy(part.position)
    .addScaledVector(part.separation, separation)
    .addScaledVector(part.detail, detail * 3);
  target.compose(position, part.quaternion, part.scale);
  if (modification) {
    if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
    part.geometry.boundingBox!.getCenter(pivot).applyMatrix4(target);
    rotation.set(
      (modification.rx * Math.PI) / 180,
      (modification.ry * Math.PI) / 180,
      (modification.rz * Math.PI) / 180,
    );
    delta
      .makeTranslation(
        pivot.x + modification.x,
        pivot.y + modification.y,
        pivot.z + modification.z,
      )
      .multiply(turn.makeRotationFromEuler(rotation))
      .multiply(origin.makeTranslation(-pivot.x, -pivot.y, -pivot.z));
    target.premultiply(delta);
  }
  return target;
}
