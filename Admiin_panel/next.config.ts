import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: [],
  experimental: {
    esmExternals: true,
  },
};

export default nextConfig;
