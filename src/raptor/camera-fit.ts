import { Box3, MathUtils, Vector3 } from 'three/webgpu';

// Fit actual geometry in both axes, leaving space for the viewport controls.
export function fitCameraToBounds(
  box: Box3,
  direction: Vector3,
  aspect: number,
  fov = 36,
) {
  const target = box.getCenter(new Vector3());
  const backward = direction.clone().normalize();
  const right = new Vector3(0, 1, 0).cross(backward).normalize();
  if (right.lengthSq() < 0.00001) right.set(1, 0, 0);
  const up = backward.clone().cross(right).normalize();
  const tan = Math.tan(MathUtils.degToRad(fov / 2));
  let distance = 0.12,
    halfHeight = 0.04;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const corner = new Vector3(x, y, z).sub(target);
        const width = Math.abs(corner.dot(right)),
          height = Math.abs(corner.dot(up)),
          depth = corner.dot(backward);
        distance = Math.max(
          distance,
          depth + width / (tan * aspect * 0.82),
          depth + height / (tan * 0.74),
        );
        halfHeight = Math.max(
          halfHeight,
          width / (aspect * 0.82),
          height / 0.74,
        );
      }
  return {
    target,
    position: target.clone().addScaledVector(backward, distance),
    halfHeight,
  };
}
