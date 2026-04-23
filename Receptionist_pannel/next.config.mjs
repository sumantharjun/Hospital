/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/dashboard", destination: "/reception/dashboard", permanent: false },
      { source: "/patients", destination: "/reception/patients", permanent: false },
      { source: "/appointments", destination: "/reception/appointments", permanent: false },
      { source: "/billing", destination: "/reception/billing", permanent: false },
      { source: "/history", destination: "/reception/history", permanent: false },
      { source: "/receipts", destination: "/reception/receipts", permanent: false },
      { source: "/reports", destination: "/reception/reports", permanent: false },
      { source: "/payments", destination: "/reception/payments", permanent: false },
      { source: "/invoices", destination: "/reception/invoices", permanent: false },
      { source: "/prescriptions", destination: "/reception/prescriptions", permanent: false },
    ];
  },
};

export default nextConfig;
