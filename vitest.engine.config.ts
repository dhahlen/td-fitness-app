import { defineConfig } from "vitest/config";

// The engine is pure, so it tests in plain node with no Workers runtime.
export default defineConfig({
  test: {
    name: "engine",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/**/*.api.test.ts"],
  },
});
