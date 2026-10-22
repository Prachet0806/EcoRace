import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
  testDir: "./e2e",
  timeout: 240_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
  },
  webServer: [
    {
      command: process.env.ECORACE_UVICORN_COMMAND ?? "python -m uvicorn ecorace.interface.http.app:app --port 8000",
      cwd: "..",
      env: {
        PYTHONPATH: "backend/src",
        SOLVER_TIMEOUT_SECONDS: "9",
        ECORACE_CORS_ORIGINS: "http://localhost:3100",
        ECORACE_DB_PATH: join(tmpdir(), `ecorace-e2e-${process.pid}.db`),
      },
      url: "http://localhost:8000/api/v1/health",
      timeout: 60_000,
      reuseExistingServer: false,
    },
    {
      command: process.env.ECORACE_NEXT_COMMAND ?? "npm run start -- --port 3100",
      url: "http://localhost:3100/",
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
