// Keyboard + mouse state, read fresh every frame. Actions are edge-triggered
// (takeActions returns each press once); movement keys are held state.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_PUNCH = 16;
export const ACTION_RELOAD = 32;
export const ACTION_MUTE = 64;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let dragX = 0;
  let dragging = false;
  let lastX = 0;

  function press(code) {
    if (code === 'Space' || code === 'Enter') actions |= ACTION_CONFIRM;
    if (code === 'KeyP' || code === 'Escape') actions |= ACTION_PAUSE;
    if (code === 'KeyE') actions |= ACTION_ENTER;
    if (code === 'KeyF') actions |= ACTION_SHOOT;
    if (code === 'KeyR') actions |= ACTION_RELOAD;
    if (code === 'KeyM') actions |= ACTION_MUTE;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    press(event.code);
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (event) => {
    dragging = true;
    lastX = event.clientX;
    if (event.button === 0) actions |= ACTION_PUNCH;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    dragX += event.clientX - lastX;
    lastX = event.clientX;
  });

  return {
    held(code) { return keys.has(code); },
    axis() {
      // -1..1 for forward and strafe, from WASD or arrows.
      const fwd = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const strafe = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { fwd, strafe };
    },
    running() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    handbrake() { return keys.has('Space'); },
    takeLook() {
      const d = dragX;
      dragX = 0;
      return d;
    },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
  };
}
