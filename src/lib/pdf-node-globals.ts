import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

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
