import { describe, it, expect } from 'vitest';
import { GameState } from '../gamestate';

describe('GameState', () => {
  it('advances time correctly', () => {
    const gs = new GameState();
    expect(gs.hour).toBe(6);
    expect(gs.minute).toBe(0);
    expect(gs.day).toBe(1);

    // Each tick = 10 minutes
    gs.tick();
    expect(gs.minute).toBe(10);

    // 6 ticks = 1 hour
    for (let i = 0; i < 5; i++) gs.tick();
    expect(gs.hour).toBe(7);
    expect(gs.minute).toBe(0);
  });

  it('rolls over days', () => {
    const gs = new GameState();
    gs.hour = 23;
    gs.minute = 50;

    gs.tick(); // 23:00 + 10m = 00:00 next day
    expect(gs.hour).toBe(0);
    expect(gs.minute).toBe(0);
    expect(gs.day).toBe(2);
  });

  it('does not tick when paused', () => {
    const gs = new GameState();
    gs.speed = 0;
    const before = gs.totalTicks;
    gs.tick();
    expect(gs.totalTicks).toBe(before);
  });

  it('detects night correctly', () => {
    const gs = new GameState();
    gs.hour = 12;
    expect(gs.isNight).toBe(false);

    gs.hour = 22;
    expect(gs.isNight).toBe(true);

    gs.hour = 3;
    expect(gs.isNight).toBe(true);

    gs.hour = 6;
    expect(gs.isNight).toBe(false);
  });

  it('calculates daylight smoothly', () => {
    const gs = new GameState();
    gs.hour = 12;
    expect(gs.daylight).toBe(1); // noon = full bright

    gs.hour = 0;
    expect(gs.daylight).toBe(0.25); // midnight = dim

    gs.hour = 6;
    gs.minute = 0;
    expect(gs.daylight).toBeGreaterThan(0.25);
    expect(gs.daylight).toBeLessThan(1);
  });

  it('serializes and deserializes', () => {
    const gs = new GameState();
    gs.day = 5;
    gs.hour = 14;
    gs.minute = 30;

    const json = gs.toJSON() as Record<string, number>;
    const gs2 = new GameState();
    gs2.loadFrom(json);

    expect(gs2.day).toBe(5);
    expect(gs2.hour).toBe(14);
    expect(gs2.minute).toBe(30);
  });
});
