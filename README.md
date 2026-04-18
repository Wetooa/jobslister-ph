# JobsPH Lister

A Next.js application that discovers remote roles on [OnlineJobs.ph](https://www.onlinejobs.ph), scores them against your CV-backed profile using a local [Ollama](https://ollama.com) model, and helps you track which listings may already be closed. The UI is protected by a simple admin password; data stays on your machine unless you configure external services yourself.

## Features

- **Job search** — Headless Playwright flows query OnlineJobs.ph and stream progress in the UI.
- **Profile & CV** — Upload a resume (PDF), extract a structured profile, and optionally deep-scan a portfolio URL.
- **AI matching** — LLM-powered analysis compares listings to your profile (via Ollama’s HTTP API).
- **Closed-listing checks** — Optional sync pass loads each job URL to detect inactive postings.
- **Access control** — Single shared `ADMIN_PASSWORD`; session token stored in `localStorage` (no database).

## Tech stack


| Area              | Choice                                                                              |
| ----------------- | ----------------------------------------------------------------------------------- |
| Framework         | [Next.js](https://nextjs.org) 16 (App Router)                                       |
| UI                | React 19, Tailwind CSS 4, [Base UI](https://base-ui.com/) / shadcn-style primitives |
| Scraping & checks | [Playwright](https://playwright.dev)                                                |
| LLM               | Ollama-compatible HTTP API (`/api/generate`)                                        |
| Tests             | [Vitest](https://vitest.dev), Testing Library                                       |


## Prerequisites

- **Node.js** 20 or newer (recommended; aligns with `@types/node` in the repo).
- **Ollama** running locally (or reachable at a URL you set in env) when you use AI analysis.
- **Playwright browsers** — after `npm install`, install Chromium for the scraper if prompted (e.g. `npx playwright install chromium`).

## Getting started

```bash
git clone <repository-url>
cd jobsph-lister
npm install
```

Create a `**.env.local**` file in the project root (Next.js loads it automatically). At minimum:

```bash
# Required for the web UI sign-in (use a strong secret in production)
ADMIN_PASSWORD=your-secret-password
```

Optional Ollama overrides:

```bash
# Full URL to Ollama generate endpoint (takes precedence when set)
OLLAMA_API_URL=http://127.0.0.1:11434/api/generate

# Or host only; `/api/generate` is appended
# OLLAMA_HOST=http://127.0.0.1:11434

# Model name (default in code is gemma4:31b-cloud — set to a model you have pulled)
OLLAMA_MODEL=your-model-name
```

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in with `ADMIN_PASSWORD`, then use the dashboard and profile tabs.

## Scripts


| Command                 | Description                           |
| ----------------------- | ------------------------------------- |
| `npm run dev`           | Next.js development server            |
| `npm run build`         | Production build                      |
| `npm run start`         | Run production server (after `build`) |
| `npm run lint`          | ESLint                                |
| `npm test`              | Vitest (single run)                   |
| `npm run test:watch`    | Vitest watch mode                     |
| `npm run test:coverage` | Vitest with coverage                  |


## Environment variables


| Variable         | Required           | Description                                                                                 |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| `ADMIN_PASSWORD` | Yes (for UI login) | Shared password; server derives a session token. Returns **503** from auth routes if unset. |
| `OLLAMA_API_URL` | No                 | Full URL for `POST` generate API.                                                           |
| `OLLAMA_HOST`    | No                 | Base URL without path; combined with `/api/generate` when `OLLAMA_API_URL` is unset.        |
| `OLLAMA_MODEL`   | No                 | Model id passed to Ollama.                                                                  |


Never commit `.env.local` or real secrets. For production, set these in your host’s secret store or dashboard.

## Security notes

- The **admin gate protects the browser UI**. API routes under `src/app/api/` are not automatically authenticated with that token. If you expose this app to the internet, add network restrictions, reverse-proxy auth, or middleware that validates the same Bearer token on sensitive routes.
- Session tokens are **deterministic** from `ADMIN_PASSWORD`. Rotating the password invalidates existing browser sessions.

## Project layout (high level)

```
src/
  app/           # App Router pages and route handlers (`/api/*`)
  components/    # UI (including AuthGate, job list, scan terminal, etc.)
  lib/           # Scraping, LLM client, storage, auth helpers
```

## Deployment

Build a production bundle with `npm run build`, then run `npm run start`. Ensure `ADMIN_PASSWORD` and Ollama-related variables are set in the runtime environment. For serverless platforms, confirm Playwright and long-running streams match the provider’s limits; you may need a Node-friendly host with sufficient memory for Chromium.

## Docker

The repo includes a multi-stage `[Dockerfile](Dockerfile)` (Next.js **standalone** output) and `[docker-compose.yml](docker-compose.yml)`. The runtime image is based on [Playwright’s Docker image](https://playwright.dev/docs/docker) so Chromium matches the app’s Playwright version.

1. Create a `**.env`** file in the project root (Compose reads it via `env_file`). You can start from the template: `cp .env.example .env` and edit values (or copy from `.env.local`). At minimum set `ADMIN_PASSWORD`. For AI features, point Ollama at the machine where it runs:
  - **Ollama on the same host as Docker (typical):** set  
   `OLLAMA_HOST=http://host.docker.internal:11434`  
   Compose adds `host.docker.internal` → host gateway on Linux as well, so this works on Docker Desktop and modern Linux engines.
  - **Ollama in another container or remote host:** use that host’s URL in `OLLAMA_API_URL` or `OLLAMA_HOST` instead.
2. Ensure a writable `**./data`** directory exists on the host (or let the app create files on first run). Jobs, profile, and analysis JSON files are stored under `data/` relative to the process working directory (`/app/data` in the container).
3. Build and run:
  ```bash
   docker compose build
   docker compose up -d
  ```
   Open [http://localhost:3000](http://localhost:3000) and sign in with `ADMIN_PASSWORD`.

To rebuild after code changes: `docker compose build --no-cache` (optional) then `docker compose up -d`.

**Notes:** The UI password gate does not authenticate API routes by itself; treat the container like any other deployment if it is reachable from a network. If bind-mounted `./data` is not writable by the container user on Linux, adjust host permissions or ownership for `./data`.

## License

Private project (`"private": true` in `package.json`). All rights reserved unless otherwise stated by the repository owner.