// The story: three jobs that clear Danny Cole's $2,400 debt to the Marlin crew.
// Each mission has steps with a map marker; reaching a marker advances the
// step, finishing a mission pays the reward and autosaves.
import { STORY } from './config.js';
import { spawnGuards, guardsLeft } from './combat.js';

export function createMissions() {
  return {
    index: 0, // which mission (0..2); 3 means the story is done
    step: 0,
    done: false,
    marker: null, // { x, z } of the current objective, or null
  };
}

export function currentMission(G) {
  if (G.missions.index >= STORY.missions.length) return null;
  return STORY.missions[G.missions.index];
}

export function currentStep(G) {
  const m = currentMission(G);
  if (!m) return null;
  return m.steps[G.missions.step] || null;
}

export function refreshMarker(G) {
  const step = currentStep(G);
  G.missions.marker = step ? { x: step.at[0], z: step.at[1] } : null;
  if (step) G.hud.setObjective(`${currentMission(G).name} — ${step.text}`);
  else if (G.missions.done) G.hud.setObjective('Story complete — Solmar Bay is yours. Free roam!');
}

function completeMission(G) {
  const m = STORY.missions[G.missions.index];
  G.player.cash += m.reward;
  G.audio.missionDone();
  G.audio.pickup();
  G.hud.say(`${m.name} complete! +$${m.reward}`);
  G.missions.index += 1;
  G.missions.step = 0;
  if (G.missions.index >= STORY.missions.length) {
    G.missions.done = true;
    G.hud.say('Debt paid. The Marlin crew leaves Danny alone — story complete!');
  }
  refreshMarker(G);
  G.saveGame();
}

function advanceStep(G) {
  G.missions.step += 1;
  G.audio.pickup();
  const m = currentMission(G);
  if (G.missions.step >= m.steps.length) completeMission(G);
  else refreshMarker(G);
}

export function updateMissions(G) {
  if (G.missions.done) return;
  const step = currentStep(G);
  if (!step) return;
  const p = G.player;
  const d = Math.hypot(step.at[0] - p.x, step.at[1] - p.z);
  const m = currentMission(G);

  // Mission 2, step 1: steal the Comet — completes when Danny is in that car.
  if (step.car === 'comet') {
    if (p.inCar && p.car && p.car.kind === 'comet') advanceStep(G);
    return;
  }
  // Mission 3, step 2: the guards must all be down before the duffel counts.
  if (G.missions.index === 2 && G.missions.step === 1) {
    if (guardsLeft(G) === 0) advanceStep(G);
    return;
  }
  if (d < 12) advanceStep(G);
}

export function startMissionGuards(G) {
  // Called when the last mission's guard step begins.
  if (G.missions.index === 2 && G.missions.step === 1 && G.combat.guards.length === 0) {
    spawnGuards(G, [[252, 176], [262, 184], [244, 186]]);
    G.hud.say('Pier guards! Deal with them.');
  }
}
