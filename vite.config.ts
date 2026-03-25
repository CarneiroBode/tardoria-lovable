import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  const plugins = [react()];

  // lovable-tagger only works inside Lovable's preview environment
  if (mode === "development") {
    try {
      const { componentTagger } = await import("lovable-tagger" as string);
      plugins.push(componentTagger());
    } catch {
      // lovable-tagger not available (e.g. production build or external CI)
    }
  }

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});
