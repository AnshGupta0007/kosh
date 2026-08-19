import path from "node:path";

import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // This app is the tracing root. Without it Next walks up looking for a
  // lockfile, finds an unrelated one outside the repo, and warns on every
  // build while tracing files it should not care about.
  outputFileTracingRoot: path.join(__dirname),
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};

export default config;
