import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Allow LAN devices (e.g. phone testing) to use dev HMR.
  allowedDevOrigins: ["10.2.0.2"],
  async redirects() {
    return [
      { source: "/ecorace", destination: "/", permanent: true },
      { source: "/ecorace/results/:runId", destination: "/results/:runId", permanent: true },
    ];
  },
};

export default config;
