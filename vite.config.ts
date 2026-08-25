import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// GitHub Pages project sites are served from https://<user>.github.io/<repo>/,
// so the build needs a matching base path. Override with BASE_PATH if you ever
// move to a custom domain or a user/org page (which is served from "/").
const basePath = process.env.BASE_PATH ?? "/TheLeague/";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
