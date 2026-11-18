// Effects. One job: particles, muzzle flashes and screen shake — the
// juice that makes hits, crashes and shots feel like something happened.
import * as THREE from 'three';

export function createEffects(G) {
  const MAX = 240;
  const geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pool = [];
  for (let i = 0; i < MAX; i++) {
    const m = new THREE.Mesh(geo, mat.clone());
    m.visible = false;
    G.scene.add(m);
    pool.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0 });
  }
  let cursor = 0;
  let shakeAmount = 0;

  function burst(x, y, z, color, n) {
    for (let i = 0; i < n; i++) {
      const p = pool[cursor];
      cursor = (cursor + 1) % MAX;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.material.color.setHex(color);
      const a = G.rng.range(0, Math.PI * 2);
      const sp = G.rng.range(2, 7);
      p.vx = Math.cos(a) * sp;
      p.vz = Math.sin(a) * sp;
      p.vy = G.rng.range(1, 5);
      p.life = G.rng.range(0.35, 0.8);
    }
  }

  function muzzle(pos, heading) {
    burst(pos.x, pos.y, pos.z, 0xffe9a8, 6);
    shake(0.12);
  }

  function shake(amount) {
    shakeAmount = Math.max(shakeAmount, amount);
  }

  function update(dt) {
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= 12 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.1) p.mesh.position.y = 0.1;
    }
    shakeAmount = Math.max(0, shakeAmount - dt * 1.4);
  }

  // Per-frame camera offset while the screen shakes.
  function shakeOffset() {
    if (shakeAmount <= 0) return { x: 0, y: 0 };
    const s = shakeAmount * 0.35;
    return {
      x: (G.rng.next() - 0.5) * s,
      y: (G.rng.next() - 0.5) * s,
    };
  }

  return { burst, muzzle, shake, update, shakeOffset };
}
