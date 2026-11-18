// Rendering. One job: the WebGL renderer, the sun-soaked sky, and the
// third-person camera — follow cam behind the car, orbit cam on foot,
// or a fixed cinematic frame for screenshots.
import * as THREE from 'three';

export function createRender(G) {
  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b5d8);
  scene.fog = new THREE.Fog(0x9fc3dd, 180, 520);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 8, 12);

  // Late-afternoon sun + sky bounce, so the city reads warm and bright.
  const sun = new THREE.DirectionalLight(0xffe8c0, 2.6);
  sun.position.set(120, 160, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160;
  sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 160;
  sun.shadow.camera.bottom = -160;
  sun.shadow.camera.far = 500;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd8ee, 0x8a7a5a, 1.1));

  let shotCamera = null;

  function setShotCamera(pos, lookAt) {
    shotCamera = { pos, lookAt };
  }

  function angleLerp(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }

  function updateCamera(dt) {
    const player = G.player;
    const drag = G.input.takeDrag();
    if (drag.dx !== 0 || drag.dy !== 0) {
      player.camYaw -= drag.dx * 0.0045;
      player.camPitch = Math.max(0.05, Math.min(1.0, player.camPitch + drag.dy * 0.003));
    }

    if (shotCamera) {
      camera.position.set(shotCamera.pos.x, shotCamera.pos.y, shotCamera.pos.z);
      camera.lookAt(shotCamera.lookAt.x, shotCamera.lookAt.y, shotCamera.lookAt.z);
      return;
    }

    const shake = G.effects.shakeOffset();
    if (player.inCar && player.car) {
      // Follow cam: ease behind the car's heading, drag can look around
      // and the view settles back behind the car on its own.
      const desired = player.car.heading + Math.PI;
      player.camYaw = angleLerp(player.camYaw, desired, Math.min(1, 2.2 * dt));
      const dist = 10.5;
      const height = 4.2 + player.camPitch * 2;
      const tx = player.car.x + Math.sin(player.camYaw) * dist;
      const tz = player.car.z + Math.cos(player.camYaw) * dist;
      camera.position.set(tx + shake.x, height + shake.y, tz);
      camera.lookAt(player.car.x, 1.6, player.car.z);
    } else {
      const dist = 7.5;
      const height = 2.4 + player.camPitch * 5;
      const tx = player.x + Math.sin(player.camYaw) * dist;
      const tz = player.z + Math.cos(player.camYaw) * dist;
      camera.position.set(tx + shake.x, height + shake.y, tz);
      camera.lookAt(player.x, 1.7 + player.camPitch, player.z);
    }
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  return {
    renderer,
    scene,
    camera,
    updateCamera,
    setShotCamera,
    render() {
      renderer.render(scene, camera);
    },
  };
}
