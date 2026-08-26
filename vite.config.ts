import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// GitHub Pages organization/user sites are served from the domain root.
// BASE_PATH can still override this for another deployment target.
const basePath = process.env.BASE_PATH ?? "/";

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
