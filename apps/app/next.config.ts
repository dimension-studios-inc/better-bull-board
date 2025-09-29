import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: process.env.ENV === "development" ? false : undefined,
  output: "standalone",
};

export default nextConfig;
