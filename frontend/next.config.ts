import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/admin', destination: '/', permanent: false },
      { source: '/machines', destination: '/', permanent: false },
      { source: '/vend/:id*', destination: '/', permanent: false },
      { source: '/login', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
