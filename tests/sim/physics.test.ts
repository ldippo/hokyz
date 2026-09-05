import { describe, expect, it } from 'vitest';
import { boardsSdf, boardsNormal, clampToRink, inNetBox, GOALS } from '../../src/sim/rink';
import { collideBoards, collidePuckNet, collideSkaters } from '../../src/sim/physics';
import { RINK, PUCK } from '../../src/sim/constants';
import { makeSkater } from '../../src/sim/skater';
import { makePuck } from '../../src/sim/puck';
import { stats } from '../../src/sim/fixtures';

describe('rink geometry', () => {
  it('center is inside, far corner is outside', () => {
    expect(boardsSdf({ x: 0, y: 0 })).toBeLessThan(0);
    expect(boardsSdf({ x: RINK.length / 2, y: RINK.width / 2 })).toBeGreaterThan(0);
  });
  it('normal points inward at side board', () => {
    const n = boardsNormal({ x: 0, y: RINK.width / 2 });
    expect(n.y).toBeLessThan(0);
    expect(Math.abs(n.x)).toBeLessThan(1e-6);
  });
  it('clampToRink pushes outside points inside', () => {
    const p = clampToRink({ x: 100, y: 0 }, 0.5);
    expect(boardsSdf(p)).toBeLessThanOrEqual(-0.5 + 1e-6);
  });
  it('net box detection', () => {
    const g = GOALS[1];
    expect(inNetBox({ x: g.lineX + 0.5, y: 0 }, g)).toBe(true);
    expect(inNetBox({ x: g.lineX - 0.5, y: 0 }, g)).toBe(false);
  });
});

describe('board collision', () => {
  it('reflects velocity and returns impact speed', () => {
    const pos = { x: 0, y: RINK.width / 2 + 0.1 };
    const vel = { x: 2, y: 10 };
    const hit = collideBoards(pos, vel, 0.2, 0.5, 1);
    expect(hit).toBeGreaterThan(9);
    expect(vel.y).toBeLessThan(0);
    expect(boardsSdf(pos)).toBeLessThanOrEqual(-0.2 + 1e-6);
  });
  it('no collision when inside', () => {
    const vel = { x: 1, y: 1 };
    expect(collideBoards({ x: 0, y: 0 }, vel, 0.5, 0.5, 1)).toBe(0);
    expect(vel).toEqual({ x: 1, y: 1 });
  });
});

describe('puck vs net', () => {
  it('puck hitting a post bounces', () => {
    const p = makePuck();
    const post = GOALS[1].posts[0];
    p.pos = { x: post.x - 0.1, y: post.y + 0.02 };
    p.vel = { x: 20, y: 0 };
    const r = collidePuckNet(p);
    expect(r).toBe('post');
    expect(p.vel.x).toBeLessThan(0);
  });
  it('puck inside net is damped and contained', () => {
    const p = makePuck();
    const g = GOALS[1];
    p.pos = { x: g.backX - 0.05, y: 0 };
    p.vel = { x: 30, y: 0 };
    collidePuckNet(p);
    expect(p.pos.x).toBeLessThanOrEqual(g.backX - PUCK.radius + 1e-6);
    expect(Math.abs(p.vel.x)).toBeLessThan(30);
    void PUCK;
  });
});

describe('skater collision', () => {
  it('separates overlapping skaters', () => {
    const a = makeSkater('a', 'A', 0, stats(5, 5, 5, 5, 5, 5), 'sniper', false);
    const b = makeSkater('b', 'B', 1, stats(5, 5, 5, 5, 5, 5), 'sniper', false);
    a.pos = { x: 0, y: 0 };
    b.pos = { x: 0.3, y: 0 };
    collideSkaters(a, b);
    expect(b.pos.x - a.pos.x).toBeGreaterThanOrEqual(a.radius + b.radius - 1e-6);
  });
});
