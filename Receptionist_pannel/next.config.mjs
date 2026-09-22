/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static HTML export for Hostinger shared hosting (no Node.js runtime).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // NOTE: the previous `redirects()` block is not supported by `output: "export"`
  // (redirects need a server). The same /dashboard -> /reception/dashboard rules
  // are implemented in public/.htaccess, which ships to Hostinger with the build.
};

export default nextConfig;
