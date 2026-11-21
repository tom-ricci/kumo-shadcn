import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // The page lives at / next to the registry's /r/*; its files go to /assets/.
  build: { outDir: "dist", assetsDir: "assets", emptyOutDir: true },
});
