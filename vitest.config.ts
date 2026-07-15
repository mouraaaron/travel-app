import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__dirname, "src") }],
  },
  test: {
    environment: "node",
    exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/.claude/worktrees/**", "**/.next/**"],
  },
});
