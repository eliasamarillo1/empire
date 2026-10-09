import { defineConfig } from "vite";

export default defineConfig({
  // Rutas relativas para que el build funcione dentro de Capacitor y en cualquier carpeta
  base: "./",
  // En desarrollo, /api va al servidor de apps/server
  server: { host: true, proxy: { "/api": "http://localhost:3000" } },
  preview: { proxy: { "/api": "http://localhost:3000" } },
  build: { chunkSizeWarningLimit: 1600 },
});
