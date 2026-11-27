// aircraft.js — the Skylark herself: a low-poly prop plane built from three.js
// primitives, nose toward -Z (three.js forward). update() flies the model
// from the flight state and spins the propeller with the throttle.
import * as THREE from 'three';

export function createAircraft(scene) {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ'; // yaw, then pitch, then roll — like a real plane
  scene.add(group);

  const paint = new THREE.MeshLambertMaterial({ color: 0x2f7fc4 }); // sky blue
  const cream = new THREE.MeshLambertMaterial({ color: 0xf3ead2 });
  const red = new THREE.MeshLambertMaterial({ color: 0xd23c2e });
  const dark = new THREE.MeshPhongMaterial({ color: 0x18324a, shininess: 90 }); // canopy glass
  const metal = new THREE.MeshLambertMaterial({ color: 0x22262b });

  // Fuselage: a tapered cylinder lying along Z, nose toward -Z.
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 6.4, 14), paint);
  fus.rotation.x = Math.PI / 2; // +Y (radiusTop, narrow) ends up at +Z, the tail
  group.add(fus);
  // Rounded nose.
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), paint);
  nose.scale.set(1, 1, 1.4);
  nose.position.set(0, 0, -3.2);
  group.add(nose);
  // Red cheatline stripe along the fuselage.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.22, 5.2), red);
  stripe.position.set(0, 0.15, -0.4);
  group.add(stripe);

  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark);
  canopy.scale.set(1, 0.9, 1.7);
  canopy.position.set(0, 0.45, -1.2);
  group.add(canopy);

  // Main wing and red tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11, 0.18, 2.6), cream);
  wing.position.set(0, -0.1, -0.6);
  group.add(wing);
  for (const s of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 2.6), red);
    tip.position.set(s * 5.1, -0.1, -0.6);
    group.add(tip);
  }
  // Tailplane and fin.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.14, 1.4), cream);
  tailplane.position.set(0, 0.15, 2.9);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.8), red);
  fin.position.set(0, 0.8, 2.9);
  group.add(fin);

  // Propeller: spinner cone and two blades, spinning around the nose axis.
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.9, 10), red);
  spinner.rotation.x = -Math.PI / 2; // point toward -Z
  spinner.position.set(0, 0, -4.5);
  group.add(spinner);
  const prop = new THREE.Group();
  prop.position.set(0, 0, -4.55);
  const bladeMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b });
  const bladeA = new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.8, 0.12), bladeMat);
  prop.add(bladeA);
  const bladeB = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.34, 0.12), bladeMat);
  prop.add(bladeB);
  group.add(prop);

  // Landing gear: two mains and a tail wheel.
  for (const s of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), metal);
    strut.position.set(s * 1.1, -0.95, -1.4);
    group.add(strut);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), metal);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 1.1, -1.45, -1.4);
    group.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 8), metal);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -0.85, 2.9);
  group.add(tailWheel);

  // Navigation lights: port red (left, -X), starboard green (right, +X), tail white.
  const navRed = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a22 }));
  navRed.position.set(-5.5, -0.1, -0.6);
  group.add(navRed);
  const navGreen = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0x2aff66 }));
  navGreen.position.set(5.5, -0.1, -0.6);
  group.add(navGreen);
  const tailLightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), tailLightMat);
  tailLight.position.set(0, 0.3, 3.35);
  group.add(tailLight);

  let time = 0;
  return {
    group,
    update(dt, f) {
      time += dt;
      group.position.set(f.x, f.y, f.z);
      group.rotation.y = f.heading - Math.PI / 2; // model faces -Z
      group.rotation.x = f.pitch; // nose up is positive
      group.rotation.z = -f.roll; // right bank is positive roll
      prop.rotation.z -= dt * (4 + f.throttle * 42 + f.speed * 0.12);
      // The tail light blinks once a second.
      tailLight.visible = (time % 1) < 0.12 || f.onGround;
    },
  };
}
