import * as THREE from 'three';
import type { RinkTheme } from '../run/meta';

export class SceneRig {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color(0x07070c);
    this.scene.fog = new THREE.Fog(0x07070c, 45, 90);
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x1a1a2a, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(-12, 30, 14);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = 34;
    this.sun.shadow.camera.left = -s;
    this.sun.shadow.camera.right = s;
    this.sun.shadow.camera.top = s;
    this.sun.shadow.camera.bottom = -s;
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 80;
    this.sun.shadow.bias = -0.0006;
    this.scene.add(this.sun);
    // arena spot rim lights
    const rim = new THREE.DirectionalLight(0x88aaff, 0.6);
    rim.position.set(15, 20, -20);
    this.scene.add(rim);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  setTheme(t: RinkTheme): void {
    (this.scene.background as THREE.Color).setHex(t.bg);
    (this.scene.fog as THREE.Fog).color.setHex(t.bg);
    this.hemi.color.setHex(t.hemi);
  }
  resize(): void {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
