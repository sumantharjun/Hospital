import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export for Hostinger shared hosting (no Node.js runtime).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  experimental: {
    esmExternals: true,
  },
};

export default nextConfig;
