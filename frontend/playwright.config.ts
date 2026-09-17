import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 240_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3100",
  },
  webServer: [
    {
      command: "python -m uvicorn ecorace.interface.http.app:app --port 8000",
      cwd: "..",
      env: {
        PYTHONPATH: "backend/src",
        SOLVER_TIMEOUT_SECONDS: "9",
        ECORACE_CORS_ORIGINS: "http://localhost:3100",
      },
      url: "http://localhost:8000/api/v1/health",
      timeout: 60_000,
      reuseExistingServer: true,
    },
    {
      command: "npm run start -- --port 3100",
      url: "http://localhost:3100/",
      timeout: 120_000,
      reuseExistingServer: true,
    },
  ],
});
