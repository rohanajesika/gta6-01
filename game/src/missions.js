// Missions and story: five jobs for fixer Delia Kross that take Mara
// Voss from her first stolen coupe to the Solmar Heist. Each mission
// is a short chain of steps — go somewhere, drive somewhere, escape,
// or hold a position — with a cash reward at the end.
import * as THREE from 'three';
import { CFG, MISSION_DEFS } from './config.js';
import { addWanted, setMessage, saveGame } from './state.js';
import { makePedMesh } from './actors.js';

// A rival attacker for the Dockside Deal defence: a red-shirted thug
// who walks at the player and swings when close.
export function makeRival(scene, x, z) {
  const mesh = makePedMesh(Math.random);
  // Re-paint the shirt red so rivals read as hostile at a glance.
  mesh.traverse((child) => {
    if (child.isMesh && child.position.y > 1.0 && child.position.y < 1.6) {
      child.material = child.material.clone();
      child.material.color.setHex(0xc0392b);
    }
  });
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return { mesh, x, z, health: 100, dead: false, speed: 3.4 };
}

export function createMissionManager(scene, state) {
  return {
    scene,
    state,
    rivals: [],
    marker: null, // the 3D beacon marking the current objective
    markerPos: null,
    startedAt: 0,
  };
}

// Start the next mission in the chain. Returns false when the story is done.
export function startMission(mgr, index) {
  const def = MISSION_DEFS[index];
  if (!def) return false;
  mgr.state.missionIndex = index;
  mgr.state.missionStep = 0;
  mgr.state.missionActive = true;
  mgr.state.missionLabel = `${def.title}: ${def.steps[0].label}`;
  setMessage(mgr.state, `${def.giver}: ${def.brief}`, 6);
  placeMarker(mgr, def.steps[0].x, def.steps[0].z);
  if (def.steps[0].kind === 'defend') spawnRivals(mgr, def.steps[0]);
  if (def.steps[0].kind === 'escape') addWanted(mgr.state, 3);
  return true;
}

// The glowing beacon column over the current objective.
export function placeMarker(mgr, x, z) {
  if (mgr.marker) {
    mgr.scene.remove(mgr.marker);
    mgr.marker.geometry.dispose();
    mgr.marker.material.dispose();
  }
  const geo = new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffd23a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false,
  });
  const marker = new THREE.Mesh(geo, mat);
  marker.position.set(x, 15, z);
  mgr.scene.add(marker);
  mgr.marker = marker;
  mgr.markerPos = { x, z };
}

// Spawn the four rivals for the Dockside Deal defence around the pier.
function spawnRivals(mgr, step) {
  clearRivals(mgr);
  mgr.state.defendLeft = 4;
  const spots = [
    [step.x - 14, step.z - 10],
    [step.x + 14, step.z - 8],
    [step.x - 10, step.z + 12],
    [step.x + 12, step.z + 14],
  ];
  for (const [x, z] of spots) mgr.rivals.push(makeRival(mgr.scene, x, z));
}

export function clearRivals(mgr) {
  for (const r of mgr.rivals) mgr.scene.remove(r.mesh);
  mgr.rivals = [];
}

// Rivals walk at the player and punch when they get close.
export function updateRivals(mgr, player, dt) {
  for (const r of mgr.rivals) {
    if (r.dead) {
      r.mesh.visible = false;
      continue;
    }
    const dx = player.x - r.x;
    const dz = player.z - r.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) {
      r.x += (dx / dist) * r.speed * dt;
      r.z += (dz / dist) * r.speed * dt;
      r.mesh.rotation.y = Math.atan2(dx, dz);
    }
    if (dist < 1.8) {
      mgr.state.health -= 14 * dt;
    }
    r.mesh.position.set(r.x, 0, r.z);
  }
}

// Advance the mission chain. Called every frame; completes steps when
// the player reaches the marker, escapes the police, or clears the
// defence, then pays out and starts the next job.
export function updateMissions(mgr, player, dt) {
  const { state } = mgr;
  if (!state.missionActive) return;
  const def = MISSION_DEFS[state.missionIndex];
  if (!def) return;
  const step = def.steps[state.missionStep];
  if (!step) return;

  if (step.kind === 'goto' || step.kind === 'drive') {
    const d = Math.hypot(player.x - step.x, player.z - step.z);
    if (d < 5) advanceStep(mgr, def);
  } else if (step.kind === 'escape') {
    if (state.wanted === 0) advanceStep(mgr, def);
  } else if (step.kind === 'defend') {
    if (state.defendLeft <= 0) advanceStep(mgr, def);
  }
}

function advanceStep(mgr, def) {
  const { state } = mgr;
  state.missionStep += 1;
  if (state.missionStep >= def.steps.length) {
    completeMission(mgr, def);
    return;
  }
  const step = def.steps[state.missionStep];
  state.missionLabel = `${def.title}: ${step.label}`;
  placeMarker(mgr, step.x, step.z);
  if (step.kind === 'defend') spawnRivals(mgr, step);
  if (step.kind === 'escape') addWanted(state, 3);
  setMessage(state, `Next: ${step.label}`, 4);
}

function completeMission(mgr, def) {
  const { state } = mgr;
  const reward = CFG.MISSION_REWARDS[state.missionIndex] || 500;
  state.cash += reward;
  state.missionsDone += 1;
  state.missionActive = false;
  state.missionIndex += 1;
  state.missionLabel = state.missionIndex < MISSION_DEFS.length
    ? 'Job done — press M for the next job from Delia'
    : 'Story complete — Solmar Bay is yours';
  state.ammo = CFG.PISTOL_AMMO; // Delia restocks the pistol after a job.
  if (mgr.marker) {
    mgr.scene.remove(mgr.marker);
    mgr.marker = null;
    mgr.markerPos = null;
  }
  clearRivals(mgr);
  setMessage(state, `${def.title} complete — earned $${reward}`, 5);
  saveGame(state);
}
