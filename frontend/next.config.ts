import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/ecorace", destination: "/", permanent: true },
      { source: "/ecorace/results/:runId", destination: "/results/:runId", permanent: true },
    ];
  },
};

export default config;
