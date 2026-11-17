// Particles, tracers, skid marks and muzzle flashes.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.partGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this.skids = [];
    this.skidMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 });
    this.flash = null;
  }

  burst(x, y, z, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.partGeo, new THREE.MeshBasicMaterial({ color }));
      m.position.set(x, y, z);
      this.scene.add(m);
      this.parts.push({
        mesh: m,
        vx: (Math.random() - 0.5) * speed * 2,
        vy: Math.random() * speed,
        vz: (Math.random() - 0.5) * speed * 2,
        life: 0.5 + Math.random() * 0.4,
        max: 0.9,
      });
    }
  }

  tracer(p, hx, hz) {
    const from = new THREE.Vector3(p.x + Math.sin(p.yaw) * 0.8, 1.4, p.z + Math.cos(p.yaw) * 0.8);
    const to = new THREE.Vector3(hx, 1.2, hz);
    const len = from.distanceTo(to);
    const geo = new THREE.CylinderGeometry(0.03, 0.03, len, 5);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.9 }));
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to);
    m.rotateX(Math.PI / 2);
    this.scene.add(m);
    this.parts.push({ mesh: m, vx: 0, vy: 0, vz: 0, life: 0.08, max: 0.08, fade: true });
  }

  muzzle(p) {
    if (this.flash) this.scene.remove(this.flash);
    const light = new THREE.PointLight(0xffc860, 80, 12);
    light.position.set(p.x + Math.sin(p.yaw), 1.5, p.z + Math.cos(p.yaw));
    this.scene.add(light);
    this.flash = light;
    setTimeout(() => {
      if (this.flash === light) { this.scene.remove(light); this.flash = null; }
    }, 70);
  }

  skid(x, z, yaw) {
    if (this.skids.length > 60) {
      const old = this.skids.shift();
      this.scene.remove(old);
    }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1.4), this.skidMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -yaw;
    m.position.set(x, 0.07, z);
    this.scene.add(m);
    this.skids.push(m);
  }

  exhaustSmoke(x, y, z) {
    this.burst(x, y, z, 0x777777, 2, 1.2);
  }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const pt = this.parts[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        this.parts.splice(i, 1);
        continue;
      }
      pt.vy -= 9 * dt;
      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      if (pt.fade && pt.mesh.material) pt.mesh.material.opacity = pt.life / pt.max;
    }
    for (const s of this.skids) {
      if (s.material.opacity > 0.08) s.material.opacity -= dt * 0.02;
    }
  }
}
