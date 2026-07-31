import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output — the Dockerfile copies only .next/standalone (a
  // pruned node_modules + server.js), not the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
