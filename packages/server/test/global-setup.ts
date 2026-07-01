import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default function setup() {
  execSync("npx prisma migrate deploy", {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: "file:../../../data/test.db" },
    stdio: "inherit",
  });
}
