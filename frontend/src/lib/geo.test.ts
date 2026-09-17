import { describe, expect, it } from "vitest";
import { greatCirclePoints } from "@/lib/geo";

describe("greatCirclePoints", () => {
  it("returns exact endpoints", () => {
    const pts = greatCirclePoints(45.6156, 9.2811, 52.0786, -1.0169, 10);
    expect(pts).toHaveLength(11);
    expect(pts[0][0]).toBeCloseTo(9.2811, 9);
    expect(pts[0][1]).toBeCloseTo(45.6156, 9);
    expect(pts[10][0]).toBeCloseTo(-1.0169, 9);
    expect(pts[10][1]).toBeCloseTo(52.0786, 9);
  });

  it("collapses identical points", () => {
    expect(greatCirclePoints(0, 0, 0, 0)).toEqual([[0, 0]]);
  });

  it("bulges off the straight chord (northern route arches north)", () => {
    const pts = greatCirclePoints(43.7, 7.4, 35.4, 138.9, 50); // monaco -> fuji
    const mid = pts[25];
    expect(mid[1]).toBeGreaterThan((43.7 + 35.4) / 2);
  });
});
