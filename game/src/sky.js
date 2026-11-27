// sky.js — the sky dome with a gradient and sun, the drifting clouds, the
// fog, and the lights. One style for the whole island: soft blue daylight.
import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(0.5, 0.55, 0.35).normalize();

export function createSky(scene) {
  // Gradient dome: pale horizon, deep blue zenith, a glowing sun disc.
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { sunDir: { value: SUN_DIR } },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 sunDir;
      void main() {
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 horizon = vec3(0.78, 0.90, 0.96);
        vec3 zenith = vec3(0.20, 0.52, 0.83);
        vec3 col = mix(horizon, zenith, pow(max(h, 0.0), 0.65));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        col += vec3(1.0, 0.90, 0.60) * pow(s, 220.0) * 1.2;
        col += vec3(1.0, 0.85, 0.55) * pow(s, 8.0) * 0.18;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5200, 32, 16), skyMat);
  scene.add(dome);

  // Warm sun light and soft sky fill.
  const sun = new THREE.DirectionalLight(0xfff2d8, 1.25);
  sun.position.copy(SUN_DIR).multiplyScalar(1000);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9e8, 0x8a7a5a, 0.75));

  // Haze so the far sea melts into the horizon.
  scene.fog = new THREE.Fog(0xd6e9f2, 900, 4200);

  // Puffy clouds: clusters of flattened white spheres, drifting with the
  // wind. Unlit, so they stay bright white against the sky. They fly in
  // three layers — low (just above the hills), mid (the cruising layer) and
  // high (thin and far) — so a screenshot reads depth at a glance: the
  // plane, the terrain and the clouds never sit on one flat plane.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  const clouds = [];
  let seed = 4242;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) | 0;
    return ((seed >>> 0) % 100000) / 100000;
  };
  const cloudLayers = [
    { count: 6, yMin: 170, yMax: 230, size: 26 }, // low, above the hills
    { count: 8, yMin: 280, yMax: 440, size: 34 }, // mid, the cruising layer
    { count: 5, yMin: 520, yMax: 680, size: 44 }, // high, thin and far
  ];
  for (const layer of cloudLayers) {
    for (let i = 0; i < layer.count; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < puffs; j++) {
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        const s = layer.size * (0.7 + rnd() * 0.9);
        puff.scale.set(s, s * 0.42, s * 0.8);
        puff.position.set((rnd() - 0.5) * 90, (rnd() - 0.5) * 10, (rnd() - 0.5) * 40);
        cloud.add(puff);
      }
      cloud.position.set((rnd() - 0.5) * 3600, layer.yMin + rnd() * (layer.yMax - layer.yMin), (rnd() - 0.5) * 3600);
      scene.add(cloud);
      clouds.push(cloud);
    }
  }

  return {
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x += dt * 6; // the wind pushes east
        if (cloud.position.x > 2000) cloud.position.x = -2000;
      }
    },
  };
}
