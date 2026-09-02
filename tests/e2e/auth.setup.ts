import { test as setup } from "@playwright/test";
import { execFileSync } from "node:child_process";

setup("seed a database session", () => {
  execFileSync("pnpm", ["exec", "tsx", "tests/e2e/seed-session.ts"], {
    stdio: "inherit",
    cwd: process.cwd(),
  });
});
