// input.js — keyboard state. W/S work the throttle, arrows pitch and roll,
// A/D work the rudder, Space is the action key (edge-triggered), R restarts,
// P pauses, M mutes. Arrow keys and Space never scroll the page.
export function createInput() {
  const keys = new Set();
  const pressed = new Set();

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
    const k = e.key.toLowerCase();
    if (!e.repeat) pressed.add(k);
    keys.add(k);
  }
  function onKeyUp(e) {
    keys.delete(e.key.toLowerCase());
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Edge-triggered: true once per physical press.
  function takePressed(key) {
    if (pressed.has(key)) {
      pressed.delete(key);
      return true;
    }
    return false;
  }

  return {
    read() {
      return {
        pitch: (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0),
        roll: (keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0),
        rudder: (keys.has('a') ? 1 : 0) - (keys.has('d') ? 1 : 0),
        throttleUp: keys.has('w'),
        throttleDown: keys.has('s'),
      };
    },
    actionPressed() {
      return takePressed(' ');
    },
    restartPressed() {
      return takePressed('r');
    },
    pausePressed() {
      return takePressed('p');
    },
    mutePressed() {
      return takePressed('m');
    },
    // Clear the edge queue (used when a new screen opens).
    flush() {
      pressed.clear();
    },
  };
}
