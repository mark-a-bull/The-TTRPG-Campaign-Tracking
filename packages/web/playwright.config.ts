import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
  },
  webServer: {
    command: "pnpm dev",
    port: 5173,
    reuseExistingServer: true,
  },
});
