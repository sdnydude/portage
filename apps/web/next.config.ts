import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@portage/shared"],
  allowedDevOrigins: ["10.0.0.251"],
  turbopack: {},
  experimental: {
    // The /backend rewrite proxies every API call; Next's default proxy
    // timeout is 30s, which aborts scans that legitimately run 30-40s
    // (two-pass refine + vision-provider fallback). Must stay above the
    // slowest real scan.
    proxyTimeout: 120_000,
  },
  async rewrites() {
    // Same-origin API: the browser talks only to this app's origin, so the
    // Cloudflare Access cookie + Cf-Access-Jwt-Assertion header ride along on
    // every API call with no CORS. The API's self-signed LAN cert (SAN
    // 10.0.0.251) verifies via NODE_EXTRA_CA_CERTS in the container env.
    return [
      {
        source: "/backend/:path*",
        destination: `${process.env.API_INTERNAL_URL ?? "https://10.0.0.251:8016"}/:path*`,
      },
    ];
  },
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
