import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // pdfjs-dist polyfills DOMMatrix from @napi-rs/canvas via dynamic require; bundling breaks that in Route Handlers.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],
  // pdf.worker.mjs is loaded via dynamic import and is not traced by default; standalone/Docker would miss it otherwise.
  outputFileTracingIncludes: {
    "/api/upload": [
      "./node_modules/pdfjs-dist/**/*",
      "./node_modules/pdf-parse/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
};

export default nextConfig;
