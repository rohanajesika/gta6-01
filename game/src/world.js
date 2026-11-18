// World queries. One job: the shared spatial truth — building colliders,
// road tests, and push-out resolution for circles (player, cars, peds).
import { CONFIG } from './config.js';

export function createWorld(city) {
  const colliders = city.colliders;

  function collidesCircle(x, z, r) {
    for (const b of colliders) {
      const cx = Math.max(b.minX, Math.min(x, b.maxX));
      const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return b;
    }
    return null;
  }

  // Push a circle out of every building it overlaps. Returns the resolved
  // position and whether anything was hit.
  function resolveCircle(x, z, r) {
    let collided = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const b of colliders) {
        const cx = Math.max(b.minX, Math.min(x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        let dx = x - cx;
        let dz = z - cz;
        let d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        collided = true;
        if (d2 < 1e-6) {
          // Dead centre inside the box: push out along the smallest axis.
          const pushL = x - b.minX + r;
          const pushR = b.maxX - x + r;
          const pushT = z - b.minZ + r;
          const pushB = b.maxZ - z + r;
          const m = Math.min(pushL, pushR, pushT, pushB);
          if (m === pushL) x = b.minX - r;
          else if (m === pushR) x = b.maxX + r;
          else if (m === pushT) z = b.minZ - r;
          else z = b.maxZ + r;
        } else {
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          x += dx * push;
          z += dz * push;
        }
      }
    }
    return { x, z, collided };
  }

  function isOnRoad(x, z) {
    const half = CONFIG.roadWidth / 2 + 1;
    for (const r of CONFIG.roads) {
      if (Math.abs(x - r) < half || Math.abs(z - r) < half) return true;
    }
    return false;
  }

  // Nearest point on the road grid to (x, z): the centre of the closest
  // road line. Police spawn here so they always arrive on tarmac.
  function nearestRoadPoint(x, z) {
    let bestX = CONFIG.roads[0];
    let bestZ = CONFIG.roads[0];
    for (const r of CONFIG.roads) {
      if (Math.abs(r - x) < Math.abs(bestX - x)) bestX = r;
      if (Math.abs(r - z) < Math.abs(bestZ - z)) bestZ = r;
    }
    if (Math.abs(bestX - x) < Math.abs(bestZ - z)) return { x: bestX, z };
    return { x, z: bestZ };
  }

  function clampToCity(x, z, margin = 2) {
    return {
      x: Math.max(-CONFIG.worldHalf - 48, Math.min(CONFIG.worldHalf - margin, x)),
      z: Math.max(-CONFIG.worldHalf + margin, Math.min(CONFIG.worldHalf - margin, z)),
    };
  }

  return {
    colliders,
    collidesCircle,
    resolveCircle,
    resolveCarCollision: (x, z, r) => resolveCircle(x, z, r),
    isOnRoad,
    nearestRoadPoint,
    clampToCity,
  };
}
