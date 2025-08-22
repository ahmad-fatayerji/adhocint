import type { NextConfig } from "next";

// Allow loading the dev site (/_next assets) from other origins (e.g. LAN IP, external interface)
// This ONLY applies in development. In production you should rely on normal same-origin policies.
// You were seeing warnings because you visited the site via http://192.168.x.x:3000 or another IP
// which is a different origin than http://localhost:3000, so Next.js blocked internal asset requests.
// Setting allowedDevOrigins: true disables that protection for dev convenience.
// Note: Next.js expects an array of origins (scheme + host + optional port).
// We include localhost plus typical LAN patterns you might use.
const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    // Add your LAN IP(s) below (example):
    'http://192.168.1.15:3000',
    'http://26.104.41.170:3000'
  ]
};

export default nextConfig;
