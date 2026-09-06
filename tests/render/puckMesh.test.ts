import { describe, expect, it } from 'vitest';
import { Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three/webgpu';
import { PuckMesh } from '../../src/render/puckMesh';
import { makePuck } from '../../src/sim/puck';

describe('loose puck locator', () => {
  it('layers a contrast outline and ring without making the physical puck see-through', () => {
    const view = new PuckMesh();
    const outline = view.glow.children[0] as Mesh;
    expect((view.mesh.material as MeshStandardMaterial).depthTest).toBe(true);
    expect((view.glow.material as MeshBasicMaterial).depthTest).toBe(false);
    expect((outline.material as MeshBasicMaterial).depthTest).toBe(false);
    expect(outline.renderOrder).toBeLessThan(view.glow.renderOrder);
    expect((outline.material as MeshBasicMaterial).color.getHex()).not.toBe((view.glow.material as MeshBasicMaterial).color.getHex());
  });
  it('tracks the interpolated ice position and hides the whole cue during possession', () => {
    const view = new PuckMesh(), puck = makePuck();
    puck.pos = { x: 2, y: 4 }; view.snap(puck);
    puck.pos = { x: 6, y: 8 }; puck.z = 1; view.snapshot(puck);
    view.update(puck, 0.5, 0);
    expect(view.glow.position.x).toBe(4);
    expect(view.glow.position.z).toBe(6);
    expect(view.glow.position.y).toBe(0.012);
    expect(view.mesh.position.y).toBe(0.53);
    expect(view.glow.visible).toBe(true);
    puck.owner = 'carrier'; view.update(puck, 1, 0);
    expect(view.glow.visible).toBe(false);
    expect(view.mesh.visible).toBe(true);
  });
});
