import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensures `npm run build` creates a self-contained .next/standalone folder
  output: "standalone",

  reactStrictMode: true,

};

export default nextConfig;
