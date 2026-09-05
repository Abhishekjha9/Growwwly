import { describe, expect, it } from "vitest";
import { CHANNEL_BASE_EFFORT, CHANNEL_WEIGHTS } from "../constants";
import { CHANNELS } from "../types";

describe("CHANNEL_WEIGHTS", () => {
  it("covers exactly the eight canonical channels", () => {
    expect(Object.keys(CHANNEL_WEIGHTS).sort()).toEqual([...CHANNELS].sort());
  });

  it.each(CHANNELS)("%s's weights sum to 1", (channel) => {
    const total = CHANNEL_WEIGHTS[channel].reduce((sum, w) => sum + w.weight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it.each(CHANNELS)("%s has no duplicate signal terms", (channel) => {
    const signals = CHANNEL_WEIGHTS[channel].map((w) => w.signal);
    expect(new Set(signals).size).toBe(signals.length);
  });
});

describe("CHANNEL_BASE_EFFORT", () => {
  it("assigns a 1-5 effort level to every channel", () => {
    for (const channel of CHANNELS) {
      expect(CHANNEL_BASE_EFFORT[channel]).toBeGreaterThanOrEqual(1);
      expect(CHANNEL_BASE_EFFORT[channel]).toBeLessThanOrEqual(5);
    }
  });
});
