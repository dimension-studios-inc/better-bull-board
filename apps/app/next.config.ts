import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    return [
      { source: "/healthz", destination: "/health" },
      { source: "/ping", destination: "/health" },
      { source: "/health/live", destination: "/live" },
    ];
  },
  logging: process.env.ENV === "development" ? false : undefined,
  output: "standalone",
};

export default nextConfig;
