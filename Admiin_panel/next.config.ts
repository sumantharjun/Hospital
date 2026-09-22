import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export for Hostinger shared hosting (no Node.js runtime).
  // `next build` emits a self-contained ./out directory.
  output: "export",
  // Emits dashboard/index.html instead of dashboard.html, so Apache/LiteSpeed
  // serves clean URLs via DirectoryIndex without any rewrite rules.
  trailingSlash: true,
  // The Next image optimizer needs a server; serve the originals instead.
  images: { unoptimized: true },
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: [],
  experimental: {
    esmExternals: true,
  },
};

export default nextConfig;
