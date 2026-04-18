import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const WORKER_REL = path.join("legacy", "build", "pdf.worker.mjs");

/**
 * Absolute file URL to pdfjs worker (required for fake worker / dynamic import in Node).
 * Tries cwd-based paths first so Docker/standalone resolution matches the deployed layout.
 */
export function resolvePdfWorkerFileUrl(): string {
  const candidates = [
    path.join(process.cwd(), "node_modules", "pdfjs-dist", WORKER_REL),
    path.join(process.cwd(), "public", "pdf.worker.mjs"),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return pathToFileURL(file).href;
    }
  }
  const pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
  return pathToFileURL(path.join(pkgDir, WORKER_REL)).href;
}

let installed = false;

/**
 * pdfjs-dist expects browser globals on `globalThis` in Node. It normally pulls them from
 * `@napi-rs/canvas`, but under Turbopack's external chunks that require can run too late.
 * Call this once before importing `pdf-parse` so globals exist first.
 */
export function ensurePdfNodeGlobals(): void {
  if (installed) return;
  if (typeof globalThis.DOMMatrix !== "undefined") {
    installed = true;
    return;
  }

  try {
    const canvas = require("@napi-rs/canvas") as {
      DOMMatrix: typeof globalThis.DOMMatrix;
      Path2D: typeof globalThis.Path2D;
      ImageData: typeof globalThis.ImageData;
    };

    if (canvas.DOMMatrix) {
      globalThis.DOMMatrix = canvas.DOMMatrix;
    }
    if (typeof globalThis.Path2D === "undefined" && canvas.Path2D) {
      globalThis.Path2D = canvas.Path2D;
    }
    if (typeof globalThis.ImageData === "undefined" && canvas.ImageData) {
      globalThis.ImageData = canvas.ImageData;
    }

    installed = true;
  } catch (e) {
    console.error("ensurePdfNodeGlobals: failed to load @napi-rs/canvas:", e);
    throw e;
  }
}
