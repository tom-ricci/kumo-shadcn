import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { kumoFromRegistry } from "./vite-dev-registry.ts";

export default defineConfig(({ command }) => ({
  // The dev server has no installed Kumo components; see vite-dev-registry.ts.
  plugins: [command === "serve" && kumoFromRegistry(), react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // The page lives at / next to the registry's /r/*; its files go to /assets/.
  build: { outDir: "dist", assetsDir: "assets", emptyOutDir: true },
}));
