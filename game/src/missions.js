// missions.js — the four sorties. Each mission is a small state machine with
// its own goal, its own scoring, and a one-line objective for the HUD.
// Ring Run flies rings in order; Touch & Go circuits the lake and lands;
// Supply Drop drops crates on the lake camp; Free Flight just flies.

export const MISSION_DEFS = {
  rings: {
    id: 'rings',
    name: 'Ring Run',
    description: 'Fly through all 8 rings in order. Each ring is 100 points; finishing fast pays a time bonus.',
  },
  touchgo: {
    id: 'touchgo',
    name: 'Touch & Go',
    description: 'Take off, round the lake buoy, and land back on the runway. A gentle touchdown scores best.',
  },
  supply: {
    id: 'supply',
    name: 'Supply Drop',
    description: 'Carry crates to the lake camp. Press Space over the glowing circle, low and slow, to drop them on target.',
  },
  free: {
    id: 'free',
    name: 'Free Flight',
    description: 'No objective. Just fly the island and enjoy the sky.',
  },
};

// The ring course: a loop around the island, heights a pilot can reach.
export function ringCourse() {
  return [
    { x: 380, y: 170, z: -260 },
    { x: 900, y: 220, z: -700 },
    { x: 700, y: 260, z: -1150 },
    { x: -100, y: 280, z: -1250 },
    { x: -950, y: 350, z: -800 }, // over the mountain slope: the terrain here is ~315, so the ring must fly above the peak's shoulder, not inside it
    { x: -1250, y: 200, z: 100 },
    { x: -700, y: 170, z: 800 },
    { x: 150, y: 150, z: 950 },
  ];
}

export function lakeBuoy() {
  return { x: 520, y: 90, z: -420 };
}

export function dropZoneDef() {
  return { x: 520, z: -420, radius: 70 };
}

export function createMission(id) {
  return {
    id,
    name: MISSION_DEFS[id].name,
    score: 0,
    time: 0,
    complete: false,
    // Ring Run
    rings: ringCourse(),
    nextRing: 0,
    ringsPassed: 0,
    // Touch & Go
    phase: 'takeoff', // takeoff -> circuit -> land -> done
    buoyReached: false,
    // Supply Drop
    dropsLeft: 3,
    dropped: false,
    message: '',
    messageUntil: 0,
  };
}

export function missionObjective(m) {
  if (m.complete) return 'Mission complete — nice flying!';
  if (m.id === 'rings') return `Fly through ring ${m.nextRing + 1} of 8`;
  if (m.id === 'touchgo') {
    if (m.phase === 'takeoff') return 'Take off — full throttle, pull up gently';
    if (m.phase === 'circuit') return 'Round the lake buoy, then come back to land';
    return 'Land on the runway — slow and gentle';
  }
  if (m.id === 'supply') return `Drop supplies on the glowing circle (${m.dropsLeft} crates left)`;
  return 'Free flight — enjoy the island';
}

function dist3(f, p) {
  return Math.hypot(f.x - p.x, f.y - p.y, f.z - p.z);
}

// One step of the mission logic. ev carries the flight events and the
// action key: { action, touchedDown, landedOnRunway, verticalSpeed, tookOff }.
// Returns { event, text } for toasts and sounds, or null.
export function updateMission(m, f, ev, dt) {
  if (m.complete) return null;
  m.time += dt;

  if (m.id === 'rings') {
    const ring = m.rings[m.nextRing];
    if (ring && dist3(f, ring) < 17) {
      m.nextRing++;
      m.ringsPassed++;
      m.score += 100;
      if (m.nextRing >= m.rings.length) {
        m.complete = true;
        const bonus = Math.max(0, Math.round(600 - m.time * 2));
        m.score += bonus;
        return { event: 'complete', text: `All 8 rings! Time bonus +${bonus}` };
      }
      return { event: 'ring', text: `Ring ${m.ringsPassed} of 8 — +100` };
    }
    return null;
  }

  if (m.id === 'touchgo') {
    if (m.phase === 'takeoff' && ev.tookOff) {
      m.phase = 'circuit';
      return { event: 'takeoff', text: 'Airborne! Head for the lake buoy' };
    }
    if (m.phase === 'circuit' && dist3(f, lakeBuoy()) < 200) {
      m.phase = 'land';
      m.buoyReached = true;
      return { event: 'buoy', text: 'Buoy rounded — bring her home to the runway' };
    }
    if (m.phase === 'land' && ev.touchedDown && ev.landedOnRunway) {
      m.complete = true;
      const soft = Math.max(0, Math.round(120 - Math.abs(ev.verticalSpeed) * 8));
      const bonus = Math.max(0, Math.round(400 - m.time * 1.5));
      m.score += 300 + soft + bonus;
      return { event: 'complete', text: `Touchdown! Soft landing +${soft}, time +${bonus}` };
    }
    if (m.phase === 'land' && ev.touchedDown && !ev.landedOnRunway) {
      return { event: 'rough', text: 'That was not the runway — take off and try again' };
    }
    return null;
  }

  if (m.id === 'supply') {
    if (ev.action && m.dropsLeft > 0) {
      m.dropsLeft--;
      const dz = dropZoneDef();
      const d = Math.hypot(f.x - dz.x, f.z - dz.z);
      const heightAboveGround = f.y - 14; // the camp sits near the lake shore
      if (d < dz.radius && heightAboveGround < 380 && !f.onGround) {
        m.dropped = true;
        m.complete = true;
        const accuracy = Math.max(50, Math.round(400 - d * 3));
        m.score += accuracy;
        return { event: 'complete', text: `Supplies on target! Accuracy +${accuracy}` };
      }
      if (m.dropsLeft === 0) {
        return { event: 'miss', text: 'Out of crates — the camp goes hungry' };
      }
      return { event: 'miss', text: 'Dropped wide of the circle — try again' };
    }
    return null;
  }

  return null; // free flight: nothing to score
}
