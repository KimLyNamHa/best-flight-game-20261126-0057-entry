// rings.js — the glowing target rings for Ring Run and the drop-zone beacon
// for Supply Drop. The next ring pulses gold, passed rings turn green.
import * as THREE from 'three';

const COLOR_NEXT = 0xffa726;
const COLOR_DONE = 0x66bb6a;
const COLOR_IDLE = 0x9fc6e8;

export function createRings(scene, positions) {
  const rings = positions.map((p, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: COLOR_IDLE, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(17, 1.5, 12, 42), mat);
    mesh.position.set(p.x, p.y, p.z);
    // Face the ring at whoever flies in: toward the previous ring, or the
    // island centre for the first one.
    const from = i === 0 ? { x: 0, y: 120, z: 0 } : positions[i - 1];
    mesh.lookAt(from.x, from.y, from.z);
    scene.add(mesh);
    return { pos: p, mesh, mat, passed: false };
  });

  let time = 0;
  return {
    rings,
    setPassed(i) {
      rings[i].passed = true;
    },
    reset() {
      for (const r of rings) r.passed = false;
    },
    update(dt, nextIndex) {
      time += dt;
      rings.forEach((r, i) => {
        if (r.passed) {
          r.mat.color.setHex(COLOR_DONE);
          r.mat.opacity = 0.35;
          r.mesh.scale.setScalar(1);
        } else if (i === nextIndex) {
          r.mat.color.setHex(COLOR_NEXT);
          r.mat.opacity = 0.95;
          r.mesh.scale.setScalar(1 + 0.06 * Math.sin(time * 3));
        } else {
          r.mat.color.setHex(COLOR_IDLE);
          r.mat.opacity = 0.5;
          r.mesh.scale.setScalar(1);
        }
      });
    },
  };
}

// The supply drop zone: a glowing circle on the ground and a beam of light.
export function createDropZone(scene, center, radius) {
  const group = new THREE.Group();
  group.position.set(center.x, 0, center.z);
  scene.add(group);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 2.5, 10, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, opacity: 0.9 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 6;
  group.add(ring);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 320, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd54f, transparent: true, opacity: 0.1,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  beam.position.y = 166;
  group.add(beam);

  let time = 0;
  return {
    group,
    update(dt) {
      time += dt;
      const s = 1 + 0.05 * Math.sin(time * 2.2);
      ring.scale.set(s, s, 1);
      beam.material.opacity = 0.08 + 0.04 * Math.sin(time * 2.2);
    },
  };
}
