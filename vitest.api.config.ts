import { defineWorkersProject, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

// Route tests need D1, so they run in workerd against a real local database
// with the schema applied. Bindings are declared here rather than read from
// wrangler.jsonc so the tests do not depend on a provisioned database id.
export default defineWorkersProject(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "schema"));

  return {
    test: {
      name: "api",
      globals: true,
      include: ["tests/**/*.api.test.ts"],
      setupFiles: ["./tests/apply-migrations.ts"],
      poolOptions: {
        workers: {
          isolatedStorage: true,
          miniflare: {
            // Pinned to what the bundled workerd supports. The deployed date
            // lives in wrangler.jsonc and is not this.
            compatibilityDate: "2024-12-30",
            compatibilityFlags: ["nodejs_compat"],
            d1Databases: { DB: "program-engine-test" },
            bindings: { TEST_MIGRATIONS: migrations, COACH_API_KEY: "test-key" },
          },
        },
      },
    },
  };
});
