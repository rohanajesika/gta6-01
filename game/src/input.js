// Keyboard + mouse input. One job: turn raw DOM events into a stable,
// queryable state (held keys, edge-triggered presses, camera drag).

export function createInput(canvas) {
  const keys = new Set();
  const pressedQueue = new Set();
  const drag = { active: false, dx: 0, dy: 0, lastX: 0, lastY: 0 };
  let locked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressedQueue.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseDown(e) {
    if (e.target !== canvas) return;
    drag.active = true;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    // Pointer lock gives smooth mouse-look; the drag fallback covers
    // browsers and headless runs where lock is unavailable.
    if (canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch {
        /* pointer lock unavailable — drag still works */
      }
    }
  }
  function onMouseUp() {
    drag.active = false;
  }
  function onMouseMove(e) {
    if (document.pointerLockElement === canvas) {
      drag.dx += e.movementX;
      drag.dy += e.movementY;
      return;
    }
    if (!drag.active) return;
    drag.dx += e.clientX - drag.lastX;
    drag.dy += e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
  }
  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }
  function onBlur() {
    keys.clear();
    drag.active = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLockChange);

  return {
    keys,
    // Held this frame?
    held(code) {
      return keys.has(code);
    },
    // Pressed since the last frame (edge-triggered)? Consumed on read.
    pressed(code) {
      if (!pressedQueue.has(code)) return false;
      pressedQueue.delete(code);
      return true;
    },
    // Camera orbit delta accumulated since last frame, in pixels.
    takeDrag() {
      const out = { dx: drag.dx, dy: drag.dy };
      drag.dx = 0;
      drag.dy = 0;
      return out;
    },
    get pointerLocked() {
      return locked;
    },
    // Movement intent in camera space: x = strafe right, y = forward.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, y };
    },
    // Drain the press queue at the end of a frame so a press is never
    // acted on twice.
    endFrame() {
      pressedQueue.clear();
    },
  };
}
