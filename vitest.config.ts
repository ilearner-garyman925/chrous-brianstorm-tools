import os from "os";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      CHORUS_SKIP_SEED: "1",
      CHORUS_DATA: path.join(os.tmpdir(), "chorus-vitest.json"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
