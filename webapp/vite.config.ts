import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves this as a project site at /unravel-tax/, not the
// domain root - the deploy workflow (.github/workflows/deploy-pages.yml)
// sets GITHUB_PAGES=true for that build only, so `npm run dev`/local
// `npm run build` keep working at the root path unchanged.
const base = process.env.GITHUB_PAGES === "true" ? "/unravel-tax/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
