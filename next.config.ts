import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.APP_RUNTIME_TEST === "1" ? ".next-runtime-test" : ".next",
  reactStrictMode: true,
  async headers() {
    return [{ source: "/api/:path*", headers: [
      { key: "Cache-Control", value: "no-store" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ] }];
  },
};

export default nextConfig;
