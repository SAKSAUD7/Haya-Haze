import type { NextConfig } from "next";

const backend = (process.env.API_INTERNAL_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const backendUrl = new URL(backend);

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: import.meta.dirname,
  poweredByHeader: false,
  // Django URLs end in a slash; do not let Next.js strip it before proxying.
  skipTrailingSlashRedirect: true,
  images: {
    // Small hosts (Render free plan, 512 MB) can run out of memory resizing many photos at
    // once. Set NEXT_IMAGE_UNOPTIMIZED=1 there to serve the (already WebP) originals as-is.
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "1",
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: backendUrl.protocol.replace(":", "") as "http" | "https",
        hostname: backendUrl.hostname,
        port: backendUrl.port,
        pathname: "/media/**",
      },
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
    ],
  },
  // The browser only ever talks to this origin. API and media are proxied to Django,
  // which keeps auth/cart cookies first-party and lets WebGL load textures without CORS.
  async rewrites() {
    return [
      { source: "/api/:path*/", destination: `${backend}/api/:path*/` },
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/media/:path*", destination: `${backend}/media/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "@react-three/drei"],
  },
};

export default config;
