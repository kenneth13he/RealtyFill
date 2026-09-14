// next.config.ts
// No custom config needed yet. Once lib/pdfFill.ts's "shell out to Python vs.
// port to pdf-lib" decision (see docs/PROJECT_STRUCTURE.md) lands on "shell
// out," this file may need `serverExternalPackages` or similar so the Python
// scripts under ./scripts aren't bundled by the Next.js build.

import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
