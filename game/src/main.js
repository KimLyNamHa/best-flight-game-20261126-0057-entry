// main.js — bootstrap and game loop for Skylark — Island Run.
// Wires the flight model, the island, the plane, the sky, the rings, the HUD,
// the missions, the input, the audio and the chase camera into one game,
// and runs the screen state machine: title, playing, paused, complete, crashed.
import * as THREE from 'three';
import { createFlight, updateFlight, FLIGHT_TUNING } from './flight.js';
import { createTerrain, terrainHeight, RUNWAY } from './terrain.js';
import { createAircraft } from './aircraft.js';
import { createSky } from './sky.js';
import { createRings, createDropZone } from './rings.js';
import { createHud } from './hud.js';
import {
  MISSION_DEFS, createMission, missionObjective, updateMission,
  ringCourse, lakeBuoy, dropZoneDef,
} from './missions.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createChaseCamera, updateChaseCamera, snapChaseCamera } from './camera.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot'); // start | play | land | end (deterministic stills)
const autoMode = params.get('auto') === '1'; // autopilot, for play-testing
const startMission = params.get('mission');

// --- Renderer, scene, camera -------------------------------------------------
const sceneCanvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas: sceneCanvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);
const chaseCam = createChaseCamera(camera);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- The world ---------------------------------------------------------------
const terrain = createTerrain(scene);
const sky = createSky(scene);
const aircraft = createAircraft(scene);
const ringSet = createRings(scene, ringCourse());
const dropZone = createDropZone(scene, dropZoneDef(), dropZoneDef().radius);

// --- State -------------------------------------------------------------------
const flight = createFlight();
let mission = createMission('rings');
let screen = 'title'; // title | playing | paused | complete | crashed
let hudMessage = '';
let hudMessageUntil = 0;
let time = 0;

const input = createInput();
const audio = createAudio();
const hud = createHud(document.getElementById('hud'));

const titleScreen = document.getElementById('title-screen');
const endScreen = document.getElementById('end-screen');
const endTitle = document.getElementById('end-title');
const endDetail = document.getElementById('end-detail');
const endScore = document.getElementById('end-score');
const pauseScreen = document.getElementById('pause-screen');
const toastEl = document.getElementById('toast');

let toastTimer = 0;
function showToast(text, ms = 2600) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), ms);
}

function setScreen(next, detail = '') {
  screen = next;
  titleScreen.classList.toggle('hidden', next !== 'title');
  pauseScreen.classList.toggle('hidden', next !== 'paused');
  endScreen.classList.toggle('hidden', next !== 'complete' && next !== 'crashed');
  if (next === 'complete') {
    endTitle.textContent = 'Mission complete';
    endDetail.textContent = detail || `${mission.name} — flown and finished.`;
    endScore.textContent = `Score ${mission.score}`;
  } else if (next === 'crashed') {
    endTitle.textContent = 'Crashed';
    endDetail.textContent = detail || flight.crashReason || 'The Skylark is down.';
    endScore.textContent = `Score ${mission.score}`;
  }
  input.flush();
}

function resetFlightToRunway() {
  Object.assign(flight, createFlight());
  flight.x = -260;
  flight.y = RUNWAY.height + 1.4;
  flight.z = 0;
  flight.heading = 0;
  snapChaseCamera(chaseCam, flight);
}

function setMission(id) {
  mission = createMission(id);
  ringSet.reset();
  ringSet.rings.forEach((r) => { r.mesh.visible = id === 'rings'; });
  dropZone.group.visible = id === 'supply';
  resetFlightToRunway();
}

document.querySelectorAll('[data-mission]').forEach((btn) => {
  btn.addEventListener('click', () => {
    audio.ensure();
    audio.click();
    setMission(btn.dataset.mission);
    setScreen('playing');
    showToast(`${MISSION_DEFS[btn.dataset.mission].name} — good luck, pilot`);
  });
});
document.getElementById('again-btn').addEventListener('click', () => {
  audio.click();
  setMission(mission.id);
  setScreen('playing');
});
document.getElementById('menu-btn').addEventListener('click', () => {
  audio.click();
  setMission('rings');
  setScreen('title');
});

// --- Autopilot (only with ?auto=1, for play-testing) -------------------------
function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function autopilotInput() {
  let target;
  if (mission.id === 'rings' && !mission.complete) {
    target = mission.rings[mission.nextRing];
  } else if (mission.id === 'touchgo' && mission.phase === 'circuit') {
    target = { ...lakeBuoy(), y: 120 };
  } else if (mission.id === 'supply' && !mission.complete) {
    target = { x: dropZoneDef().x, y: 200, z: dropZoneDef().z };
  } else {
    target = { x: flight.x + 500, y: 200, z: flight.z };
  }
  const desiredHeading = Math.atan2(-(target.z - flight.z), target.x - flight.x);
  const err = wrapAngle(desiredHeading - flight.heading);
  // Slow down for a big turn: the turn radius shrinks with speed, so the
  // plane can actually line up on the ring instead of overshooting it in a
  // wide arc and circling. Cruise at 125 when lined up, 70 when turning.
  const targetSpeed = Math.abs(err) > 0.6 ? 70 : 125;
  return {
    pitch: Math.max(-0.6, Math.min(0.6, (target.y - flight.y) * 0.02)),
    roll: Math.max(-1, Math.min(1, -err * 1.5)),
    rudder: 0,
    throttleUp: flight.speed < targetSpeed,
    throttleDown: flight.speed > targetSpeed,
  };
}

// --- HUD state ---------------------------------------------------------------
function hudState() {
  const warnings = [];
  if (!flight.onGround && flight.speed < FLIGHT_TUNING.stallSpeed) warnings.push('STALL');
  if (flight.fuel < 15) warnings.push('LOW FUEL');
  if (flight.damage > 50) warnings.push('DAMAGE');
  const hdgDeg = (90 - (flight.heading * 180) / Math.PI + 360) % 360;
  return {
    altFt: flight.y * 3.28084,
    spdKt: flight.speed * 1.94384,
    hdgDeg,
    throttle: flight.throttle,
    fuel: flight.fuel,
    damage: flight.damage,
    score: mission.score,
    time: mission.time,
    objective: missionObjective(mission),
    warnings,
    message: time < hudMessageUntil ? hudMessage : '',
    hideCompass: screen === 'complete' || screen === 'crashed',
  };
}

function setHudMessage(text, seconds = 2.5) {
  hudMessage = text;
  hudMessageUntil = time + seconds;
}

// --- Main loop ---------------------------------------------------------------
const clock = new THREE.Clock();
let firstFrame = true;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  time += dt;

  // Global keys, whatever the screen.
  if (input.mutePressed()) {
    audio.setMuted(!audio.isMuted());
    showToast(audio.isMuted() ? 'Sound off' : 'Sound on', 1200);
  }

  if (shotMode) {
    // A frozen still: the plane, the camera and the HUD do not move.
    aircraft.update(0.016, flight);
    sky.update(0.016);
    terrain.update(0.016);
    ringSet.update(0.016, mission.nextRing);
    dropZone.update(0.016);
    if (screen !== 'title') hud.draw(hudState(), time);
    snapChaseCamera(chaseCam, flight, shotGame.lookDy, { dist: shotGame.camDist, side: shotGame.lookSide });
    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      document.title = `shot:${shotMode}`;
      window.__ready = true;
    }
    return;
  }

  if (screen === 'playing') {
    if (input.pausePressed()) {
      setScreen('paused');
    } else {
      const ctl = autoMode ? autopilotInput() : input.read();
      const ev = updateFlight(flight, ctl, dt, terrainHeight);
      ev.action = input.actionPressed();
      const mEv = updateMission(mission, flight, ev, dt);
      if (ev.tookOff) {
        setHudMessage('Airborne!');
        audio.thud();
      }
      if (ev.touchedDown) {
        setHudMessage(ev.landedOnRunway ? 'Touchdown — on the runway' : 'Touchdown');
        audio.thud();
      }
      if (ev.stalled) setHudMessage('Stalling — nose down, throttle up!', 1.2);
      if (mEv) {
        showToast(mEv.text);
        if (mEv.event === 'ring' || mEv.event === 'buoy' || mEv.event === 'takeoff') audio.chime();
        if (mEv.event === 'complete') audio.fanfare();
      }
      if (flight.crashed) {
        chaseCam.shake = 6;
        audio.crash();
        setScreen('crashed', flight.crashReason);
      } else if (mission.complete && screen === 'playing') {
        audio.fanfare();
        setScreen('complete');
      }
      if (input.restartPressed()) {
        setMission(mission.id);
        setScreen('playing');
        showToast('Restarted — back on the runway');
      }
    }
  } else if (screen === 'paused') {
    if (input.pausePressed()) setScreen('playing');
    if (input.restartPressed()) {
      setMission(mission.id);
      setScreen('playing');
    }
  }

  // World life, every frame.
  aircraft.update(dt, flight);
  sky.update(dt);
  terrain.update(dt);
  ringSet.update(dt, mission.nextRing);
  dropZone.update(dt);
  if (screen !== 'title') {
    updateChaseCamera(chaseCam, flight, dt);
    hud.draw(hudState(), time);
  }
  audio.setEngine(flight.throttle, flight.speed, screen === 'playing');
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    window.__ready = true;
  }
}

// --- Start -------------------------------------------------------------------
// The object handed to applyShot: mission is a live getter, and lookDy lets a
// shot raise the camera's gaze so the plane sits low in the frame; lookSide
// and camDist frame a shot in three-quarter (side offset, closer chase).
const shotGame = {
  flight,
  get mission() { return mission; },
  lookDy: 0,
  lookSide: 0,
  camDist: 26,
  setMission: (id) => setMission(id),
  setScreen: (s, d) => setScreen(s, d),
  setRingsPassed: (n) => { for (let i = 0; i < n; i++) ringSet.setPassed(i); },
  snapCamera: () => snapChaseCamera(chaseCam, flight, shotGame.lookDy),
};

setMission('rings');
setScreen('title');
if (shotMode) {
  document.body.classList.add('shot');
  applyShot(shotMode, shotGame);
} else if (autoMode && startMission && MISSION_DEFS[startMission]) {
  setMission(startMission);
  setScreen('playing');
}
snapChaseCamera(chaseCam, flight);

window.__game = {
  flight,
  get mission() { return mission; },
  get screen() { return screen; },
  setMission,
  setScreen,
};

frame();
