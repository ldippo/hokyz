import { describe, expect, it } from 'vitest';
import { Crowd } from '../../src/render/crowd';

describe('crowd celebration lifecycle', () => {
  it('stays idle until triggered, finishes, and can restart', () => {
    const crowd = new Crowd([0x2f6bff], true);
    expect(crowd.waveActive.value).toBe(0);
    crowd.update(20, 0);
    expect(crowd.waveActive.value).toBe(0);
    crowd.startWave();
    expect(crowd.waveActive.value).toBe(1);
    expect(crowd.wave.value).toBe(0);
    crowd.update(2, 0);
    const progress = crowd.wave.value;
    crowd.startWave();
    expect(crowd.wave.value).toBe(progress);
    crowd.update(10, 0);
    expect(crowd.waveActive.value).toBe(0);
    crowd.startWave();
    expect(crowd.wave.value).toBe(0);
    expect(crowd.waveActive.value).toBe(1);
  });
  it('omits all shader motion when crowd animation is disabled', () => {
    const crowd = new Crowd([0x2f6bff], false);
    crowd.startWave(); crowd.update(1, 1);
    for (const mesh of crowd.meshes) expect((mesh.material as { positionNode?: unknown }).positionNode).toBeNull();
  });
});
