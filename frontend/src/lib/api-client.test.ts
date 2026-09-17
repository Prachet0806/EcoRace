import { afterEach, describe, expect, it, vi } from "vitest";
import { EcoRaceApiError, api } from "@/lib/api-client";

function mockFetchOnce(status: number, body: unknown) {
  const mock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api-client contract", () => {
  it("GETs the circuit library", async () => {
    const mock = mockFetchOnce(200, { circuits: [], count: 0, dataset_version: "v" });
    const out = await api.circuits();
    expect(mock).toHaveBeenCalledWith("http://localhost:8000/api/v1/circuits", expect.anything());
    expect(out.count).toBe(0);
  });

  it("POSTs runs with the frozen DTO shape", async () => {
    const mock = mockFetchOnce(200, { run_id: "run_x" });
    await api.createRun({ race_count: 20, circuit_ids: ["a"], season_year: 2026 });
    const [url, init] = mock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8000/api/v1/optimization/runs");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ race_count: 20, circuit_ids: ["a"], season_year: 2026 });
  });

  it("maps the error envelope to EcoRaceApiError codes", async () => {
    mockFetchOnce(422, { error: { code: "INSUFFICIENT_CIRCUITS", message: "short", details: [] } });
    const err = await api.createRun({ race_count: 22, circuit_ids: ["a"], season_year: 2026 }).catch((e) => e);
    expect(err).toBeInstanceOf(EcoRaceApiError);
    expect((err as EcoRaceApiError).code).toBe("INSUFFICIENT_CIRCUITS");
  });

  it("GETs a run by id", async () => {
    const mock = mockFetchOnce(200, { run_id: "run_1" });
    await api.getRun("run_1");
    expect(mock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/optimization/runs/run_1",
      expect.anything(),
    );
  });
});
