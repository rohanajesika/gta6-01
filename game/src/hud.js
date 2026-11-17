// HUD: cash, health, wanted stars, speed, objective, toasts, and the minimap.
import { STREETS, WORLD } from './config.js';

export class Hud {
  constructor() {
    this.el = {
      cash: document.getElementById('hud-cash'),
      health: document.getElementById('hud-health'),
      healthBar: document.getElementById('hud-health-bar'),
      stars: document.getElementById('hud-stars'),
      ammo: document.getElementById('hud-ammo'),
      speed: document.getElementById('hud-speed'),
      objective: document.getElementById('hud-objective'),
      mission: document.getElementById('hud-mission'),
      toast: document.getElementById('hud-toast'),
      hint: document.getElementById('hud-hint'),
      minimap: document.getElementById('minimap'),
      busted: document.getElementById('busted'),
      wasted: document.getElementById('wasted'),
      story: document.getElementById('story-done'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
    this.toastTimer = 0;
    this.toastQueue = [];
    this.el.toast.style.display = 'none';
  }

  toast(text, seconds = 3.5) {
    this.toastQueue.push({ text, seconds });
    if (this.toastQueue.length === 1) this._showToast();
  }

  _showToast() {
    const t = this.toastQueue[0];
    if (!t) { this.el.toast.textContent = ''; this.el.toast.style.display = 'none'; return; }
    this.el.toast.textContent = t.text;
    this.el.toast.style.display = '';
    this.toastTimer = t.seconds;
  }

  update(dt, G) {
    const p = G.player;
    this.el.cash.textContent = `$${p.cash}`;
    this.el.health.textContent = `${Math.max(0, Math.ceil(p.health))}`;
    this.el.healthBar.style.width = `${Math.max(0, p.health)}%`;
    this.el.healthBar.style.background = p.health > 50 ? '#2ecc71' : p.health > 25 ? '#f39c12' : '#e74c3c';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < G.police.wanted ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = G.police.wanted > 0 ? '#ffd23e' : '#ffffff88';
    this.el.ammo.textContent = p.inCar ? '—' : `🔫 ${p.ammo}`;
    const kmh = p.inCar ? Math.abs(Math.round(p.car.speed * 3.6)) : Math.round(p.moveSpeed * 3.6);
    this.el.speed.textContent = p.inCar ? `${kmh} km/h` : '';
    const m = G.missions.current();
    this.el.mission.textContent = m ? m.title : (G.missions.done ? 'Story Complete' : '');
    this.el.objective.textContent = G.missions.objectiveText();
    this.el.hint.textContent = p.inCar
      ? 'WASD drive · Space brake · E exit · P pause'
      : 'WASD move · Shift run · E steal car · Click punch · F shoot · P pause';
    if (this.toastQueue.length) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) {
        this.toastQueue.shift();
        this._showToast();
      }
    }
    this._drawMinimap(G);
  }

  _drawMinimap(G) {
    const c = this.mapCtx;
    const S = 168;
    const scale = S / (WORLD.half * 2 + 40);
    const toMap = (x, z) => [(x + WORLD.half + 20) * scale, (z + WORLD.half + 20) * scale];
    c.clearRect(0, 0, S, S);
    c.fillStyle = 'rgba(10, 22, 34, 0.85)';
    c.fillRect(0, 0, S, S);
    // Beach + ocean.
    const [bx0] = toMap(-WORLD.half - 20, 0);
    const [, byBeach] = toMap(0, WORLD.beachZ);
    c.fillStyle = '#c9a86a';
    c.fillRect(bx0, byBeach, S, S - byBeach);
    c.fillStyle = '#1e6f8e';
    const [, byOcean] = toMap(0, WORLD.oceanZ);
    c.fillRect(bx0, byOcean, S, S - byOcean);
    // Roads.
    c.strokeStyle = '#5a6068';
    c.lineWidth = 5;
    for (const s of STREETS) {
      const [vx, vy0] = toMap(s, -WORLD.half - 20);
      const [, vy1] = toMap(s, WORLD.half + 20);
      c.beginPath(); c.moveTo(vx, vy0); c.lineTo(vx, vy1); c.stroke();
      const [hx0, hy] = toMap(-WORLD.half - 20, s);
      const [hx1] = toMap(WORLD.half + 20, s);
      c.beginPath(); c.moveTo(hx0, hy); c.lineTo(hx1, hy); c.stroke();
    }
    // Mission marker.
    const mp = G.missions.markerPos();
    if (mp) {
      const [mx, my] = toMap(mp[0], mp[1]);
      c.fillStyle = '#ffd23e';
      c.beginPath(); c.arc(mx, my, 5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#000'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(mx, my, 5, 0, Math.PI * 2); c.stroke();
    }
    // Traffic + parked cars (white dots), police (blue/red), player (arrow).
    const dot = (x, z, color, r = 2) => {
      const [dx, dy] = toMap(x, z);
      c.fillStyle = color;
      c.beginPath(); c.arc(dx, dy, r, 0, Math.PI * 2); c.fill();
    };
    for (const car of G.traffic.cars) if (!car.isPolice) dot(car.x, car.z, '#dddddd');
    for (const car of G.police.cars) dot(car.x, car.z, '#3a86ff', 2.6);
    for (const ped of G.traffic.peds) if (ped.health > 0) dot(ped.x, ped.z, '#9fb4c8', 1.2);
    const [px, py] = toMap(G.player.x, G.player.z);
    c.save();
    c.translate(px, py);
    c.rotate(Math.atan2(Math.sin(G.player.yaw), Math.cos(G.player.yaw)) * -1 + Math.PI);
    c.fillStyle = '#2ecc71';
    c.beginPath(); c.moveTo(0, -6); c.lineTo(4.5, 5); c.lineTo(-4.5, 5); c.closePath(); c.fill();
    c.restore();
    // North tick.
    c.fillStyle = '#ffffff';
    c.font = 'bold 11px sans-serif';
    c.fillText('N', 6, 13);
  }

  showOverlay(id) {
    for (const k of ['busted', 'wasted', 'story']) this.el[k].classList.add('hidden');
    if (id) this.el[id].classList.remove('hidden');
  }
}
