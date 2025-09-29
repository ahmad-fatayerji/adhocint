import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensures `npm run build` creates a self-contained .next/standalone folder
  output: "standalone",

  reactStrictMode: true,

  // Optional: enable SWC minification for smaller bundles
  swcMinify: true,
};

export default nextConfig;
