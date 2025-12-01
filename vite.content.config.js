import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/content",
    emptyOutDir: false,
    minify: true,
    rollupOptions: {
      input: resolve(__dirname, "src/content/index.jsx"),
      output: {
        entryFileNames: "index.js",
        format: "iife",
        inlineDynamicImports: true   // ⭐ VERY IMPORTANT
      }
    }
  }
});


