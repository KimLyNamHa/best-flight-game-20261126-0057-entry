// terrain.js — the island: a seeded heightmap, the runway, the town and the
// trees. terrainHeight is the one source of truth for the ground, used by the
// flight model, the mesh, and everything placed on the island.
import * as THREE from 'three';

const SEED = 1337;
export const SEA_LEVEL = 0;
export const ISLAND_RADIUS = 1900;
export const RUNWAY = { x: 0, z: 0, length: 700, width: 46, height: 14 };

// Deterministic 2D value noise from an integer hash — same island every run.
function hash2(ix, iz) {
  let n = (Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(SEED, 974634211)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smooth01(t) {
  return t * t * (3 - 2 * t);
}

function smoothstep(a, b, v) {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// 1 inside |v| < inner, 0 outside |v| > outer, smooth between.
function band(v, inner, outer) {
  return 1 - smoothstep(inner, outer, Math.abs(v));
}

function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const u = smooth01(fx), v = smooth01(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, z) {
  let amp = 0.5, sum = 0, norm = 0;
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise(x, z);
    norm += amp;
    amp *= 0.5;
    x = x * 2.03 + 11.7;
    z = z * 2.01 + 5.3;
  }
  return sum / norm;
}

// Small seeded PRNG for placing trees and houses.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  // Rolling green hills with fine detail.
  let h = fbm(x * 0.0016 + 7.3, z * 0.0016 + 2.9) * 95;
  h += fbm(x * 0.007 + 1.7, z * 0.007 + 8.4) * 16;
  // The mountain in the north-west.
  const md = Math.hypot(x + 750, z + 650);
  h += 300 * Math.exp(-(md * md) / (2 * 420 * 420));
  // The lake bowl in the north-east.
  const ld = Math.hypot(x - 520, z + 420);
  h -= 55 * Math.exp(-(ld * ld) / (2 * 230 * 230));
  // The island edge falls away into the sea.
  const edge = smoothstep(1500, 1950, d);
  h = h * (1 - edge) + -28 * edge;
  // The runway plateau, flattened for takeoffs and landings, with a wide
  // gentle ramp so the strip sits in a soft valley, not a canyon.
  const rw = band(x, 320, 520) * band(z, 60, 240);
  h = h * (1 - rw) + RUNWAY.height * rw;
  return h;
}

function groundColor(h, x, z) {
  const n = valueNoise(x * 0.02, z * 0.02) * 0.14 - 0.07;
  if (h < 1.6) return [0.85 + n, 0.76 + n, 0.55 + n]; // sand
  if (h < 70) return [0.32 + n, 0.55 + n, 0.26 + n]; // grass
  if (h < 150) return [0.28 + n, 0.44 + n, 0.24 + n]; // high grass
  if (h < 225) return [0.45 + n, 0.42 + n, 0.4 + n]; // rock
  return [0.92, 0.92, 0.95]; // snow
}

export function createTerrain(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // The island mesh, displaced and coloured by the same height function.
  const size = 4400, seg = 150;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const c = groundColor(h, x, z);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  group.add(land);

  // The sea (and the lake — same water plane, same level).
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(7000, 7000),
    new THREE.MeshPhongMaterial({ color: 0x2e7fb8, transparent: true, opacity: 0.86, shininess: 90 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = SEA_LEVEL;
  group.add(water);

  // The runway: dark asphalt, white dashes, threshold bars.
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(RUNWAY.length, 1.2, RUNWAY.width),
    new THREE.MeshLambertMaterial({ color: 0x3a3f46 })
  );
  strip.position.set(RUNWAY.x, RUNWAY.height + 0.1, RUNWAY.z);
  group.add(strip);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf2f2e8 });
  for (let x = -300; x <= 300; x += 50) {
    const dash = new THREE.Mesh(new THREE.BoxGeometry(24, 0.3, 2.4), dashMat);
    dash.position.set(x, RUNWAY.height + 0.85, RUNWAY.z);
    group.add(dash);
  }
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 3), dashMat);
      bar.position.set(end * 320, RUNWAY.height + 0.85, k * 8);
      group.add(bar);
    }
  }

  // Windsock beside the runway, swaying with the wind.
  const sockPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.25, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0xdddddd })
  );
  sockPole.position.set(380, RUNWAY.height + 6, 62);
  group.add(sockPole);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.6, 6, 10),
    new THREE.MeshLambertMaterial({ color: 0xff7f2a })
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(383, RUNWAY.height + 11.4, 62);
  group.add(sock);

  // The little town east of the runway: boxes with pitched roofs.
  const rand = mulberry32(SEED + 77);
  const roofColors = [0xc96f4a, 0xb8543f, 0xd08a4e, 0x9a5b6e];
  const wallColors = [0xf2ead8, 0xe8dcc0, 0xdfd3b8, 0xf5efe0];
  for (let i = 0; i < 16; i++) {
    const bx = 500 + (rand() - 0.5) * 320;
    const bz = 300 + (rand() - 0.5) * 240;
    const w = 14 + rand() * 14, d = 12 + rand() * 12, hgt = 10 + rand() * 16;
    const gy = terrainHeight(bx, bz);
    const walls = new THREE.Mesh(
      new THREE.BoxGeometry(w, hgt, d),
      new THREE.MeshLambertMaterial({ color: wallColors[i % wallColors.length] })
    );
    walls.position.set(bx, gy + hgt / 2, bz);
    group.add(walls);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.72, 5 + rand() * 3, 4),
      new THREE.MeshLambertMaterial({ color: roofColors[i % roofColors.length] })
    );
    roof.position.set(bx, gy + hgt + 2.5, bz);
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
  }

  // Trees, instanced: a trunk and a cone of green, scattered on the grass.
  const treeSpots = [];
  let guard = 0;
  while (treeSpots.length < 230 && guard++ < 4000) {
    const tx = (rand() - 0.5) * 3600;
    const tz = (rand() - 0.5) * 3600;
    const th = terrainHeight(tx, tz);
    if (th < 4 || th > 95) continue;
    if (Math.abs(tx) < 480 && Math.abs(tz) < 110) continue; // keep the runway clear
    if (Math.hypot(tx - 520, tz - 300) < 190) continue; // keep the town clear
    treeSpots.push({ x: tx, z: tz, y: th, s: 0.8 + rand() * 0.9 });
  }
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  const leafGeo = new THREE.ConeGeometry(3.2, 9, 7);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f6b2a });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, treeSpots.length);
  const m4 = new THREE.Matrix4();
  treeSpots.forEach((t, i) => {
    m4.makeScale(t.s, t.s, t.s);
    m4.setPosition(t.x, t.y + 2.5 * t.s, t.z);
    trunks.setMatrixAt(i, m4);
    m4.makeScale(t.s, t.s, t.s);
    m4.setPosition(t.x, t.y + (5 + 4.5) * t.s, t.z);
    leaves.setMatrixAt(i, m4);
  });
  group.add(trunks);
  group.add(leaves);

  let time = 0;
  return {
    update(dt) {
      time += dt;
      sock.rotation.y = Math.sin(time * 0.7) * 0.35; // the sock swings gently
    },
  };
}
