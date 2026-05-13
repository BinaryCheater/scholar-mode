import { describe, expect, it } from "vitest";
import { clampSidebarSplit, clampSidebarWidth } from "../src/lib/sidebarLayout";

describe("sidebar layout constraints", () => {
  it("defaults the session/function split to equal halves", () => {
    expect(clampSidebarSplit(undefined)).toBe(50);
  });

  it("keeps the session/function split inside usable bounds", () => {
    expect(clampSidebarSplit(12)).toBe(24);
    expect(clampSidebarSplit(88)).toBe(76);
    expect(clampSidebarSplit(61)).toBe(61);
  });

  it("keeps the workspace sidebar width inside viewport bounds", () => {
    expect(clampSidebarWidth(100, 1400)).toBe(248);
    expect(clampSidebarWidth(900, 1400)).toBe(560);
    expect(clampSidebarWidth(700, 1000)).toBe(480);
  });
});
