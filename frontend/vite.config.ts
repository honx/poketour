import { defineConfig } from "vite";

// All game logic runs in-process now (see src/api.ts → src/game/*). No
// backend proxy needed for dev. The Tauri build uses dist/ as the asset
// root via tauri.conf.json.
export default defineConfig({
  server: { port: 5173 },
  // Tauri serves files relative to the bundle root, so use ./ asset paths.
  base: "./",
});
