// camera.js — the chase camera. It trails behind and above the aircraft on a
// soft spring, looking ahead of the nose, and never rolls with the plane:
// the camera never fights the pilot. A crash shakes it briefly.
//
// opts: { dist, side } — dist is how far behind the tail the camera sits
// (26 in normal play); side shifts the camera laterally off the flight axis,
// for a three-quarter view that shows the plane's wings and the world in
// depth instead of a flat dead-behind shot. The look point shifts by the
// same side amount, so the view stays parallel to the flight axis and the
// plane stays framed while the angle sells the 3D.
import * as THREE from 'three';
import { forwardVector } from './flight.js';

export function createChaseCamera(camera) {
  return { camera, shake: 0 };
}

function chaseFrame(f, dist, side) {
  const fw = forwardVector(f);
  // Right vector of the nose: cross(forward, up) = (-fz, 0, fx).
  const rx = -fw.z, rz = fw.x;
  const pos = {
    x: f.x - fw.x * dist + rx * side,
    y: f.y - fw.y * dist + 7.5,
    z: f.z - fw.z * dist + rz * side,
  };
  const look = {
    x: f.x + fw.x * 45 + rx * side,
    y: f.y + fw.y * 45 + 1.5,
    z: f.z + fw.z * 45 + rz * side,
  };
  return { pos, look };
}

export function snapChaseCamera(cam, f, lookDy = 0, opts = {}) {
  const dist = opts.dist ?? 26;
  const side = opts.side ?? 0;
  const { pos, look } = chaseFrame(f, dist, side);
  cam.camera.position.set(pos.x, pos.y, pos.z);
  cam.camera.lookAt(look.x, look.y + lookDy, look.z);
}

export function updateChaseCamera(cam, f, dt, lookDy = 0, opts = {}) {
  const dist = opts.dist ?? 26;
  const side = opts.side ?? 0;
  const { pos, look } = chaseFrame(f, dist, side);
  // A critically damped-ish chase: fast enough to keep up, soft enough to
  // feel like a camera, not a tripod bolted to the tail.
  const k = 1 - Math.exp(-3.2 * dt);
  cam.camera.position.lerp(new THREE.Vector3(pos.x, pos.y, pos.z), k);
  const lookV = new THREE.Vector3(look.x, look.y + lookDy, look.z);
  if (cam.shake > 0.01) {
    lookV.x += (Math.random() - 0.5) * cam.shake;
    lookV.y += (Math.random() - 0.5) * cam.shake;
    lookV.z += (Math.random() - 0.5) * cam.shake;
    cam.shake *= Math.exp(-3.5 * dt);
  }
  cam.camera.lookAt(lookV);
}
