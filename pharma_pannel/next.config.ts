import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    esmExternals: true,
  },
};

export default nextConfig;
