import { defineConfig, bindings, triggers, exports } from "cf/config";

export default defineConfig({
  accountId: "7570f967f72d784e09771c8e5d6cb860",
  worker: {
    name: "clpanic-writing-room",
    entrypoint: "./src/index.js",
    compatibilityDate: "2026-11-06",
    workersDev: false,
    env: {
      ALLOWED_EMAIL: bindings.text("cl@clpanic.com"),
      ACCESS_ISSUER: bindings.text("https://fikaride.cloudflareaccess.com"),
      ACCESS_AUD: bindings.text(
        "4c26d2752fcc6203c7e0e18f92f3daacc2eb5130bce07c374f4d93b347811437",
      ),
      GITHUB_TOKEN: bindings.secret(),
      PHOTOS: bindings.r2({ name: "clpanic-writing-room-photos" }),
      LIBRARIES: bindings.durableObject({
        worker: "clpanic-writing-room",
        exportName: "WriterLibrary",
      }),
    },
    exports: { WriterLibrary: exports.durableObject({ storage: "sqlite" }) },
    triggers: [
      triggers.fetch({ pattern: "clpanic.com/admin*", zone: "clpanic.com" }),
    ],
    observability: {
      enabled: true,
      redactQueryString: true,
      traces: { enabled: true },
    },
  },
});
