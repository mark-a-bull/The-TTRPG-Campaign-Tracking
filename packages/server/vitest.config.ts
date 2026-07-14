import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { DATABASE_URL: "file:../../../data/test.db" },
    globalSetup: ["./test/global-setup.ts"],
    // Test files run in parallel against one shared SQLite file; under load
    // (more test files, more sequential app.inject calls per test) individual
    // battle-heavy tests have been observed taking 4-5s, right at the 5000ms
    // default, causing intermittent unrelated failures.
    testTimeout: 15000,
  },
});
