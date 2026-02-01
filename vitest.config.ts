import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["app/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "build", ".cache"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["app/services/**", "app/lib/**", "app/hooks/**"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "node_modules/**"],
    },
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
});
