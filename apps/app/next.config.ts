import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  rewrites: async () => {
    return [
      { source: "/healthz", destination: "/health" },
      { source: "/ping", destination: "/health" },
    ];
  },
  logging: process.env.ENV === "development" ? false : undefined,
  output: "standalone",
};

export default nextConfig;
