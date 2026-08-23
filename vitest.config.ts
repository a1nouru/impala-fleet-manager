import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Scoped to bank-slip: other lib/ tests (if any) use node:test, not vitest.
    include: ["lib/bank-slip/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
});
