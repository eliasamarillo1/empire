import { defineConfig } from "vite";

export default defineConfig({
  // Rutas relativas para que el build funcione dentro de Capacitor y en cualquier carpeta
  base: "./",
  server: { host: true },
  build: { chunkSizeWarningLimit: 1600 },
});
