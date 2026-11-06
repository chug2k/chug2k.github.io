import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-plugin";

export default defineConfig({
  plugins: [
    cloudflareTest({
      config: false,
      main: "./src/index.js",
      miniflare: {
        compatibilityDate: "2026-11-06",
        compatibilityFlags: ["nodejs_compat"],
        durableObjects: {
          LIBRARIES: { className: "WriterLibrary", useSQLite: true },
        },
        r2Buckets: ["PHOTOS"],
        bindings: {
          ALLOWED_EMAIL: "cl@clpanic.com",
          ACCESS_ISSUER: "https://writer-test.cloudflareaccess.com",
          ACCESS_AUD: "test-audience",
          GITHUB_TOKEN: "mock-github-token",
        },
      },
    }),
  ],
  test: { include: ["test/**/*.test.js"] },
});
