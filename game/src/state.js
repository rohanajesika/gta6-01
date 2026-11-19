// Central game state for Solmar Bay, plus save / load.
// Every module reads and writes this one object, so the HUD, the police
// and the missions can never disagree about the player's situation.
import { CFG } from './config.js';

export function createState() {
  return {
    // Run clock.
    time: 0,
    started: false,
    paused: false,
    over: false,
    overReason: '',

    // Player.
    cash: CFG.START_CASH,
    health: CFG.PLAYER_HEALTH,
    ammo: CFG.PISTOL_AMMO,
    wanted: 0,
    quietTimer: 0, // seconds since the last crime
    kills: 0,
    carsStolen: 0,
    missionsDone: 0,

    // Player position, mirrored here so combat's panic radius reads
    // the same coordinates the main loop moves (updated every frame).
    playerX: 0,
    playerZ: 0,

    // Driving: null on foot, otherwise the car object being driven.
    driving: null,

    // Mission progress.
    missionIndex: 0,
    missionStep: 0,
    missionActive: false,
    missionLabel: 'Talk to Delia to start your first job',
    defendLeft: 0,

    // Free-roam helpers.
    message: '',
    messageTimer: 0,
    speedKmh: 0,
  };
}

const SAVE_KEY = 'solmarbay-save-v1';

// Write cash, health, ammo and mission progress to localStorage.
export function saveGame(state) {
  try {
    const data = {
      cash: state.cash,
      health: state.health,
      ammo: state.ammo,
      missionIndex: state.missionIndex,
      missionsDone: state.missionsDone,
      carsStolen: state.carsStolen,
      kills: state.kills,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    return false;
  }
}

// Read a save back. Returns null when there is no save yet.
export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch (err) {
    return null;
  }
}

// Apply a loaded save onto a fresh state object.
export function applySave(state, data) {
  state.cash = data.cash;
  state.health = Math.max(25, data.health || CFG.PLAYER_HEALTH);
  state.ammo = data.ammo ?? CFG.PISTOL_AMMO;
  state.missionIndex = Math.min(data.missionIndex, 5);
  state.missionsDone = data.missionsDone || 0;
  state.carsStolen = data.carsStolen || 0;
  state.kills = data.kills || 0;
}

// Wanted level helpers: crimes raise heat, quiet time lowers it.
export function addWanted(state, stars) {
  state.wanted = Math.min(CFG.WANTED_MAX, state.wanted + stars);
  state.quietTimer = 0;
}

export function setMessage(state, text, seconds = 4) {
  state.message = text;
  state.messageTimer = seconds;
}
