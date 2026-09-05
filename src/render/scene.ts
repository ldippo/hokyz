import * as THREE from 'three/webgpu';
import type { RinkTheme } from '../run/meta';
import { PostStack } from './post';
import { TIER_SETTINGS, type GpuInfo, type Tier, type TierSettings } from './quality';

export class SceneRig {
  renderer: THREE.WebGPURenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  post: PostStack | null = null;
  tier: Tier = 'med';
  settings: TierSettings = TIER_SETTINGS.med;
  gpu: GpuInfo = { backend: 'webgl', description: 'unknown' };
  ready: Promise<void>;
  /** Assigned by App: request sim freeze for N frames (hit-stop). */
  hitStopHandler: ((frames: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGPURenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
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
    const rim = new THREE.DirectionalLight(0x88aaff, 0.6);
    rim.position.set(15, 20, -20);
    this.scene.add(rim);

    this.ready = this.init();
    window.addEventListener('resize', () => this.resize());
  }

  private async init(): Promise<void> {
    await this.renderer.init();
    const backend = this.renderer.backend as unknown as { isWebGPUBackend?: boolean; adapter?: { info?: { description?: string; vendor?: string; architecture?: string } }; gl?: WebGL2RenderingContext };
    if (backend.isWebGPUBackend) {
      const info = backend.adapter?.info;
      this.gpu = { backend: 'webgpu', description: [info?.vendor, info?.architecture, info?.description].filter(Boolean).join(' ') || 'webgpu' };
    } else {
      let desc = 'webgl';
      try {
        const gl = backend.gl;
        const ext = gl?.getExtension('WEBGL_debug_renderer_info');
        if (gl && ext) desc = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      } catch {
        /* ignore */
      }
      this.gpu = { backend: 'webgl', description: desc };
    }
    this.resize();
  }

  /** Debug: per-effect overrides on top of the tier (e.g. { gtao: false }). */
  overrides: Partial<TierSettings> = {};

  applyTier(tier: Tier): void {
    this.tier = tier;
    this.settings = { ...TIER_SETTINGS[tier], ...this.overrides };
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.settings.pixelRatioCap));
    if (this.sun.shadow.mapSize.x !== this.settings.shadowMapSize) {
      this.sun.shadow.mapSize.set(this.settings.shadowMapSize, this.settings.shadowMapSize);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as unknown as { map: unknown }).map = null;
    }
    this.post?.dispose();
    this.post = null;
    const s = this.settings;
    if (s.bloom || s.gtao || s.traa || s.hitFx) {
      this.post = new PostStack(this.renderer, this.scene, this.camera, s);
    }
    this.resize();
  }

  setTheme(t: RinkTheme): void {
    (this.scene.background as THREE.Color).setHex(t.bg);
    (this.scene.fog as THREE.Fog).color.setHex(t.bg);
    this.hemi.color.setHex(t.hemi);
  }

  /** Screen punch on big hits / goals. 0..1 */
  punch(amount: number): void {
    if (this.post) this.post.hit.value = Math.max(this.post.hit.value, amount);
  }
  setTurbo(amount: number): void {
    if (this.post) this.post.turboTarget = amount;
  }

  resize(): void {
    const w = window.innerWidth,
      h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  render(dt = 0): void {
    if (this.post) {
      this.post.update(dt);
      this.post.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
