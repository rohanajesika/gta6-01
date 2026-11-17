// The HUD: cash, health, ammo, wanted stars, speed, the current objective,
// a message feed, a damage flash, and a live minimap drawn on a 2D canvas.
import { CITY, PALETTE } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const hud = {
    cash: el('hud-cash'),
    healthFill: el('hud-health-fill'),
    healthText: el('hud-health-text'),
    ammo: el('hud-ammo'),
    stars: el('hud-stars'),
    speed: el('hud-speed'),
    objective: el('hud-objective'),
    message: el('hud-message'),
    minimap: el('minimap'),
    flash: el('damage-flash'),
    mapCtx: el('minimap').getContext('2d'),
    messageTimer: 0,
    lastMessage: '',
  };
  return hud;
}

export function say(G, text) {
  const h = G.hud;
  h.message.textContent = text;
  h.message.classList.remove('hidden');
  h.messageTimer = 4;
  h.lastMessage = text;
  const status = document.getElementById('status');
  if (status) status.textContent = text;
}

export function setObjective(G, text) {
  G.hud.objective.textContent = text;
}

export function flashDamage(G) {
  const h = G.hud;
  h.flash.classList.remove('hidden');
  window.setTimeout(() => h.flash.classList.add('hidden'), 180);
}

function drawMinimap(G) {
  const h = G.hud;
  const ctx = h.mapCtx;
  const S = 180;
  const scale = S / (CITY.half * 2 + 120);
  const toMap = (x, z) => [(x + CITY.half + 60) * scale, (z + CITY.half + 60) * scale];
  ctx.fillStyle = '#10151c';
  ctx.fillRect(0, 0, S, S);
  // Sea and sand on the east edge.
  const [bx] = toMap(CITY.beachX, 0);
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(bx, 0, S - bx, S);
  const [wx] = toMap(CITY.waterX, 0);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(wx, 0, S - wx, S);
  // Roads.
  ctx.strokeStyle = '#5a636e';
  ctx.lineWidth = 3;
  for (const c of CITY.roads) {
    const [x1, y1] = toMap(c, -CITY.half - 60);
    const [x2, y2] = toMap(c, CITY.half + 60);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const [hx1, hy1] = toMap(-CITY.half - 60, c);
    const [hx2, hy2] = toMap(CITY.half + 60, c);
    ctx.beginPath(); ctx.moveTo(hx1, hy1); ctx.lineTo(hx2, hy2); ctx.stroke();
  }
  // Mission marker.
  if (G.missions.marker) {
    const [mx, my] = toMap(G.missions.marker.x, G.missions.marker.z);
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Police cars.
  ctx.fillStyle = '#3b82f6';
  for (const car of G.police.cars) {
    const [cx, cy] = toMap(car.x, car.z);
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Traffic.
  ctx.fillStyle = '#d7dde3';
  for (const car of G.traffic.cars) {
    if (car.removed || car.parked) continue;
    const [cx, cy] = toMap(car.x, car.z);
    ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
  }
  // Player arrow, rotated to the heading.
  const [px, py] = toMap(G.player.x, G.player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(Math.sin(G.player.heading), Math.cos(G.player.heading)));
  ctx.fillStyle = '#ff5a3c';
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function updateHud(G, dt) {
  const h = G.hud;
  const p = G.player;
  h.cash.textContent = `$${p.cash}`;
  const hp = Math.max(0, Math.round(p.health));
  h.healthFill.style.width = `${hp}%`;
  h.healthFill.style.background = hp > 50 ? '#37c978' : hp > 25 ? '#f5a623' : '#e5534b';
  h.healthText.textContent = `${hp}`;
  h.ammo.textContent = p.inCar ? '—' : `${p.ammo} / ${p.reserveAmmo}`;
  const filled = '★'.repeat(G.police.wanted);
  const empty = '☆'.repeat(5 - G.police.wanted);
  h.stars.textContent = filled + empty;
  h.stars.style.color = G.police.wanted > 0 ? PALETTE.star : '#5a636e';
  h.speed.textContent = p.inCar && p.car ? `${Math.round(Math.abs(p.car.speed) * 3.6)} km/h` : '';
  if (h.messageTimer > 0) {
    h.messageTimer -= dt;
    if (h.messageTimer <= 0) h.message.classList.add('hidden');
  }
  drawMinimap(G);
}
