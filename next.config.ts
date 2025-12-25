import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensures `npm run build` creates a self-contained .next/standalone folder
  output: "standalone",

  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "s3.adhocint.com" },
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
    ],
  },

};

export default nextConfig;
