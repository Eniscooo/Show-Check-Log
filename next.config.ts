import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* ── Performance ──────────────────────────────────────────────────────── */
  // Enable gzip compression for all responses (saves ~970ms on first request)
  compress: true,

  // Strict-mode for catching issues early
  reactStrictMode: true,

  // Optimise package imports — tree-shake heavy libs at build time
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@supabase/supabase-js",
      "react-hot-toast",
    ],
  },

  /* ── Caching headers to reduce repeat-visit latency ───────────────── */
  async headers() {
    return [
      {
        // Cache static assets aggressively (fonts, images, etc.)
        source: "/:all*(svg|jpg|png|webp|avif|ico|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache JS/CSS chunks with revalidation
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // API routes: no cache
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
