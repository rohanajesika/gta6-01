// Keyboard + mouse input with pointer lock for camera look.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.rightDown = false;
    this.locked = false;
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) this.rightDown = true;
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.rightDown = false;
    };
    this._onLockChange = () => { this.locked = document.pointerLockElement === canvas; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; this.rightDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('pointerlockchange', this._onLockChange);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  pressed(code) {
    if (this.keys.has(code)) { this.keys.delete(code); return true; }
    return false;
  }
  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }
  requestLock() {
    if (!this.locked && this.canvas.requestPointerLock) {
      try {
        // Newer browsers return a promise that rejects when lock is denied
        // (no gesture, headless); swallow it so the console stays clean.
        const r = this.canvas.requestPointerLock();
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch { /* headless or denied */ }
    }
  }
  releaseLock() {
    if (document.pointerLockElement) {
      try {
        const r = document.exitPointerLock();
        if (r && typeof r.catch === 'function') r.catch(() => {});
      } catch { /* ignore */ }
    }
  }
  axis() {
    // WASD / arrows as -1..1 axes (x = strafe/right, y = forward)
    let x = 0, y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    return { x, y };
  }
}
