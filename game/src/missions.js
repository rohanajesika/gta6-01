// Missions and story. One job: run the three-job arc for Mara Voss —
// objectives, the beacon marking them, rewards, and the story-complete
// moment. Progress is what the save file stores.
import * as THREE from 'three';
import { MISSIONS, STORY_COMPLETE_TITLE, STORY_COMPLETE_TEXT } from './config.js';

export function createMissions(G) {
  let index = 0;
  let step = 0;
  let escapeArmed = false;

  // A pillar of light marks the active objective from anywhere in town.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0xffd23e, transparent: true, opacity: 0.35,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 90, 12, 1, true), beaconMat);
  beacon.position.y = 45;
  beacon.visible = false;
  G.scene.add(beacon);
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffd23e });
  const marker = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), markerMat);
  marker.visible = false;
  G.scene.add(marker);

  function current() {
    return MISSIONS[index] ?? null;
  }

  function currentStep() {
    const m = current();
    return m ? m.steps[step] ?? null : null;
  }

  function placeBeacon() {
    const s = currentStep();
    if (!s || !s.pos) {
      beacon.visible = false;
      marker.visible = false;
      return;
    }
    beacon.position.x = s.pos.x;
    beacon.position.z = s.pos.z;
    beacon.visible = true;
    marker.position.set(s.pos.x, 2.5, s.pos.z);
    marker.visible = true;
  }

  // Arm whatever the new step needs — an escape step puts three stars on.
  function beginStep() {
    const s = currentStep();
    if (!s) return;
    escapeArmed = false;
    if (s.kind === 'escape') {
      G.police.setWanted(3, true);
      escapeArmed = true;
    }
    placeBeacon();
  }

  function startMission(i) {
    index = i;
    step = 0;
    const m = current();
    if (!m) return;
    G.hud.toast(`${m.title} — ${m.steps[0].objective}`);
    G.audio.chime();
    beginStep();
  }

  function completeStep() {
    const m = current();
    const s = currentStep();
    if (!m || !s) return;
    if (step + 1 < m.steps.length) {
      step += 1;
      G.hud.toast(`Objective complete — ${m.steps[step].objective}`);
      G.audio.chime();
      beginStep();
      return;
    }
    G.player.cash += m.reward;
    G.player.ammo = Math.min(120, G.player.ammo + 24);
    G.hud.toast(`Mission complete: ${m.title} — +$${m.reward}`);
    G.audio.fanfare();
    G.saveGame();
    index += 1;
    step = 0;
    if (index >= MISSIONS.length) {
      beacon.visible = false;
      marker.visible = false;
      G.showStoryComplete(STORY_COMPLETE_TITLE, STORY_COMPLETE_TEXT);
      return;
    }
    startMission(index);
  }

  function update(dt) {
    const s = currentStep();
    if (!s) return;
    if (s.kind === 'goto') {
      const d = Math.hypot(G.player.x - s.pos.x, G.player.z - s.pos.z);
      if (d < s.radius) completeStep();
    } else if (s.kind === 'deliver_car') {
      if (!G.player.inCar) return;
      const d = Math.hypot(G.player.x - s.pos.x, G.player.z - s.pos.z);
      if (d < s.radius) completeStep();
    } else if (s.kind === 'escape') {
      if (escapeArmed && G.police.wanted === 0) completeStep();
    }
    // Pulse the marker so it reads from a distance.
    if (marker.visible) {
      const pulse = 1 + Math.sin(G.time * 4) * 0.25;
      marker.scale.set(pulse, pulse, pulse);
      beaconMat.opacity = 0.28 + Math.sin(G.time * 4) * 0.08;
    }
  }

  function objectiveText() {
    const m = current();
    const s = currentStep();
    if (!m || !s) return 'Free roam — Solmar Bay is yours';
    let text = s.objective;
    if (s.pos) {
      const d = Math.hypot(G.player.x - s.pos.x, G.player.z - s.pos.z);
      text += `  ·  ${Math.round(d)}m`;
    } else if (s.kind === 'escape') {
      text += `  ·  wanted ${G.police.wanted}`;
    }
    return text;
  }

  function objectivePos() {
    const s = currentStep();
    return s && s.pos ? { x: s.pos.x, z: s.pos.z } : null;
  }

  return {
    get index() {
      return index;
    },
    get step() {
      return step;
    },
    set step(v) {
      step = v;
    },
    current,
    currentStep,
    startMission,
    update,
    objectiveText,
    objectivePos,
    placeBeacon,
    // Save/load restore: jump straight to a mission step without
    // replaying its briefing, and re-arm the escape if that is the step.
    restore(savedIndex, savedStep = 0) {
      index = Math.max(0, Math.min(MISSIONS.length, savedIndex | 0));
      const m = current();
      step = m ? Math.max(0, Math.min(m.steps.length - 1, savedStep | 0)) : 0;
      if (index >= MISSIONS.length) {
        beacon.visible = false;
        marker.visible = false;
        return;
      }
      if (currentStep() && currentStep().kind === 'escape') escapeArmed = true;
      placeBeacon();
    },
  };
}
