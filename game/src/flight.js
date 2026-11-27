// flight.js — the flight model: throttle, pitch, roll, speed, lift and stall,
// fuel burn and damage. Pure numbers in, pure numbers out; no rendering here.
// Speeds are metres per second inside; the HUD converts to knots and feet.

export const FLIGHT_TUNING = {
  maxSpeed: 250, // m/s at full throttle, level flight
  stallSpeed: 58, // m/s — below this the wing stops flying and the nose drops
  takeoffSpeed: 72, // m/s — fast enough to lift off the runway
  maxRoll: 1.05, // radians of bank
  maxPitch: 0.5, // radians nose up or down
  rollRate: 2.4, // rad/s toward the commanded bank
  pitchRate: 1.8, // rad/s toward the commanded pitch
  fuelBurn: 0.85, // percent of the tank per second at full throttle
  groundClearance: 1.4, // metres of landing gear between belly and ground
};

export function createFlight() {
  return {
    x: -260, y: 15.4, z: 0, // metres; y is altitude above sea level
    heading: 0, pitch: 0, roll: 0, // radians; heading 0 flies east (+X)
    speed: 0, throttle: 0, // m/s, 0..1
    fuel: 100, damage: 0, // percent
    onGround: true, airborne: false,
    verticalSpeed: 0, crashed: false, crashReason: '',
  };
}

// Unit forward vector of the nose, from heading and pitch.
export function forwardVector(f) {
  const cp = Math.cos(f.pitch);
  return {
    x: Math.cos(f.heading) * cp,
    y: Math.sin(f.pitch),
    z: -Math.sin(f.heading) * cp,
  };
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function crash(f, reason) {
  f.crashed = true;
  f.crashReason = reason;
  f.speed = 0;
}

// One simulation step. input: { pitch, roll, rudder } each -1..1,
// throttleUp / throttleDown booleans. groundHeightAt(x, z) is the terrain.
// Returns the events that happened this step.
export function updateFlight(f, input, dt, groundHeightAt) {
  const ev = { tookOff: false, touchedDown: false, landedOnRunway: false, stalled: false, verticalSpeed: f.verticalSpeed };
  if (f.crashed) return ev;
  const T = FLIGHT_TUNING;

  // Throttle lever, and an empty tank means gliding only.
  if (input.throttleUp) f.throttle = Math.min(1, f.throttle + 0.6 * dt);
  if (input.throttleDown) f.throttle = Math.max(0, f.throttle - 0.6 * dt);
  if (f.fuel <= 0) f.throttle = 0;

  // Bank and pitch ease toward the stick, so the plane feels weighty.
  const targetRoll = input.roll * T.maxRoll;
  const targetPitch = input.pitch * T.maxPitch;
  f.roll += (targetRoll - f.roll) * Math.min(1, T.rollRate * dt);
  f.pitch += (targetPitch - f.pitch) * Math.min(1, T.pitchRate * dt);

  // Rudder nudges the nose; bank turns the plane (right bank turns right).
  f.heading += input.rudder * 0.35 * dt * (0.4 + f.speed / T.maxSpeed);
  f.heading -= Math.sin(f.roll) * 0.5 * (0.45 + f.speed / 260) * dt;

  // Speed chases the throttle; climbing bleeds it, diving feeds it.
  const targetSpeed = f.throttle * T.maxSpeed;
  f.speed += (targetSpeed - f.speed) * Math.min(1, 0.45 * dt);
  f.speed -= Math.sin(f.pitch) * 26 * dt;
  f.speed = Math.max(0, Math.min(T.maxSpeed * 1.12, f.speed));

  // Lift, stall and the ground.
  if (f.onGround) {
    f.verticalSpeed = 0;
    if (f.speed > T.takeoffSpeed && f.pitch > 0.06) {
      f.onGround = false;
      f.airborne = true;
      ev.tookOff = true;
      // Climb away in this same step: without it the plane is still exactly
      // at ground clearance and the ground check below would ground it
      // again at once, zeroing the pitch it just rotated with.
      f.verticalSpeed = Math.sin(f.pitch) * f.speed;
      f.y += f.verticalSpeed * dt;
    }
    if (f.throttle < 0.08) f.speed = Math.max(0, f.speed - 22 * dt); // brakes
  } else {
    let vy = Math.sin(f.pitch) * f.speed;
    if (f.speed < T.stallSpeed) {
      vy -= (T.stallSpeed - f.speed) * 0.55; // the wing sinks
      f.pitch -= (T.stallSpeed - f.speed) * 0.0016; // and the nose drops
      ev.stalled = true;
    }
    f.verticalSpeed = vy;
    f.y += vy * dt;
  }

  // Move along the nose.
  const fw = forwardVector(f);
  const step = f.speed * dt;
  f.x += fw.x * step;
  f.z += fw.z * step;

  // Fuel burn follows the throttle.
  f.fuel = Math.max(0, f.fuel - f.throttle * T.fuelBurn * dt);

  // The island is only so big: far out over open sea the pilot turns home.
  const dist = Math.hypot(f.x, f.z);
  if (dist > 2350) {
    // heading h flies (cos h, -sin h) in (x, z); home is atan2(z, -x).
    const homeHeading = Math.atan2(f.z, -f.x);
    f.heading += wrapAngle(homeHeading - f.heading) * Math.min(1, 0.5 * dt);
  }

  // Terrain contact.
  const ground = groundHeightAt(f.x, f.z);
  if (f.onGround) {
    f.y = ground + T.groundClearance; // roll along the ground
    f.pitch += (0 - f.pitch) * Math.min(1, 4 * dt);
    f.roll += (0 - f.roll) * Math.min(1, 4 * dt);
  } else if (f.y <= ground + T.groundClearance) {
    const wet = ground < 0.5; // sea or lake
    const hard = f.verticalSpeed < -11;
    const fast = f.speed > 165;
    if (wet) {
      crash(f, 'Ditched in the water');
    } else if (hard) {
      crash(f, 'Hit the ground too hard');
    } else if (fast) {
      crash(f, 'Came in far too fast');
    } else {
      f.onGround = true;
      f.y = ground + T.groundClearance;
      f.pitch = 0;
      f.roll = 0;
      ev.touchedDown = true;
      if (Math.abs(f.x) < 340 && Math.abs(f.z) < 26) ev.landedOnRunway = true;
      if (Math.abs(f.verticalSpeed) > 6) f.damage = Math.min(100, f.damage + 18);
    }
  }

  if (f.damage >= 100 && !f.crashed) crash(f, 'Too much damage — the airframe gave up');
  ev.verticalSpeed = f.verticalSpeed; // the touchdown softness, for scoring
  return ev;
}
