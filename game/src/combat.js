// Combat: the pistol (F, hitscan with a tracer), the punch (left click),
// and the pier guards of the last mission. Guards shoot back when close.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { damagePlayer } from './player.js';

export function createCombat(scene) {
  return {
    scene,
    shotRecently: 0,
    guards: [],
    tracers: [],
  };
}

function guardMesh() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.75, 4, 8), new THREE.MeshLambertMaterial({ color: 0x222831 }));
  body.position.y = 1.15;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
  head.position.y = 2.05;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.55), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  cap.position.y = 2.28;
  group.add(cap);
  return group;
}

export function spawnGuards(G, positions) {
  const combat = G.combat;
  for (const [x, z] of positions) {
    const mesh = guardMesh();
    mesh.position.set(x, 0, z);
    G.scene.add(mesh);
    combat.guards.push({ mesh, x, z, health: 60, shootTimer: 2, alive: true });
  }
}

export function guardsLeft(G) {
  return G.combat.guards.filter((g) => g.alive).length;
}

function fireTracer(G, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }));
  G.scene.add(line);
  G.combat.tracers.push({ line, life: 0.12 });
}

export function shoot(G) {
  const p = G.player;
  if (p.inCar || p.shootCooldown > 0) return;
  if (p.ammo <= 0) {
    G.hud.say('Out of ammo — press R to reload.');
    G.audio.click();
    p.shootCooldown = 0.3;
    return;
  }
  p.ammo -= 1;
  p.shootCooldown = 0.35;
  G.combat.shotRecently = 1.5;
  G.audio.gunshot();
  const from = new THREE.Vector3(p.x, 1.5, p.z);
  const dir = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
  const end = from.clone().add(dir.clone().multiplyScalar(60));
  // Hit the nearest guard or pedestrian roughly in the line of fire.
  let hit = null;
  let hitD = 60;
  const targets = [
    ...G.combat.guards.filter((g) => g.alive).map((g) => ({ x: g.x, z: g.z, ref: g, kind: 'guard' })),
    ...G.peds.peds.filter((pd) => pd.alive).map((pd) => ({ x: pd.x, z: pd.z, ref: pd, kind: 'ped' })),
  ];
  for (const t of targets) {
    const rx = t.x - p.x;
    const rz = t.z - p.z;
    const along = rx * dir.x + rz * dir.z;
    if (along < 0 || along > 60) continue;
    const side = Math.abs(rx * dir.z - rz * dir.x);
    if (side < 1.2 && along < hitD) { hitD = along; hit = t; }
  }
  if (hit) {
    end.copy(from).add(dir.clone().multiplyScalar(hitD));
    if (hit.kind === 'guard') {
      hit.ref.health -= PLAYER.bulletDamage;
      G.effects.burst(hit.ref.x, 1.4, hit.ref.z, 0xff2222, 10);
      if (hit.ref.health <= 0) {
        hit.ref.alive = false;
        hit.ref.mesh.visible = false;
        G.hud.say('Guard down.');
        G.player.cash += 50;
      }
    } else {
      hit.ref.alive = false;
      hit.ref.mesh.visible = false;
      G.police.addWanted(1, 'You shot a pedestrian!');
      G.hud.say('You shot a pedestrian! Wanted level up.');
    }
  }
  fireTracer(G, from, end);
  G.effects.muzzle(p.x + dir.x, 1.5, p.z + dir.z);
}

export function punch(G) {
  const p = G.player;
  if (p.inCar || p.punchCooldown > 0) return;
  p.punchCooldown = 0.45;
  G.audio.punch();
  const dir = new THREE.Vector3(Math.sin(p.heading), 0, Math.cos(p.heading));
  for (const g of G.combat.guards) {
    if (!g.alive) continue;
    const d = Math.hypot(g.x - p.x, g.z - p.z);
    if (d < PLAYER.punchRange) {
      g.health -= PLAYER.punchDamage;
      G.effects.burst(g.x, 1.4, g.z, 0xffdd55, 8);
      if (g.health <= 0) {
        g.alive = false;
        g.mesh.visible = false;
        G.hud.say('Guard down.');
        G.player.cash += 50;
      }
    }
  }
  for (const pd of G.peds.peds) {
    if (!pd.alive) continue;
    const d = Math.hypot(pd.x - p.x, pd.z - p.z);
    if (d < PLAYER.punchRange) {
      pd.alive = false;
      pd.mesh.visible = false;
      G.police.addWanted(1, 'You attacked a pedestrian!');
    }
  }
}

export function reload(G) {
  const p = G.player;
  if (p.ammo >= 24 || p.reserveAmmo <= 0) return;
  const need = 24 - p.ammo;
  const take = Math.min(need, p.reserveAmmo);
  p.ammo += take;
  p.reserveAmmo -= take;
  G.audio.click();
  G.hud.say(`Reloaded. ${p.ammo} in the magazine.`);
}

export function updateCombat(G, dt) {
  const c = G.combat;
  c.shotRecently = Math.max(0, c.shotRecently - dt);
  for (const t of [...c.tracers]) {
    t.life -= dt;
    if (t.life <= 0) {
      G.scene.remove(t.line);
      c.tracers.splice(c.tracers.indexOf(t), 1);
    }
  }
  // Guards stand their ground on the pier and fire when the player is near.
  for (const g of c.guards) {
    if (!g.alive) continue;
    const d = Math.hypot(g.x - G.player.x, g.z - G.player.z);
    g.mesh.rotation.y = Math.atan2(G.player.x - g.x, G.player.z - g.z);
    if (d < 26) {
      g.shootTimer -= dt;
      if (g.shootTimer <= 0) {
        g.shootTimer = 1.6 + G.rng.next();
        fireTracer(G, new THREE.Vector3(g.x, 1.5, g.z), new THREE.Vector3(G.player.x, 1.2, G.player.z));
        G.audio.gunshot();
        if (d < 20 && G.rng.next() < 0.55) damagePlayer(G, 8, 'wasted');
      }
    }
  }
}
