/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export for Hostinger shared hosting (no Node.js runtime).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
