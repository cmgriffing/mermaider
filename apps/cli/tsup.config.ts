import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  splitting: false,
  sourcemap: true,
  clean: true,
  noExternal: ["@mermaider/core", "@mermaid-js/mermaid-cli"],
});
