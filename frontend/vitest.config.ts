import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => {
  const tsconfigPaths = await import("vite-tsconfig-paths");
  return {
    plugins: [react(), tsconfigPaths.default()],
    test: {
      environment: "node",
      globals: true,
    },
  };
});
