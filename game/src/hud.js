// HUD, minimap and menus: every pixel of interface the player sees,
// drawn from the shared state — never from a second source of truth.
import { CFG } from './config.js';

const MINIMAP_SIZE = 190;

// Build the minimap's static road layer once; blips are drawn per frame.
function drawMinimapBase(ctx, size) {
  ctx.fillStyle = '#20262b';
  ctx.fillRect(0, 0, size, size);
  const half = CFG.CITY_HALF;
  const toMap = (v) => ((v + half) / (half * 2)) * size;
  ctx.fillStyle = '#3a3f46';
  for (let i = 0; i < CFG.ROAD_COUNT; i++) {
    const c = -((CFG.ROAD_COUNT - 1) / 2) * CFG.BLOCK + i * CFG.BLOCK;
    const w = (CFG.ROAD / (half * 2)) * size;
    ctx.fillRect(0, toMap(c) - w / 2, size, w);
    ctx.fillRect(toMap(c) - w / 2, 0, w, size);
  }
  ctx.fillStyle = '#1e7f9e';
  ctx.fillRect(0, toMap(CFG.SEA_Z) - 4, size, size - toMap(CFG.SEA_Z) + 4);
  ctx.fillStyle = '#f2e2b8';
  ctx.fillRect(0, toMap(CFG.SEA_Z - 16), size, 6);
}

// The live minimap: roads, sea, mission marker, police, cars and the
// player arrow, all in the same orientation as the world.
export function drawMinimap(canvas, state, player, policeCars, trafficCars, markerPos) {
  const ctx = canvas.getContext('2d');
  const size = MINIMAP_SIZE;
  if (canvas.width !== size) {
    canvas.width = size;
    canvas.height = size;
  }
  drawMinimapBase(ctx, size);
  const half = CFG.CITY_HALF;
  const toMap = (v) => ((v + half) / (half * 2)) * size;

  if (markerPos) {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath();
    ctx.arc(toMap(markerPos.x), toMap(markerPos.z), 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.fillStyle = '#ff4444';
  for (const car of policeCars) {
    ctx.beginPath();
    ctx.arc(toMap(car.x), toMap(car.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#e8e8e8';
  for (const car of trafficCars) {
    if (car.isTraffic) ctx.fillRect(toMap(car.x) - 2, toMap(car.z) - 2, 4, 4);
  }
  // Player arrow, rotated to the facing angle.
  ctx.save();
  ctx.translate(toMap(player.x), toMap(player.z));
  ctx.rotate(Math.atan2(Math.sin(player.angle), Math.cos(player.angle)) * 0 + player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Update every HUD readout from the state object.
export function updateHud(state, els) {
  els.cash.textContent = `$${state.cash.toLocaleString('en-US')}`;
  els.healthFill.style.width = `${Math.max(0, state.health)}%`;
  els.healthFill.style.background = state.health > 50 ? '#2ecc71' : state.health > 25 ? '#f39c12' : '#e74c3c';
  els.ammo.textContent = state.driving ? '—' : `${state.ammo}`;
  els.mission.textContent = state.missionLabel;
  els.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(CFG.WANTED_MAX - state.wanted);
  els.stars.style.color = state.wanted > 0 ? '#ffd23a' : '#888888';
  els.speed.textContent = state.driving ? `${Math.round(state.speedKmh)} km/h` : '';
  els.speedLabel.style.display = state.driving ? 'block' : 'none';
  if (state.messageTimer > 0) {
    els.toast.textContent = state.message;
    els.toast.style.opacity = '1';
  } else {
    els.toast.style.opacity = '0';
  }
  els.hint.textContent = state.driving
    ? 'W/S drive · A/D steer · E exit car · Space handbrake'
    : 'WASD move · Shift run · E enter car · Click shoot · F punch · M mission · P pause';
}

export function showScreen(els, which) {
  for (const key of ['start', 'pause', 'over']) {
    els[key].style.display = key === which ? 'flex' : 'none';
  }
}

export function setOverText(els, title, detail) {
  els.overTitle.textContent = title;
  els.overDetail.textContent = detail;
}

// Wire the start / resume / restart buttons to the callbacks the main
// loop supplies. Buttons are real DOM buttons, so keyboard and mouse
// both work and the game needs no click handler on the canvas.
export function bindMenus(els, callbacks) {
  els.startBtn.addEventListener('click', callbacks.onStart);
  els.resumeBtn.addEventListener('click', callbacks.onResume);
  els.restartBtn.addEventListener('click', callbacks.onRestart);
  els.saveBtn.addEventListener('click', callbacks.onSave);
}
