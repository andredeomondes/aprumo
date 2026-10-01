import { defineConfig, devices } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const AI_PORT = 48_000;
const BFF_PORT = 43_000;
const WEB_PORT = 45_173;
const INTERNAL_TOKEN = "aprumo-e2e-token";
const webDir = dirname(fileURLToPath(import.meta.url));
const aiDir = resolve(webDir, "../ai");
const bffDir = resolve(webDir, "../bff");
const python = process.platform === "win32" ? `"${resolve(aiDir, ".venv/Scripts/python.exe")}"` : "python";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["line"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "line",
  use: {
    baseURL: `http://${HOST}:${WEB_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      testIgnore: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /.*\.mobile\.spec\.ts/,
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: [
    {
      command: `${python} -m uvicorn aprumo_ai.main:app --host ${HOST} --port ${AI_PORT}`,
      cwd: aiDir,
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: "",
        APRUMO_INTERNAL_TOKEN: INTERNAL_TOKEN,
        GEMINI_API_KEY: "",
        GROQ_API_KEY: "",
        MISTRAL_API_KEY: "",
        OPENROUTER_API_KEY: "",
      },
      url: `http://${HOST}:${AI_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npx tsx src/server.ts",
      cwd: bffDir,
      env: {
        ...process.env,
        AI_BASE_URL: `http://${HOST}:${AI_PORT}`,
        AI_INTERNAL_TOKEN: INTERNAL_TOKEN,
        CORS_ORIGIN: `http://${HOST}:${WEB_PORT}`,
        DAILY_ANALYSIS_BUDGET: "50",
        HISTORY_DATA_FILE: ":memory:",
        PORT: String(BFF_PORT),
        RATE_LIMIT_PER_MINUTE: "50",
      },
      url: `http://${HOST}:${BFF_PORT}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --host ${HOST} --port ${WEB_PORT}`,
      cwd: webDir,
      env: {
        ...process.env,
        VITE_API_URL: `http://${HOST}:${BFF_PORT}`,
      },
      url: `http://${HOST}:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
