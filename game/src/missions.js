// Story missions: sequential objectives, a marker beacon, cash rewards.
import * as THREE from 'three';
import { MISSIONS, dist2d } from './config.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.index = 0;          // mission 0..2, 3 = story complete
    this.step = 0;
    this.done = false;
    this.targetCar = null;   // the red Comet for mission 2
    this.marker = null;
    this.beacon = null;
    this.flash = 0;
    this._buildMarker();
  }

  _buildMarker() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.22, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd23e }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.25;
    g.add(ring);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.6, 34, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = 17;
    g.add(beam);
    const light = new THREE.PointLight(0xffd23e, 60, 26);
    light.position.y = 4;
    g.add(light);
    g.visible = false;
    this.scene.add(g);
    this.marker = g;
    this.beacon = beam;
  }

  current() {
    if (this.index >= MISSIONS.length) return null;
    return MISSIONS[this.index];
  }

  currentStep() {
    const m = this.current();
    return m ? m.steps[this.step] : null;
  }

  objectiveText() {
    if (this.done) return 'Story complete — Solmar Bay is yours, Danny.';
    const m = this.current();
    const s = this.currentStep();
    if (!m || !s) return '';
    return `${m.title}: ${s.text}`;
  }

  markerPos() {
    const s = this.currentStep();
    if (!s) return null;
    if (s.type === 'escape') return null; // no fixed point while losing the heat
    if (s.type === 'steal' && this.targetCar) return [this.targetCar.x, this.targetCar.z];
    return s.pos;
  }

  // Returns a cash reward when a mission completes, else 0. Calls hooks for toasts.
  update(dt, G) {
    if (this.done) return 0;
    const m = this.current();
    const s = this.currentStep();
    if (!m || !s) return 0;
    this.flash += dt;
    const mp = this.markerPos();
    if (mp) {
      this.marker.visible = true;
      this.marker.position.set(mp[0], 0, mp[1]);
      const sc = 1 + Math.sin(this.flash * 3) * 0.12;
      this.marker.scale.set(sc, 1, sc);
      this.marker.rotation.y += dt * 0.8;
    } else {
      this.marker.visible = false;
    }

    const px = G.player.x, pz = G.player.z;
    let advance = false;
    if (s.type === 'goto' || s.type === 'grab') {
      if (dist2d(px, pz, s.pos[0], s.pos[1]) < s.r) advance = true;
    } else if (s.type === 'steal') {
      if (G.player.inCar && this.targetCar && G.player.car === this.targetCar) advance = true;
    } else if (s.type === 'deliver') {
      if (G.player.inCar && dist2d(px, pz, s.pos[0], s.pos[1]) < s.r) advance = true;
    } else if (s.type === 'escape') {
      if (G.police.wanted === 0) advance = true;
    }
    if (!advance) return 0;

    if (s.type === 'grab') {
      G.audio.pickup();
      G.hud.toast('Case secured — now lose the heat!');
      G.police.addHeat(250, 'heist');
    }
    this.step += 1;
    G.audio.pickup();
    if (this.step >= m.steps.length) {
      // Mission complete.
      this.index += 1;
      this.step = 0;
      G.audio.missionDone();
      if (this.index >= MISSIONS.length) {
        this.done = true;
        this.marker.visible = false;
        G.hud.toast('STORY COMPLETE — You beat Solmar Bay!');
        return m.reward;
      }
      const next = MISSIONS[this.index];
      G.hud.toast(`${m.title} complete! +$${m.reward} — ${next.title}`);
      if (next.id === 'm2' && this.targetCar) {
        this.targetCar.parked = true;
      }
      return m.reward;
    }
    G.hud.toast('Objective complete!');
    return 0;
  }
}
