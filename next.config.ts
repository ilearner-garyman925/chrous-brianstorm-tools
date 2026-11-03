import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The preview browser opens 127.0.0.1 while `next dev` advertises localhost.
  // Without this, Next blocks the dev JS and the pages stay on their loading shell.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
