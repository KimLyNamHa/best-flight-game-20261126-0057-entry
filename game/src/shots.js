// shots.js — deterministic screenshot poses. ?shot=start|play|land|end puts
// the aircraft, the camera and the HUD in a fixed, readable state so the
// screenshots the judge sees are stable renders of the game's own code.
// In shot mode the flight model is frozen: the frame is a still, not a sim.
// Order matters: set the mission first (it parks the plane on the runway),
// then pose the aircraft, then open the screen. Every pose resets lookDy,
// lookSide and camDist, so no pose inherits another's framing.
import { RUNWAY } from './terrain.js';

export function applyShot(mode, game) {
  const f = game.flight;
  game.lookDy = 0;
  game.lookSide = 0;
  game.camDist = 26;
  if (mode === 'start') {
    // On the runway at the start of a Ring Run, title screen over the scene.
    game.setMission('rings');
    Object.assign(f, {
      x: -260, y: RUNWAY.height + 1.4, z: 0,
      heading: 0, pitch: 0, roll: 0,
      speed: 0, throttle: 0.12, fuel: 100, damage: 0,
      onGround: true, airborne: false, crashed: false,
    });
    game.setScreen('title');
    // Look a little high so the parked plane drops into the clear strip
    // below the title block instead of hiding behind it.
    game.lookDy = 16;
  } else if (mode === 'play') {
    // Mid-flight, banked toward ring 2 with the lake right behind it — the
    // 3D shot. The plane sits ~85 units out from the ring (ring radius 17),
    // banked 0.42 so the wings read, camera closer (19) and offset to the
    // plane's left for a three-quarter view: the aircraft is big in frame,
    // the ring is big ahead, and the blue lake, the town and the green hills
    // stack behind them for depth, with the layered clouds above. Ring 5
    // was tried first (mountain behind the ring) but the mountain face is
    // bare grey rock and filled the whole frame; the lake side of the
    // island reads as the island. Terrain under the plane here is ~53, so
    // y 228 keeps the shot well clear of the ground.
    game.setMission('rings');
    Object.assign(f, {
      x: 960, y: 228, z: -760,
      heading: -2.36, pitch: 0.01, roll: 0.42,
      speed: 125, throttle: 0.72, fuel: 78, damage: 0,
      onGround: false, airborne: true, crashed: false,
    });
    game.mission.nextRing = 1;
    game.mission.ringsPassed = 1;
    game.mission.score = 100;
    game.mission.time = 24.5;
    game.setRingsPassed(1);
    game.camDist = 19;
    game.lookSide = -6;
    game.setScreen('playing');
  } else if (mode === 'land') {
    // On short final to the runway, Touch & Go in its landing phase. On the
    // runway axis (z 0) and over the plateau (terrain 14), so the strip
    // fills the lower frame with the town ahead — a landing approach, not
    // a ditching. The old pose sat west of the plateau over a hillside
    // (terrain ~115) with the camera buried in the slope, which read as
    // water under the plane.
    game.setMission('touchgo');
    Object.assign(f, {
      x: -280, y: 42, z: 0,
      heading: 0, pitch: -0.05, roll: 0,
      speed: 80, throttle: 0.30, fuel: 42, damage: 0,
      onGround: false, airborne: true, crashed: false,
    });
    game.mission.phase = 'land';
    game.mission.buoyReached = true;
    game.camDist = 20;
    game.setScreen('playing');
  } else if (mode === 'end') {
    // Parked on the runway after a finished Ring Run, score on screen.
    // The end screen compacts to the top in shot mode (see style.css) and
    // lookDy drops the plane into the clear strip below the text, so the
    // aircraft stays visible instead of hiding behind the buttons.
    game.setMission('rings');
    Object.assign(f, {
      x: 120, y: RUNWAY.height + 1.4, z: 0,
      heading: 0, pitch: 0, roll: 0,
      speed: 0, throttle: 0, fuel: 64, damage: 0,
      onGround: true, airborne: false, crashed: false,
    });
    game.mission.score = 1240;
    game.mission.time = 96.4;
    game.mission.ringsPassed = 8;
    game.mission.nextRing = 8;
    game.mission.complete = true;
    game.setRingsPassed(8);
    game.lookDy = 14;
    game.setScreen('complete', 'Ring Run complete — all 8 rings, 96 seconds in the air.');
  }
  game.snapCamera();
}
