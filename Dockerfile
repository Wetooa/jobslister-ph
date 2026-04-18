# syntax=docker/dockerfile:1

# --- Dependencies (reproducible install) ---
FROM node:20-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

# --- Build Next.js standalone bundle ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Production runtime: Chromium + system libs match Playwright in package.json ---
FROM mcr.microsoft.com/playwright:v1.58.2-jammy AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Official Playwright image ships browsers here; keeps npm `playwright` aligned with installed Chromium.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./
# Ensure pdfjs worker + wasm assets exist (Turbopack trace can omit dynamically imported files).
RUN mkdir -p /app/node_modules
COPY --from=builder /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist
# Fallback path for worker resolution (see resolvePdfWorkerFileUrl + public/ candidate).
COPY --from=builder /app/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs /app/public/pdf.worker.mjs

RUN mkdir -p /app/data && chown -R pwuser:pwuser /app

USER pwuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
