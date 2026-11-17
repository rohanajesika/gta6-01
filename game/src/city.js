// Solmar Bay city: grid streets, instanced buildings, beach, palms, lamps, pier.
import * as THREE from 'three';
import { WORLD, STREETS, PALETTE } from './config.js';

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 18) {
    for (let x = 8; x < 120; x += 16) {
      const lit = rng.chance(0.28);
      g.fillStyle = lit ? '#ffd97a' : (rng.chance(0.5) ? '#2c3e50' : '#5d7a94');
      g.fillRect(x, y, 10, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const H = WORLD.half;

  // Ground: asphalt base, then grass park, sand beach, ocean.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(H * 2 + 60, H * 2 + 60),
    new THREE.MeshLambertMaterial({ color: PALETTE.asphalt }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  group.add(ground);

  // Central park: four grass quadrants around the crossing streets (never over a road).
  const parkMat = new THREE.MeshLambertMaterial({ color: PALETTE.grass });
  for (const [qx, qz] of [[-15, -15], [15, -15], [-15, 15], [15, 15]]) {
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), parkMat);
    quad.rotation.x = -Math.PI / 2;
    quad.position.set(qx, 0.02, qz);
    group.add(quad);
  }

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(H * 2 + 60, 34),
    new THREE.MeshLambertMaterial({ color: PALETTE.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.03, WORLD.beachZ + 17);
  group.add(sand);

  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(H * 2 + 60, 160),
    new THREE.MeshLambertMaterial({ color: PALETTE.ocean }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, 0.02, WORLD.oceanZ + 80);
  group.add(ocean);

  // Sidewalk slabs: one instanced box per block.
  const blockCenters = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      blockCenters.push([-210 + i * 60, -210 + j * 60]);
    }
  }
  const slabGeo = new THREE.BoxGeometry(46, 0.3, 46);
  const slabMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const slabs = new THREE.InstancedMesh(slabGeo, slabMat, blockCenters.length);
  const m4 = new THREE.Matrix4();
  blockCenters.forEach(([bx, bz], i) => {
    m4.makeTranslation(bx, 0.15, bz);
    slabs.setMatrixAt(i, m4);
  });
  slabs.instanceMatrix.needsUpdate = true;
  group.add(slabs);

  // Buildings: instanced boxes with a window texture, tinted per instance.
  const spots = [];
  for (const [bx, bz] of blockCenters) {
    if (bx === 0 && bz === 0) continue;          // central park
    if (bz === 210) continue;                    // beach promenade row
    const n = rng.int(1, 3);
    for (let k = 0; k < n; k++) {
      const w = rng.range(10, 18);
      const d = rng.range(10, 18);
      const h = rng.range(9, 42) * (Math.abs(bx) < 70 && Math.abs(bz) < 70 ? 1.6 : 1);
      const ox = n === 1 ? 0 : rng.range(-9, 9);
      const oz = n === 1 ? 0 : rng.range(-9, 9);
      const x = bx + ox;
      const z = bz + oz;
      spots.push({ x, z, w, d, h });
      colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
  }
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMat = new THREE.MeshLambertMaterial({ map: windowTexture(rng) });
  const buildings = new THREE.InstancedMesh(bGeo, bMat, spots.length);
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    m4.makeScale(s.w, s.h, s.d);
    m4.setPosition(s.x, 0.3, s.z);
    buildings.setMatrixAt(i, m4);
    col.setHex(rng.pick(PALETTE.building));
    buildings.setColorAt(i, col);
  });
  buildings.instanceMatrix.needsUpdate = true;
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
  group.add(buildings);

  // Centre-line dashes along every street.
  const dashGeo = new THREE.PlaneGeometry(3, 0.5);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5f0dc });
  const dashCount = STREETS.length * 2 * 27; // t = -234..234 step 18 -> 27 stops
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  let di = 0;
  for (const s of STREETS) {
    for (let t = -234; t <= 234; t += 18) {
      m4.makeRotationX(-Math.PI / 2);
      m4.setPosition(t, 0.06, s);
      dashes.setMatrixAt(di++, m4);
      m4.makeRotationX(-Math.PI / 2);
      m4.multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
      m4.setPosition(s, 0.06, t);
      dashes.setMatrixAt(di++, m4);
    }
  }
  dashes.count = di;
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  // Palm trees along the beach promenade and the park.
  const palmSpots = [];
  for (let x = -230; x <= 230; x += 24) palmSpots.push([x + rng.range(-4, 4), 216]);
  palmSpots.push([18, -18], [-18, 18], [18, 18]); // park quadrants (fountain takes the fourth)
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b48 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const topGeo = new THREE.IcosahedronGeometry(2.6, 0);
  topGeo.scale(1, 0.45, 1);
  const topMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  const tops = new THREE.InstancedMesh(topGeo, topMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0.3, z);
    trunks.setMatrixAt(i, m4);
    m4.makeTranslation(x, 7.4, z);
    tops.setMatrixAt(i, m4);
  });
  trunks.instanceMatrix.needsUpdate = true;
  tops.instanceMatrix.needsUpdate = true;
  group.add(trunks, tops);

  // Street lamps along the avenues.
  const lampSpots = [];
  for (const s of STREETS) {
    for (let t = -210; t <= 210; t += 60) {
      lampSpots.push([s + 8.5, t]);
      lampSpots.push([t, s + 8.5]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
  poleGeo.translate(0, 3, 0);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const bulbGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 0.3, z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x, 6.3, z);
    bulbs.setMatrixAt(i, m4);
  });
  poles.instanceMatrix.needsUpdate = true;
  bulbs.instanceMatrix.needsUpdate = true;
  group.add(poles, bulbs);

  // Harbor pier at x=180 reaching into the ocean.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.6, 30), pierMat);
  pier.position.set(180, 0.6, 238);
  group.add(pier);
  for (let z = 226; z <= 250; z += 8) {
    for (const dx of [-4.5, 4.5]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.4, 6), pierMat);
      post.position.set(180 + dx, 0.4, z);
      group.add(post);
    }
  }

  // Central park fountain.
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6.5, 1.2, 20),
    new THREE.MeshLambertMaterial({ color: 0xb8c8d8 }),
  );
  fountain.position.set(-15, 0.9, -15);
  group.add(fountain);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(5.2, 5.2, 0.4, 20),
    new THREE.MeshLambertMaterial({ color: 0x3a9bc2 }),
  );
  water.position.set(-15, 1.4, -15);
  group.add(water);
  colliders.push({ minX: -21.5, maxX: -8.5, minZ: -21.5, maxZ: -8.5 });

  // A few traffic-light poles at busy intersections.
  const tlMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  for (const [x, z] of [[0, 0], [60, 0], [-60, 60], [120, -60]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.5, 6), tlMat);
    pole.position.set(x + 8, 2.75, z + 8);
    group.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), tlMat);
    head.position.set(x + 8, 5.6, z + 8);
    group.add(head);
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x27ae60 }),
    );
    lamp.position.set(x + 8, 5.1, z + 8.4);
    group.add(lamp);
  }

  return { group, colliders };
}

// Push a circle (x, z, radius) out of building AABBs. Returns true if it hit one.
export function collideCircle(colliders, p, radius) {
  let hit = false;
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
    const dx = p.x - cx;
    const dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * radius;
        p.z = cz + (dz / d) * radius;
      } else {
        p.x += radius;
      }
    }
  }
  return hit;
}
