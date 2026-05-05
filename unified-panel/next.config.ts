import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: [],
  experimental: {
    esmExternals: true,
  },
};

export default nextConfig;
