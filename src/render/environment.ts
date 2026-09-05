import * as THREE from 'three/webgpu';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let envTex: THREE.Texture | null = null;

/** Neutral room environment for PBR reflections on helmets, glass, boards. */
export function setupEnvironment(renderer: THREE.WebGPURenderer, scene: THREE.Scene, intensity = 0.35): void {
  if (!envTex) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  }
  scene.environment = envTex;
  scene.environmentIntensity = intensity;
}
