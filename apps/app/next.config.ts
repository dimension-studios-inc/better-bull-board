import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  logging: process.env.ENV === "development" ? false : undefined,
};

export default nextConfig;
