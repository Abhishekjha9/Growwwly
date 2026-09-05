import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Website Intelligence (Phase 3) shells out to real Node tooling —
  // Playwright's browser automation and Lighthouse's own dynamic
  // `import()`-based module loading. Neither is meant to be statically
  // bundled; left external, they resolve normally through node_modules at
  // request time instead of tripping the bundler's static analysis.
  serverExternalPackages: ["playwright", "playwright-core", "lighthouse", "chrome-launcher"],
};

export default nextConfig;
