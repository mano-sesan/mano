import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import checker from "vite-plugin-checker";
import eslint from "vite-plugin-eslint";

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    sentryVitePlugin({
      org: "mano-20",
      project: "mano-espace",
      telemetry: false,
      disable: !process.env.CI,
    }),
    eslint(),
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
