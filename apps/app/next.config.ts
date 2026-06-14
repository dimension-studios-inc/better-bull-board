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
  serverExternalPackages: [
    "@better-bull-board/core",
    "@better-bull-board/db",
    "@better-bull-board/mcp",
    "pg",
    "pg-connection-string",
    "pgpass",
  ],
};

export default nextConfig;
