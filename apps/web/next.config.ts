import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@portage/shared"],
  allowedDevOrigins: ["10.0.0.251"],
  turbopack: {},
  async headers() {
    return [
      {
        // All app pages should not be CDN-cached — they require auth and user-specific data
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  webpack: (config) => {
    config.watchOptions = {
      poll: 1000,
      aggregateTimeout: 300,
    };
    return config;
  },
};

export default nextConfig;
