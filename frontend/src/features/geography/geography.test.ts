import { describe, expect, it } from "vitest";
import type { Circuit } from "@/lib/types";
import { countByRegion, displayRegion, distinctRegions } from "@/features/geography/region";
import { project } from "@/features/geography/project";
import { official2026VenueIds } from "@/features/geography/official";
import { venueLabel } from "@/features/geography/venueLabel";

function circuit(over: Partial<Circuit>): Circuit {
  return {
    id: "x",
    name: "X",
    city: "X",
    country: "X",
    country_code: "XX",
    region: "Europe",
    timezone: "UTC",
    latitude: 0,
    longitude: 0,
    fia_license_grade: 1,
    f1_current_2026: false,
    f1_hosted_seasons: [],
    venue_source: "fia_grade1",
    ...over,
  };
}

describe("displayRegion", () => {
  it("maps Americas splits and passes unknowns through", () => {
    expect(displayRegion("North America")).toBe("Americas");
    expect(displayRegion("South America")).toBe("Americas");
    expect(displayRegion("Europe/Asia")).toBe("Europe/Asia");
    expect(displayRegion("Atlantis")).toBe("Atlantis");
  });
});

describe("distinctRegions / countByRegion", () => {
  const lib = [
    circuit({ id: "a", region: "Europe" }),
    circuit({ id: "b", region: "North America" }),
    circuit({ id: "c", region: "South America" }),
    circuit({ id: "d", region: "Asia" }),
  ];
  it("dedupes mapped regions in first-appearance order", () => {
    expect(distinctRegions(lib)).toEqual(["Europe", "Americas", "Asia"]);
  });
  it("aggregates counts under display regions", () => {
    expect(countByRegion(lib)).toEqual([
      { region: "Europe", count: 1 },
      { region: "Americas", count: 2 },
      { region: "Asia", count: 1 },
    ]);
  });
});

describe("venueLabel", () => {
  it("prefers current season, then history, then Grade 1", () => {
    expect(venueLabel(circuit({ f1_current_2026: true }), 2026)).toBe("F1 2026");
    expect(venueLabel(circuit({ f1_current_2026: true }), 2025)).toBe("FIA Grade 1");
    expect(venueLabel(circuit({ f1_hosted_seasons: [2020] }), 2026)).toBe("Former F1 venue");
    expect(venueLabel(circuit({}), 2026)).toBe("FIA Grade 1");
  });

  it("survives legacy payloads without enrichment fields", () => {
    const legacy = circuit({});
    delete (legacy as Partial<Circuit>).f1_hosted_seasons;
    delete (legacy as Partial<Circuit>).f1_current_2026;
    expect(venueLabel(legacy, 2026)).toBe("FIA Grade 1");
  });
});

describe("official2026VenueIds", () => {
  it("selects flagged venues in library order, nothing else", () => {
    const lib = [
      circuit({ id: "b", f1_current_2026: true }),
      circuit({ id: "a", f1_current_2026: false, f1_hosted_seasons: [2020] }),
      circuit({ id: "c", f1_current_2026: true }),
    ];
    expect(official2026VenueIds(lib)).toEqual(["b", "c"]);
  });

  it("orders the real 2026 season chronologically, Melbourne to Yas Marina", () => {
    const lib = ["suzuka", "abu_dhabi", "albert_park", "monza"].map((id) =>
      circuit({ id, f1_current_2026: true }),
    );
    expect(official2026VenueIds(lib)).toEqual(["albert_park", "suzuka", "monza", "abu_dhabi"]);
  });
});

describe("project", () => {
  it("maps bounds and center correctly", () => {
    expect(project(90, -180, 360, 180)).toEqual({ x: 0, y: 0 });
    expect(project(-90, 180, 360, 180)).toEqual({ x: 360, y: 180 });
    expect(project(0, 0, 360, 180)).toEqual({ x: 180, y: 90 });
  });
});
