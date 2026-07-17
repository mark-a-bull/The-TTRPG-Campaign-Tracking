import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  timeout: 30000,
  // Settings (dark-mode.spec.ts, settings-migration.spec.ts) is a single
  // global server-side record, not scoped per-test like every other entity
  // in this app -- running spec files in parallel workers let them race and
  // clobber each other's writes to that one shared row. Small suite, so
  // trading some speed for determinism here is worth it.
  workers: 1,
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
