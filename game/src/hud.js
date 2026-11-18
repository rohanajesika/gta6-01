// HUD. One job: everything drawn over the 3D view — cash, health, wanted
// stars, mission objective, speed, ammo, toasts, the damage flash, and the
// live minimap of Solmar Bay.
import { CONFIG } from './config.js';

export function createHud(G) {
  const el = (id) => document.getElementById(id);
  const cashEl = el('cash');
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const starsEl = el('stars');
  const objectiveEl = el('objective-text');
  const speedEl = el('speed');
  const ammoEl = el('ammo');
  const toastEl = el('toast');
  const hintEl = el('hint');
  const vignette = el('damage-vignette');
  const minimap = el('minimap');
  const mm = minimap.getContext('2d');

  let toastTimer = 0;
  let vignetteTimer = 0;

  function toast(text, seconds = 4) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    toastTimer = seconds;
  }

  function flashDamage() {
    vignette.classList.remove('hidden');
    vignetteTimer = 0.5;
  }

  function drawMinimap() {
    const W = minimap.width;
    const H = minimap.height;
    const scale = W / (CONFIG.worldHalf * 2 + 120);
    const toX = (x) => (x + CONFIG.worldHalf + 60) * scale;
    const toY = (z) => (z + CONFIG.worldHalf + 60) * scale;
    mm.clearRect(0, 0, W, H);
    // Water west, sand, city slab.
    mm.fillStyle = '#2a7ab8';
    mm.fillRect(0, 0, toX(-252), H);
    mm.fillStyle = '#e8d8a8';
    mm.fillRect(toX(-252), 0, toX(-200) - toX(-252), H);
    mm.fillStyle = '#6a6f66';
    mm.fillRect(toX(-200), 0, W - toX(-200), H);
    // Roads.
    mm.strokeStyle = '#3a3f46';
    mm.lineWidth = Math.max(2, CONFIG.roadWidth * scale);
    for (const r of CONFIG.roads) {
      mm.beginPath();
      mm.moveTo(toX(r), 0);
      mm.lineTo(toX(r), H);
      mm.stroke();
      mm.beginPath();
      mm.moveTo(0, toY(r));
      mm.lineTo(W, toY(r));
      mm.stroke();
    }
    // Mission objective blip.
    const obj = G.missions.objectivePos();
    if (obj) {
      const pulse = 3 + Math.sin(G.time * 5) * 1.5;
      mm.fillStyle = '#ffd23e';
      mm.beginPath();
      mm.arc(toX(obj.x), toY(obj.z), pulse + 2, 0, Math.PI * 2);
      mm.fill();
    }
    // Police cars, red.
    mm.fillStyle = '#ff3b30';
    for (const car of G.police.cars) {
      mm.beginPath();
      mm.arc(toX(car.x), toY(car.z), 3, 0, Math.PI * 2);
      mm.fill();
    }
    // Traffic, dim white dots.
    mm.fillStyle = 'rgba(255,255,255,0.55)';
    for (const car of G.traffic.cars) {
      if (car.parked) continue;
      mm.fillRect(toX(car.x) - 1, toY(car.z) - 1, 2, 2);
    }
    // The player: a white arrow pointing where Rook faces.
    const px = toX(G.player.x);
    const py = toY(G.player.z);
    mm.save();
    mm.translate(px, py);
    mm.rotate(Math.PI - G.player.heading);
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(0, -6);
    mm.lineTo(4, 5);
    mm.lineTo(-4, 5);
    mm.closePath();
    mm.fill();
    mm.restore();
  }

  function update(dt) {
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.classList.add('hidden');
    }
    if (vignetteTimer > 0) {
      vignetteTimer -= dt;
      if (vignetteTimer <= 0) vignette.classList.add('hidden');
    }

    cashEl.textContent = `$${G.player.cash.toLocaleString('en-US')}`;
    const hp = Math.max(0, Math.round(G.player.health));
    healthFill.style.width = `${hp}%`;
    healthFill.style.background = hp > 50 ? '#4ad87b' : hp > 25 ? '#e8c832' : '#d84a4a';
    healthText.textContent = `${hp}`;
    const wanted = G.police.wanted;
    starsEl.textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
    starsEl.style.color = wanted > 0 ? '#ffd23e' : 'rgba(255,255,255,0.35)';
    objectiveEl.textContent = G.missions.objectiveText();
    ammoEl.textContent = `Ammo ${G.player.ammo}`;
    if (G.player.inCar && G.player.car) {
      const kmh = Math.abs(G.player.car.speed) * 3.6;
      speedEl.textContent = `${Math.round(kmh)} km/h`;
      speedEl.classList.remove('hidden');
      hintEl.textContent = 'W/S drive · A/D steer · E exit car · Space handbrake';
    } else {
      speedEl.classList.add('hidden');
      hintEl.textContent = 'WASD move · Shift run · Space jump · E enter car · F shoot · P pause · M mute';
    }
    drawMinimap();
  }

  return { toast, flashDamage, update };
}
