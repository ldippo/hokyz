import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, velocity, uniform, vec2, vec3, vec4, float, mix, luminance, smoothstep, screenUV, length, convertToTexture } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { traa } from 'three/addons/tsl/display/TRAANode.js';
import { fxaa } from 'three/addons/tsl/display/FXAANode.js';
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js';
import type { TierSettings } from './quality';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

/** Radial zoom blur toward screen center, strength 0..1. 7 taps. */
function radialZoom(node: N, amount: N): N {
  const tex = convertToTexture(node);
  const uv = screenUV;
  const dir = vec2(0.5, 0.5).sub(uv);
  let acc: N = tex.sample(uv);
  for (let i = 1; i <= 6; i++) {
    acc = acc.add(tex.sample(uv.add(dir.mul(amount.mul(0.045 * i)))));
  }
  return acc.div(7);
}

/** Arcade color grade: saturation, contrast, warm highs / cool lows, vignette. */
function grade(node: N, vignetteStrength: N): N {
  const c = node;
  const lum = luminance(c.rgb);
  let rgb: N = mix(vec3(lum), c.rgb, float(1.18)); // saturation
  rgb = rgb.sub(0.5).mul(1.07).add(0.5); // contrast
  rgb = rgb.add(vec3(0.03, 0.012, -0.02).mul(lum)).add(vec3(-0.012, 0.0, 0.035).mul(lum.oneMinus().mul(0.6)));
  const d = length(screenUV.sub(vec2(0.5, 0.5)));
  const vig = smoothstep(float(0.98), float(0.35), d);
  const vigMix = mix(float(1.0), vig, vignetteStrength);
  return vec4(rgb.mul(vigMix), 1.0);
}

export class PostStack {
  pipeline: THREE.RenderPipeline;
  /** 0..1 punch amount, decays automatically */
  hit = uniform(0);
  turbo = uniform(0);
  turboTarget = 0;
  private vignette = uniform(0.55);

  constructor(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, s: TierSettings) {
    this.pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    const spec: Record<string, N> = { output };
    if (s.gtao) spec.normal = normalView;
    if (s.traa) spec.velocity = velocity;
    scenePass.setMRT(mrt(spec));
    let color: N = scenePass.getTextureNode('output');
    const depth = scenePass.getTextureNode('depth');
    if (s.gtao) {
      const aoPass = ao(depth, scenePass.getTextureNode('normal'), camera);
      color = color.mul(vec4(vec3(aoPass.getTextureNode().r), 1));
    }
    let img: N = s.traa ? traa(color, depth, scenePass.getTextureNode('velocity'), camera) : fxaa(color);
    if (s.bloom) img = img.add(bloom(img, 0.32, 0.4, 1.0));
    if (s.hitFx) {
      const zoomAmt = this.hit.mul(0.6).add(this.turbo.mul(0.12));
      img = radialZoom(img, zoomAmt);
      img = chromaticAberration(img, this.hit.mul(2.2).add(this.turbo.mul(0.35)), vec2(0.5, 0.5), float(1.1));
    }
    this.pipeline.outputNode = grade(img, this.vignette.add(this.hit.mul(0.4)));
  }

  update(dt: number): void {
    this.hit.value = Math.max(0, this.hit.value - dt * 2.6);
    this.turbo.value += (this.turboTarget - this.turbo.value) * Math.min(1, dt * 6);
  }

  render(): void {
    this.pipeline.render();
  }

  dispose(): void {
    (this.pipeline as unknown as { dispose?: () => void }).dispose?.();
  }
}
