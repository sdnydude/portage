import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@portage/shared"],
  allowedDevOrigins: ["10.0.0.251"],
  turbopack: {},
  experimental: {
    // Next's default, written explicitly as a product decision (2026-07-10):
    // users abandon after ~20-30s, so a request that needs longer is already
    // failed UX — fix the latency, don't raise the timeout. Scans exceeding
    // this die as errors; keep them fast (Gemini billed: 4-12s typical).
    proxyTimeout: 30_000,
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
      {
        // Same-origin item photos: the R2 public domain sends no CORS headers,
        // which taints any canvas capture (preview PNG share). Proxying the
        // public bucket through the app origin sidesteps CORS entirely.
        source: "/img-cdn/:path*",
        destination: "https://portage-images.digitalharmonyai.com/:path*",
      },
    ];
  },
  async redirects() {
    // The password-auth routes were deleted in the CF Access migration, but
    // stale entry points (bookmarks, CF app-launcher targets, password
    // managers) still request them; CF authenticates and returns the browser
    // to the original URL, which 404'd. Send every stale entry home.
    return [
      { source: "/login", destination: "/home", permanent: true },
      { source: "/register", destination: "/home", permanent: true },
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
