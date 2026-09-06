import * as THREE from 'three/webgpu';
import type { App } from '../app';
import { makeSkater, stickPoint } from '../sim/skater';
import { makePuck } from '../sim/puck';
import { PuckMesh } from './puckMesh';
import { stats } from '../sim/fixtures';
import { SkaterRig, jerseySpecFor, loadRigs } from './skaterRig';
import { RinkMesh } from './rinkMesh';

export type Pose = 'idle' | 'skate' | 'turbo' | 'lunge' | 'down' | 'charge' | 'butterfly' | 'celebrate' | 'deke';

/** Debug viewer: ?rigview=1&pose=skate&cam=front|side|back|iso */
export async function startRigViewer(app: App): Promise<void> {
  const params = new URLSearchParams(location.search);
  const poses = (params.get('poses') ?? params.get('pose') ?? 'idle,skate,turbo,lunge,charge,down,celebrate').split(',') as Pose[];
  const camMode = params.get('cam') ?? 'iso';
  const facing = Number(params.get('facing') ?? '0');
  const tpl = await loadRigs();
  const rinkMesh = new RinkMesh();
  app.rig.scene.add(rinkMesh.group);
  const spacing = 1.7;
  const entries = poses.map((pose, i) => {
    const st = makeSkater('viewer' + i, 'Viewer', 0, stats(7, 7, 7, 7, 7, 7), 'sniper', false);
    st.pos = { x: 0, y: (i - (poses.length - 1) / 2) * spacing };
    st.facing = facing;
    const spec = jerseySpecFor('#2f6bff', 0, 'Iron Elks', 'IE', 88, 'Bricker');
    const rig = new SkaterRig('viewer' + i, tpl.skater, false, spec);
    rig.snap(st);
    app.rig.scene.add(rig.group);
    return { pose, st, rig };
  });
  const gState = makeSkater('viewerG', 'ViewerG', 1, stats(5, 5, 6, 5, 8, 6), 'goalie', true);
  gState.pos = { x: -1.8, y: 0 };
  gState.facing = facing;
  const gspec = jerseySpecFor('#ff2d3a', 1, 'Bayside Bruisers', 'BB', 31, 'Wall');
  const grig = new SkaterRig('viewerG', tpl.goalie, true, gspec);
  grig.snap(gState);
  app.rig.scene.add(grig.group);
  const gpose = params.get('goalie') ?? 'idle';
  const cam = app.rig.camera;
  const look = new THREE.Vector3(-0.5, 0.9, 0);
  const width = poses.length * spacing;
  const camPos: Record<string, THREE.Vector3> = {
    iso: new THREE.Vector3(width * 0.55 + 2, 2.4, width * 0.45 + 2),
    front: new THREE.Vector3(width * 0.9 + 1, 1.3, 0),
    side: new THREE.Vector3(0.2, 1.3, width * 0.9 + 1),
    back: new THREE.Vector3(-(width * 0.9 + 1), 1.4, 0),
  };
  cam.position.copy(camPos[camMode] ?? camPos.iso);
  cam.lookAt(look);
  let t = 0;
  let celebrated = false;
  app.loop.stop();
  const capture = params.has('capture');
  const tick = (draw = true) => {
    const dt = 1 / 60;
    t += dt;
    gState.butterfly = gpose === 'butterfly' ? 1 : 0;
    for (const { pose, st: skState, rig } of entries) {
    skState.vel = { x: 0, y: 0 };
    skState.turboActive = false;
    skState.lunge = 0;
    skState.knockdown = 0;
    skState.charging = false;
    skState.deke = 0;
    switch (pose) {
      case 'skate':
        skState.vel = { x: 6, y: 0 };
        break;
      case 'turbo':
        skState.vel = { x: 12, y: 0 };
        skState.turboActive = true;
        skState.onFire = 10;
        break;
      case 'lunge':
        skState.vel = { x: 13, y: 0 };
        skState.lunge = 0.2;
        break;
      case 'down':
        skState.knockdown = 1;
        break;
      case 'charge':
        skState.charging = true;
        skState.shotCharge = 0.5 + 0.5 * Math.sin(t * 2);
        skState.hasPuck = true;
        break;
      case 'butterfly':
        gState.butterfly = 1;
        break;
      case 'celebrate':
        if (!celebrated) {
          rig.celebrate();
          celebrated = true;
        }
        if (t > 1.5) {
          celebrated = false;
          t = 0;
        }
        break;
      case 'deke':
        skState.deke = 0.3;
        skState.vel = { x: 5, y: 0 };
        break;
      default:
        break;
    }
    skState.controlled = pose === 'idle';
    rig.lookAt(skState, 5, 3);
    rig.update(skState, 1, dt, t);
    }
    grig.update(gState, 1, dt, t);
    if (draw) app.rig.render(dt);
    if (!capture) requestAnimationFrame(() => tick());
  };
  if (capture) for (let i = 0; i < 45; i++) tick(false);
  tick();
  const puck = params.has('puck') ? new PuckMesh() : null;
  puck?.addTo(app.rig.scene);
  const placePuck = (sk: typeof entries[number]['st']) => {
    const state = makePuck(); state.pos = stickPoint(sk); state.owner = sk.id;
    puck?.snap(state); puck?.update(state, 1, 0, true);
    return state.pos;
  };
  (window as unknown as { __rigview: unknown }).__rigview = { entries, grig, gState, placePuck };
}
