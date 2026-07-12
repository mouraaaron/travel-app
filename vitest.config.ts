import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__dirname, "src") }],
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/.next/**"],
  },
});
