// City construction. One job: build Solmar Bay itself — ground, roads,
// blocks, buildings, palms, beach, ocean, landmarks — and hand back the
// collision boxes the rest of the game walks and drives against.
import * as THREE from 'three';
import { CONFIG } from './config.js';

// Procedural window texture: one canvas, reused on every building, so the
// skyline reads as a lived-in city without shipping any image file.
function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#cfd6dd';
  g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 12) {
      g.fillStyle = (x + y) % 32 === 0 ? '#ffe9a8' : '#3d5a73';
      g.fillRect(x, y, 8, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PALETTE = [
  0xe8b48a, 0xd98f6a, 0xf2d8a7, 0xa8c6d8, 0x9fb8a4,
  0xe6c9c9, 0xc9b8d8, 0xf0e0c0, 0x8fb8c9, 0xd8a0a0,
];

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  const windowTex = makeWindowTexture();

  const half = CONFIG.worldHalf;
  const roadHalf = CONFIG.roadWidth / 2;

  // Base ground: warm concrete for the whole city slab.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 120, half * 2 + 120),
    new THREE.MeshStandardMaterial({ color: 0x9aa08e, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(-30, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: dark asphalt strips along every grid line, both directions.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8c95a, roughness: 0.8 });
  for (const r of CONFIG.roads) {
    const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.roadWidth, half * 2), roadMat);
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(r, 0.02, 0);
    vRoad.receiveShadow = true;
    group.add(vRoad);
    const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, CONFIG.roadWidth), roadMat);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.02, r);
    hRoad.receiveShadow = true;
    group.add(hRoad);
    // Centre dashes.
    for (let d = -half + 10; d < half; d += 20) {
      const dashV = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 6), lineMat);
      dashV.position.set(r, 0.04, d);
      group.add(dashV);
      const dashH = new THREE.Mesh(new THREE.BoxGeometry(6, 0.02, 0.5), lineMat);
      dashH.position.set(d, 0.04, r);
      group.add(dashH);
    }
  }

  // Sidewalk slabs on each block, slightly raised, pale concrete.
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xb9b3a4, roughness: 1 });
  const blockCentres = [];
  for (let bx = -160; bx <= 160; bx += 40) {
    for (let bz = -160; bz <= 160; bz += 40) blockCentres.push({ x: bx, z: bz });
  }
  for (const b of blockCentres) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(28, 0.3, 28), walkMat);
    slab.position.set(b.x, 0.15, b.z);
    slab.receiveShadow = true;
    group.add(slab);
  }

  // Buildings: one or two per block, kept out of the plaza, out of the
  // service alley, and off the road grid. Their footprints become colliders.
  const isPlaza = (x, z) => Math.abs(x) < CONFIG.plazaHalf && Math.abs(z) < CONFIG.plazaHalf;
  for (const b of blockCentres) {
    if (isPlaza(b.x, b.z)) continue;
    const count = rng.chance(0.55) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const w = rng.range(9, 15);
      const d = rng.range(9, 15);
      const h = rng.range(8, 42);
      const ox = count === 1 ? 0 : i === 0 ? -6 : 6;
      const oz = count === 1 ? 0 : i === 0 ? -6 : 6;
      const cx = b.x + ox + rng.range(-2, 2);
      const cz = b.z + oz + rng.range(-2, 2);
      // The service alley must stay clear along its whole length: skip
      // any building whose footprint overlaps the alley strip, not just
      // one centred in it, or a car driven down the alley would hit it.
      if (cx - w / 2 < CONFIG.alleyMax && cx + w / 2 > CONFIG.alleyMin) continue;
      if (Math.abs(cx) + w / 2 > half || Math.abs(cz) + d / 2 > half) continue;
      const color = rng.pick(PALETTE);
      const mat = new THREE.MeshStandardMaterial({
        color,
        map: windowTex.clone(),
        roughness: 0.85,
      });
      mat.map.repeat.set(Math.max(1, Math.round(w / 6)), Math.max(1, Math.round(h / 8)));
      mat.map.needsUpdate = true;
      const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      building.position.set(cx, h / 2 + 0.3, cz);
      building.castShadow = true;
      building.receiveShadow = true;
      group.add(building);
      // Rooftop box, so the skyline is not flat slabs.
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.3, 1.6, d * 0.3),
        new THREE.MeshStandardMaterial({ color: 0x6a6f75, roughness: 1 }),
      );
      roof.position.set(cx, h + 1.1, cz);
      roof.castShadow = true;
      group.add(roof);
      colliders.push({
        minX: cx - w / 2, maxX: cx + w / 2,
        minZ: cz - d / 2, maxZ: cz + d / 2,
      });
    }
  }

  // Palm trees along the beach front and scattered on sidewalks.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 1 });
  function palm(x, z, s = 1) {
    const p = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 5 * s, 6), trunkMat);
    trunk.position.y = 2.5 * s;
    trunk.castShadow = true;
    p.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.4 * s, 6, 4), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 1.1 * s, 5.2 * s, Math.sin(a) * 1.1 * s);
      leaf.scale.set(1.4, 0.45, 0.8);
      leaf.rotation.y = a;
      p.add(leaf);
    }
    p.position.set(x, 0.3, z);
    group.add(p);
  }
  for (let z = -190; z <= 190; z += 24) palm(-206, z, rng.range(0.9, 1.3));
  for (let i = 0; i < 26; i++) {
    const bx = rng.pick(CONFIG.roads);
    const bz = rng.range(-180, 180);
    if (isPlaza(bx, bz)) continue;
    palm(bx + (rng.chance(0.5) ? 9 : -9), bz, rng.range(0.8, 1.1));
  }

  // Street lamps at intersections.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffdf8a, emissiveIntensity: 0.7 });
  for (const rx of [-100, 0, 100]) {
    for (const rz of [-100, 0, 100]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(rx + 8, 3.3, rz + 8);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
      bulb.position.set(rx + 8, 6.4, rz + 8);
      group.add(bulb);
    }
  }

  // Beach: sand strip, then a wide ocean plane. The city ends at the sand.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(52, half * 2 + 120),
    new THREE.MeshStandardMaterial({ color: 0xe8d8a8, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(-226, 0.01, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(320, half * 2 + 400),
    new THREE.MeshStandardMaterial({ color: 0x2a7ab8, roughness: 0.35, metalness: 0.1 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(-412, -0.4, 0);
  group.add(ocean);

  // Landmarks the missions point at.
  // Marina Kiosk, south-west corner (-180, -180): a small striped kiosk.
  const kiosk = new THREE.Group();
  const kioskBase = new THREE.Mesh(
    new THREE.BoxGeometry(6, 3, 5),
    new THREE.MeshStandardMaterial({ color: 0xf2f0e6, roughness: 0.9 }),
  );
  kioskBase.position.y = 1.8;
  kioskBase.castShadow = true;
  kiosk.add(kioskBase);
  const kioskRoof = new THREE.Mesh(
    new THREE.BoxGeometry(7, 0.5, 6),
    new THREE.MeshStandardMaterial({ color: 0xd84a4a, roughness: 0.8 }),
  );
  kioskRoof.position.y = 3.5;
  kiosk.add(kioskRoof);
  kiosk.position.set(-180, 0.3, -180);
  group.add(kiosk);
  colliders.push({ minX: -183, maxX: -177, minZ: -182.5, maxZ: -177.5 });

  // Sunset Garage, north-east corner (180, 180): an open-front garage box.
  const garage = new THREE.Group();
  const garageMat = new THREE.MeshStandardMaterial({ color: 0x5a6a7a, roughness: 0.9 });
  const garageBody = new THREE.Mesh(new THREE.BoxGeometry(16, 6, 12), garageMat);
  garageBody.position.y = 3.3;
  garageBody.castShadow = true;
  garage.add(garageBody);
  const garageDoor = new THREE.Mesh(
    new THREE.BoxGeometry(10, 4.5, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x2c343c, roughness: 0.7, metalness: 0.5 }),
  );
  garageDoor.position.set(0, 2.5, -6.1);
  garage.add(garageDoor);
  garage.position.set(180, 0.3, 180);
  group.add(garage);
  colliders.push({ minX: 172, maxX: 188, minZ: 174, maxZ: 186 });

  // Pier Point, north-west shore (-180, 180): a wooden pier over the sand.
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x9a7b52, roughness: 1 });
  for (let x = -180; x >= -212; x -= 4) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 6), pierMat);
    plank.position.set(x, 0.5, 180);
    plank.receiveShadow = true;
    group.add(plank);
  }

  scene.add(group);
  return { colliders, group };
}
