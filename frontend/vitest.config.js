import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/__tests__/**/*.test.{js,jsx}", "src/**/*.test.{js,jsx}"],
    exclude: ["src/__tests__/RoleIndicator.integration.test.js", "node_modules", "dist"],
  },
});
