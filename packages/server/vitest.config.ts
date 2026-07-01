import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: { DATABASE_URL: "file:../../../data/test.db" },
    globalSetup: ["./test/global-setup.ts"],
  },
});
