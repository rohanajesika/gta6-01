// Particles, muzzle flashes and camera shake. One shared pool of small
// cubes, recycled so the game never allocates mid-frame.
import * as THREE from 'three';

export function createEffects(scene) {
  const pool = [];
  for (let i = 0; i < 120; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  const flash = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0 }),
  );
  scene.add(flash);
  return { pool, flash, flashLife: 0, shake: 0 };
}

export function burst(G, x, y, z, color, count) {
  const e = G.effects;
  let placed = 0;
  for (const p of e.pool) {
    if (p.life > 0) continue;
    p.life = 0.6;
    p.mesh.visible = true;
    p.mesh.material.color.setHex(color);
    p.mesh.position.set(x, y, z);
    p.vx = (G.rng.next() - 0.5) * 8;
    p.vy = G.rng.next() * 6;
    p.vz = (G.rng.next() - 0.5) * 8;
    placed += 1;
    if (placed >= count) break;
  }
  e.shake = Math.max(e.shake, 0.25);
}

export function muzzle(G, x, y, z) {
  const e = G.effects;
  e.flash.position.set(x, y, z);
  e.flash.material.opacity = 0.9;
  e.flashLife = 0.08;
}

export function updateEffects(G, dt) {
  const e = G.effects;
  for (const p of e.pool) {
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
    p.mesh.rotation.x += dt * 6;
    p.mesh.rotation.y += dt * 6;
  }
  if (e.flashLife > 0) {
    e.flashLife -= dt;
    if (e.flashLife <= 0) e.flash.material.opacity = 0;
  }
  e.shake = Math.max(0, e.shake - dt * 1.2);
}

export function shakeOffset(G) {
  const e = G.effects;
  if (e.shake <= 0) return { x: 0, y: 0 };
  return {
    x: (G.rng.next() - 0.5) * e.shake * 0.5,
    y: (G.rng.next() - 0.5) * e.shake * 0.5,
  };
}
