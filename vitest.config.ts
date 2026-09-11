import { defineConfig } from "vitest/config";

// The engine is pure, so it tests in plain node with no Workers runtime.
// When you add route tests that touch D1, install @cloudflare/vitest-pool-workers
// and swap this for defineWorkersConfig with poolOptions.workers.wrangler.
export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
