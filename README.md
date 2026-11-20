# ProofPath

**Before you trust an opportunity, verify it.**

ProofPath is a planned opportunity verification product for students and job seekers. This repository contains the **Phase 1 landing experience** and **Phase 1.1 visual refinement**: an interactive fictional offer, a fictional evidence relationship view, an honest `/verify` placeholder, and the Phase 0 HTTP foundation. It does not analyze opportunities yet.

## Requirements

- Node.js 20.19+ (Node 22 LTS recommended)
- npm 10+

## Local development

```bash
npm install
npm run dev
```

Vite serves the landing page at `http://localhost:5173` and the honest placeholder at `/verify`. To run the API foundation as well, start `npm run dev:api` in another terminal. The API health endpoint is `http://localhost:3000/api/health`; Vite proxies `/api` there. No `.env` file is needed for the current phases. Copy `.env.example` to `.env` only when overriding the default port.

## Checks and production run

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm start
```

`npm start` serves the built site and API from one Node process on `PORT` (default `3000`). Build before starting. On Windows PowerShell systems that block `npm.ps1`, use `npm.cmd` for these commands.

## Project layout

- `client/` — React landing page, interaction, placeholder, and design tokens
- `server/` — Node HTTP server and tests
- `shared/` — TypeScript response contracts
- `docs/` — architecture, design system, and staged roadmap

See [architecture](docs/architecture.md), [design system](docs/design-system.md), and [roadmap](docs/roadmap.md).
