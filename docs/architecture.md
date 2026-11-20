# Architecture

## Phase 0 shape

ProofPath uses a single npm package and lockfile to keep setup and deployment small. The frontend is React with strict TypeScript, Vite, and Tailwind CSS. A native Node HTTP server provides `/api/health` and serves the built frontend. Shared TypeScript contracts live in `shared/`. Zod validates server runtime configuration. Vitest covers the HTTP foundation.

```text
Browser → Vite (development) → React shell
                   │
                   └── /api proxy → Node HTTP server

Browser → Node HTTP server (production) → built frontend + /api/health
```

The production process uses the platform-provided `PORT`, when present, and binds to `0.0.0.0`. The repository needs no database, queue, container, or external service for Phase 0. Embarko deployment settings should point build to `npm run build` and start to `npm start`, subject to the platform's current configuration requirements.

## Boundaries

- `client/` never reads server secrets. Vite exposes variables prefixed `VITE_` to browser code, so future API keys must never use that prefix.
- `server/` owns future provider calls and input validation. There is no provider integration now.
- `shared/` contains transport types only; types alone do not validate untrusted input.
- Current API behavior is limited to health. Unknown `/api` routes return 404 instead of pretending analysis exists.

## Planned evolution

As product endpoints arrive, keep request validation and evidence collection on the server. Define explicit response schemas and error states before wiring the UI. Add security controls for external URLs, rate limiting, and privacy retention before accepting user submissions. Avoid treating an AI risk score as verified fact; each conclusion should link to inspectable evidence.
