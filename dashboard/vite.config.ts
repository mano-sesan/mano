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
    }),
    !process.env.VITEST ? checker({ typescript: true }) : undefined,
  ],
  build: {
    outDir: "build",
    sourcemap: true,
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    "process.env.SHA": JSON.stringify(process.env.SHA),
  },
});
