// The city itself: a road grid, block buildings, sidewalks, a beach, the sea
// and Harbor Pier. Builds meshes once; exports the building colliders (AABBs)
// and the road lines the traffic AI follows.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

function box(w, h, d, color, x, y, z, parent) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground slab for the whole map, then sand and sea to the east.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, 0, 0);
  group.add(ground);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(76, 460),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 38, 0.05, 0);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 700),
    new THREE.MeshLambertMaterial({ color: PALETTE.water }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CITY.waterX + 110, 0.02, 0);
  group.add(sea);

  // Roads: dark strips with dashed centre lines, both directions.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x24282e });
  const lineMat = new THREE.MeshLambertMaterial({ color: PALETTE.roadLine });
  for (const c of CITY.roads) {
    const v = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadWidth, 460), roadMat);
    v.rotation.x = -Math.PI / 2;
    v.position.set(c, 0.08, 0);
    group.add(v);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(460, CITY.roadWidth), roadMat);
    h.rotation.x = -Math.PI / 2;
    h.position.set(0, 0.08, c);
    group.add(h);
    for (let t = -220; t <= 220; t += 16) {
      const d1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
      d1.rotation.x = -Math.PI / 2;
      d1.position.set(c, 0.12, t);
      group.add(d1);
      const d2 = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
      d2.rotation.x = -Math.PI / 2;
      d2.position.set(t, 0.12, c);
      group.add(d2);
    }
  }

  // Buildings fill every block between roads; each block gets 1-4 towers.
  const blockCentres = [-150, -90, -30, 30, 90, 150];
  for (const bx of blockCentres) {
    for (const bz of blockCentres) {
      const count = rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = rng.range(14, 26);
        const d = rng.range(14, 26);
        const h = rng.range(8, 42);
        const ox = bx + rng.range(-12, 12);
        const oz = bz + rng.range(-12, 12);
        const color = rng.pick(PALETTE.building);
        box(w, h, d, color, ox, h / 2, oz, group);
        box(w + 1, 1.2, d + 1, PALETTE.roof, ox, h + 0.6, oz, group);
        // Lit windows: a darker band near the top of each tower.
        box(w * 0.7, h * 0.28, 0.3, PALETTE.glass, ox, h * 0.68, oz + d / 2 + 0.05, group);
        box(0.3, h * 0.28, d * 0.7, PALETTE.glass, ox + w / 2 + 0.05, h * 0.68, oz, group);
        colliders.push({ x: ox, z: oz, hw: w / 2 + 0.4, hd: d / 2 + 0.4 });
      }
    }
  }

  // Marina Kiosk at the north-west corner, Danny's apartment block, the garage.
  box(10, 5, 8, 0x3d7a5c, -168, 2.5, -168, group);
  colliders.push({ x: -168, z: -168, hw: 5.4, hd: 4.4 });
  box(16, 12, 12, 0x7a5a3d, -60, 6, -132, group);
  colliders.push({ x: -60, z: -132, hw: 8.4, hd: 6.4 });
  box(18, 7, 12, 0x5a6b7a, -132, 3.5, 120, group);
  colliders.push({ x: -132, z: 120, hw: 9.4, hd: 6.4 });

  // Palm trees along the beach road and the pier road.
  for (let z = -200; z <= 200; z += 40) {
    const x = 206;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.5, 7, 6),
      new THREE.MeshLambertMaterial({ color: 0x8a6b4a }),
    );
    trunk.position.set(x, 3.5, z);
    group.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x2f9e44 }),
    );
    crown.scale.y = 0.55;
    crown.position.set(x, 7.4, z);
    group.add(crown);
  }

  // Harbor Pier: wooden deck reaching into the sea, with posts and lamps.
  for (let x = 216; x <= 276; x += 6) {
    box(6, 0.8, 14, PALETTE.pier, x, 0.6, 180, group);
    box(0.5, 3, 0.5, 0x5a4632, x - 2.5, 2, 186, group);
    box(0.5, 3, 0.5, 0x5a4632, x - 2.5, 2, 174, group);
  }
  for (let x = 224; x <= 272; x += 16) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0xaa8833 }),
    );
    lamp.position.set(x, 4.6, 174);
    group.add(lamp);
    box(0.3, 4.2, 0.3, 0x333333, x, 2.1, 174, group);
  }

  // A few crates on the pier for cover in the last mission.
  box(2.4, 2.4, 2.4, 0x9a7b4f, 250, 1.2, 176, group);
  box(2.4, 2.4, 2.4, 0x7b9a4f, 258, 1.2, 185, group);
  box(2, 2, 2, 0x9a7b4f, 244, 1, 184, group);
  colliders.push({ x: 250, z: 176, hw: 1.6, hd: 1.6 });
  colliders.push({ x: 258, z: 185, hw: 1.6, hd: 1.6 });

  return { colliders, group };
}

// Keep a circle (player or car) out of building AABBs; returns true on a hit.
export function collideCircle(colliders, x, z, radius) {
  for (const c of colliders) {
    const dx = Math.max(Math.abs(x - c.x) - c.hw, 0);
    const dz = Math.max(Math.abs(z - c.z) - c.hd, 0);
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

export function clampToCity(x, z) {
  return {
    x: Math.max(-CITY.half, Math.min(CITY.waterX - 6, x)),
    z: Math.max(-CITY.half, Math.min(CITY.half, z)),
  };
}
