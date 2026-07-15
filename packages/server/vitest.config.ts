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
    // Setup-heavy beforeAll hooks (e.g. campaign-transfer.test.ts's, which
    // does ~15 sequential app.inject calls to build a full campaign) hit the
    // same load-driven slowness as individual tests above; the default
    // hookTimeout wasn't bumped alongside testTimeout, so it kept failing
    // independently under load.
    hookTimeout: 15000,
  },
});
