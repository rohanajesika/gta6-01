// Solmar Bay's city: a sun-soaked coastal grid built from one seeded
// stream. Everything here is procedural — no borrowed art — and every
// solid object registers an axis-aligned collider the player and the
// cars resolve against.
import * as THREE from 'three';
import { CFG, PALETTE } from './config.js';
import { pick, range, intRange } from './rng.js';

// Road centre lines, e.g. [-176, -132, ..., 176].
export function roadLines() {
  const lines = [];
  const half = ((CFG.ROAD_COUNT - 1) / 2) * CFG.BLOCK;
  for (let i = 0; i < CFG.ROAD_COUNT; i++) lines.push(-half + i * CFG.BLOCK);
  return lines;
}

// Snap a coordinate to the nearest road centre line.
export function nearestRoad(v) {
  const lines = roadLines();
  let best = lines[0];
  for (const line of lines) if (Math.abs(line - v) < Math.abs(best - v)) best = line;
  return best;
}

// Paint the ground: sand blocks, asphalt roads with dashed centrelines,
// pale sidewalks, and the teal sea along the south edge. One canvas
// texture covers the whole map, so the ground is a single draw call.
function makeGroundTexture(rng) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const span = CFG.CITY_HALF * 2 + 40; // world units across the canvas
  const toPx = (v) => ((v + span / 2) / span) * size;

  ctx.fillStyle = '#e8d3a8';
  ctx.fillRect(0, 0, size, size);

  // City blocks: alternating warm sand and lawn green.
  const lines = roadLines();
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = toPx(lines[i] + CFG.ROAD / 2);
      const z0 = toPx(lines[j] + CFG.ROAD / 2);
      const w = toPx(lines[i + 1] - CFG.ROAD / 2) - x0;
      const h = toPx(lines[j + 1] - CFG.ROAD / 2) - z0;
      ctx.fillStyle = (i + j) % 3 === 0 ? '#8fb573' : '#e2c99a';
      ctx.fillRect(x0, z0, w, h);
      // Pale sidewalk border around each block.
      ctx.strokeStyle = '#c9c2ae';
      ctx.lineWidth = 5;
      ctx.strokeRect(x0 + 2, z0 + 2, w - 4, h - 4);
    }
  }

  // Asphalt roads.
  ctx.fillStyle = '#3a3f46';
  for (const line of lines) {
    ctx.fillRect(0, toPx(line - CFG.ROAD / 2), size, toPx(CFG.ROAD) - toPx(0));
    ctx.fillRect(toPx(line - CFG.ROAD / 2), 0, toPx(CFG.ROAD) - toPx(0), size);
  }
  // Dashed centre lines.
  ctx.fillStyle = '#e8c93a';
  for (const line of lines) {
    for (let d = -CFG.CITY_HALF; d < CFG.CITY_HALF; d += 8) {
      ctx.fillRect(toPx(d), toPx(line) - 1.5, toPx(4) - toPx(0), 3);
      ctx.fillRect(toPx(line) - 1.5, toPx(d), 3, toPx(4) - toPx(0));
    }
  }
  // Crosswalks at every intersection.
  ctx.fillStyle = '#dfe3e6';
  for (const x of lines) {
    for (const z of lines) {
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(toPx(x + k * 2.2) - 2, toPx(z - CFG.ROAD / 2), 4, 7);
        ctx.fillRect(toPx(x + k * 2.2) - 2, toPx(z + CFG.ROAD / 2) - 7, 4, 7);
      }
    }
  }
  // The sea along the south edge, with a foam line at the waterline.
  ctx.fillStyle = '#1e7f9e';
  ctx.fillRect(0, toPx(CFG.SEA_Z), size, size - toPx(CFG.SEA_Z));
  ctx.fillStyle = '#bfe8f2';
  ctx.fillRect(0, toPx(CFG.SEA_Z) - 2, size, 4);
  // Beach strip.
  ctx.fillStyle = '#f2e2b8';
  ctx.fillRect(0, toPx(CFG.SEA_Z - 16), size, toPx(CFG.SEA_Z) - toPx(CFG.SEA_Z - 16));

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// A small canvas texture of lit windows, shared by every tower.
function makeWindowTexture(rng) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      const lit = rng() < 0.45;
      ctx.fillStyle = lit ? '#ffe9a8' : '#2c3e50';
      ctx.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const colliders = []; // { minX, maxX, minZ, maxZ }
  const group = new THREE.Group();
  group.name = 'city';

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CFG.CITY_HALF * 2 + 40, CFG.CITY_HALF * 2 + 40),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 10);
  group.add(ground);

  // Sea plane, slightly below the ground edge so the shoreline reads.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 90),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CFG.SEA_Z + 45);
  group.add(sea);

  // Buildings: one or two towers per block, heights vary with distance
  // from the beach so the skyline steps down toward the sea.
  const windowTex = makeWindowTexture(rng);
  const lines = roadLines();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + CFG.ROAD / 2 + 3;
      const x1 = lines[i + 1] - CFG.ROAD / 2 - 3;
      const z0 = lines[j] + CFG.ROAD / 2 + 3;
      const z1 = lines[j + 1] - CFG.ROAD / 2 - 3;
      // Keep the marina row (south edge) open for the pier.
      if (z0 > CFG.SEA_Z - 40) continue;
      const count = intRange(rng, 1, 2);
      for (let b = 0; b < count; b++) {
        const w = range(rng, 10, Math.max(11, (x1 - x0) / count - 2));
        const d = range(rng, 10, z1 - z0 - 2);
        const cx = x0 + ((x1 - x0) / count) * (b + 0.5) + range(rng, -2, 2);
        const cz = (z0 + z1) / 2 + range(rng, -2, 2);
        const h = range(rng, 8, 14 + Math.max(0, 34 - Math.abs(cz) * 0.12));
        const color = pick(rng, PALETTE.building);
        const mat = new THREE.MeshLambertMaterial({ color, map: windowTex });
        const tower = new THREE.Mesh(boxGeo, mat);
        tower.scale.set(w, h, d);
        tower.position.set(cx, h / 2, cz);
        group.add(tower);
        // Flat roof cap in a darker shade.
        const roof = new THREE.Mesh(
          boxGeo,
          new THREE.MeshLambertMaterial({ color: 0x5a5a5a }),
        );
        roof.scale.set(w + 0.4, 0.6, d + 0.4);
        roof.position.set(cx, h + 0.3, cz);
        group.add(roof);
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
      }
    }
  }

  // Palm trees along the beach and scattered on sidewalks.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const crownGeo = new THREE.SphereGeometry(2.2, 8, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x3e8e4f });
  const palmSpots = [];
  for (let x = -180; x <= 180; x += 18) palmSpots.push([x, CFG.SEA_Z - 10]);
  for (let k = 0; k < 26; k++) {
    palmSpots.push([range(rng, -180, 180), range(rng, -180, 170)]);
  }
  for (const [x, z] of palmSpots) {
    if (Math.abs(x - nearestRoad(x)) < CFG.ROAD / 2 + 1) continue;
    if (Math.abs(z - nearestRoad(z)) < CFG.ROAD / 2 + 1) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.scale.y = 0.55;
    crown.position.set(x, 7.4, z);
    group.add(trunk, crown);
  }

  // Street lamps at intersections.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 6);
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
  for (const x of lines) {
    for (const z of lines) {
      if (rng() < 0.5) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + CFG.ROAD / 2 + 0.8, 3, z + CFG.ROAD / 2 + 0.8);
      const bulb = new THREE.Mesh(
        lampGeo,
        new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x664411 }),
      );
      bulb.position.set(x + CFG.ROAD / 2 + 0.8, 6.2, z + CFG.ROAD / 2 + 0.8);
      group.add(pole, bulb);
    }
  }

  // Marina pier: wooden planks jutting into the sea, with mooring posts.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  const pier = new THREE.Mesh(boxGeo, pierMat);
  pier.scale.set(10, 0.8, 34);
  pier.position.set(0, 0.4, CFG.SEA_Z + 12);
  group.add(pier);
  for (const dz of [-12, 0, 12]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.4, 8), pierMat);
    post.position.set(5.4, 1.2, CFG.SEA_Z + 12 + dz);
    group.add(post);
  }
  // Two moored boats: simple hulls bobbing beside the pier.
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xf5f5f5 });
  for (const [bx, bz] of [[-12, CFG.SEA_Z + 16], [12, CFG.SEA_Z + 24]]) {
    const hull = new THREE.Mesh(boxGeo, hullMat);
    hull.scale.set(4, 1.6, 10);
    hull.position.set(bx, 0.6, bz);
    group.add(hull);
  }

  // Parked cars the player can steal: fixed spots ON roads (one
  // coordinate always a road centre line), angled along the road.
  const parkingSpots = [
    { x: -88, z: 22, angle: 0 },
    { x: -88, z: 30, angle: 0 },
    { x: 44, z: -66, angle: Math.PI },
    { x: 0, z: -110, angle: 0 },
    { x: 88, z: 66, angle: Math.PI },
    { x: -132, z: -22, angle: 0 },
  ];

  scene.add(group);
  return { group, colliders, parkingSpots };
}

// Push a circle (player or car) out of every building collider it
// overlaps. Returns true when any push happened.
export function resolveCollisions(pos, radius, colliders) {
  let hit = false;
  for (const c of colliders) {
    const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      } else {
        // Centre inside the box: shove out along the smallest axis.
        const pushLeft = pos.x - c.minX;
        const pushRight = c.maxX - pos.x;
        const pushUp = pos.z - c.minZ;
        const pushDown = c.maxZ - pos.z;
        const m = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (m === pushLeft) pos.x = c.minX - radius;
        else if (m === pushRight) pos.x = c.maxX + radius;
        else if (m === pushUp) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
  }
  return hit;
}

// Keep a position inside the playable map (the sea blocks the south).
export function clampToCity(pos, margin = 4) {
  const lim = CFG.CITY_HALF - margin;
  pos.x = Math.max(-lim, Math.min(lim, pos.x));
  pos.z = Math.max(-lim, Math.min(lim, pos.z));
}
