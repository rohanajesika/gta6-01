// Seeded randomness for Solmar Bay.
// Every procedural choice in the city, traffic and crowds draws from one
// mulberry32 stream, so a ?seed= URL reproduces the exact same city —
// the screenshots and a playtest both see the same streets.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Read ?seed= from the page URL; fall back to a fresh random seed so a
// normal play session is never the same city twice in a row.
export function seedFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const n = raw === null ? NaN : parseInt(raw, 10);
  if (Number.isFinite(n)) return n >>> 0;
  return (Math.random() * 0xffffffff) >>> 0;
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}
