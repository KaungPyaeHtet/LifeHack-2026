import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root; a stray yarn.lock in the home dir otherwise wins.
  turbopack: { root: __dirname },
  /* config options here */
};

export default nextConfig;
