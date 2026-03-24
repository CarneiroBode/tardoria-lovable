import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

let tagger: any;
try {
  tagger = await import("lovable-tagger").then(m => m.componentTagger);
} catch {}

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && tagger?.()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
