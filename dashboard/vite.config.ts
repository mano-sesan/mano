import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import checker from "vite-plugin-checker";
import fs from "fs";
// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    sentryVitePlugin({
      org: "mano-20",
      project: "mano-espace",
      telemetry: false,
      disable: Boolean(process.env.CI),
      debug: true,
      authToken: process.env.SENTRY_AUTH_TOKEN_FILE
        ? fs.readFileSync(process.env.SENTRY_AUTH_TOKEN_FILE, "utf8").trim().replace(/\n/g, "")
        : undefined,
    }),
    !process.env.VITEST ? checker({ typescript: true }) : undefined,
  ],
  build: {
    outDir: "build",
    sourcemap: true,
  },
  define: {
    "process.env": process.env,
  },
});
