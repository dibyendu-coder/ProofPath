# Architecture

## Current shape

ProofPath is one npm package. React, strict TypeScript, Vite, and Tailwind power the editorial landing page and `/verify` workspace. A native Node HTTP server serves the built app and exposes `/api/health` and `POST /api/intake`. Shared transport types live in `shared/`; Zod validates JSON source shape, processed receipts, and server configuration. Vitest covers API and frontend behavior.

```text
Browser → Vite (development) → React /verify → /api proxy → Node intake
Browser → Node (production) → built React + intake API
```

The Node process uses `PORT` and binds to `0.0.0.0` for deployment. It needs no database, queue, external API, or container. Embarko build/start settings can use `npm run build` and `npm start`, subject to the platform's current requirements.

## Intake flow

1. The client selects one of four source types, validates basic shape and limits, and submits to `/api/intake`.
2. Text and URL requests use JSON. File requests send raw bytes with source type and encoded filename headers. This avoids an additional multipart dependency.
3. The server checks content type, body size, source schema, and file signature, then dispatches to `server/processing/`. Text is conservatively normalized; URL retrieval is guarded; image pixels are fully decoded and OCR runs in a bounded child process; PDF text uses a separate bounded child process.
4. The response includes an unpredictable UUID case ID, UTC timestamp, source metadata, available text, processing status, extraction method, provenance, and warnings. No risk claim is generated.

The server does not persist source content or log submitted text or bytes. Case IDs are response identifiers only; there is no lookup API. The browser retains input while editing and clears it when starting a new case.

## Security and resource boundaries

- URL retrieval uses Node HTTP(S) with no browser, JavaScript execution, credentials, cookies, or external AI API. It rejects IP literals, local names, unusual ports, private/reserved DNS answers, and mixed public/private DNS sets. Each hop resolves again and connects to the validated IP through a pinned lookup; TLS keeps the original hostname for SNI and certificate checks. Redirects are capped at 3. DNS/total retrieval has an 8-second deadline, connection idle timeout is 3 seconds, response headers are limited to 16 KB, encoded bodies to 1 MB, and decoded bodies to 2 MB. Only UTF-8/ASCII HTML or plain text is processed. Network and format failures produce an unavailable receipt, while unsafe destinations are rejected. Outbound egress filtering remains recommended as defense in depth.
- Strict text and URL limits; binary size limits enforced from both `Content-Length` and streamed bytes; file signature inspection is independent of extension and MIME type.
- Filenames are URI decoded, reduced to the final path segment, stripped of control characters, and capped at 160 characters.
- A lightweight per-IP limit allows 12 intake requests per minute. The process allows two concurrent intakes and one heavy job (PDF or OCR) at a time. These limits are per process, not a distributed abuse control.
- PDF extraction runs in a child process with a 12-second timeout and 160 MB V8 old generation limit. Aborted requests terminate the child. PDFs are capped at 15 pages and 20,000 extracted characters. A native parser crash is isolated from the intake server. Page numbers with selectable text are recorded; blank pages in mixed documents produce partial warnings. Fully scanned PDFs still return an OCR-required error. The parser may briefly use additional native memory; deploy with a memory limit that accommodates the Node process and one PDF child.
- Image uploads are restricted to PNG/JPEG/WebP, 5 MB, and 12 megapixels before decoding. The isolated OCR child validates full pixel decoding with Sharp in strict mode, rotates by EXIF orientation, downsizes to at most 1,600 px on either side, and runs Tesseract.js 7 with the bundled English LSTM model. It has a 15-second timeout, 128 MB V8 old-generation limit, and a sampled 160 MiB RSS watchdog. Native memory is not constrained by the V8 limit, and the watchdog is not a hard OS memory cap; the deployment's process/container limit remains essential. The child exits after every job and writes no cache or temporary file.
- The HTTP server has 20-second request and 10-second headers timeouts. Failures return safe structured errors without stack traces. Intake responses use `Cache-Control: no-store`.
- No permanent storage is created. PDF and OCR children exit or are terminated after extraction, timeout, or abort.

`client/` must never contain API keys. Vite exposes `VITE_` variables to browsers, so future server credentials must not use that prefix. Provenance distinguishes user-supplied, retrieved, extracted, and unavailable content; extraction does not establish authenticity. Phase 4 AI risk assessment remains deferred.

## OCR decision

| Option                                   | Accuracy and languages                                                     | Runtime and deployment                                                                                     | Decision                       |
| ---------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Tesseract.js 7 with bundled English data | Good for clear printed text; weak on handwriting and some currency symbols | Offline core and language model; measured locally for the controlled screenshot                            | Selected, isolated per request |
| System Tesseract binary                  | Mature OCR with installed language packs                                   | Requires an OS binary and language files on Embarko; not portable in the current single-package deployment | Not selected                   |
| Hosted OCR service                       | Varies by provider                                                         | Sends private screenshots externally and requires credentials and network access                           | Not selected                   |

Screenshots return `image_ocr` text only after full decode and a successful OCR result. Blank or corrupt images return a structured 422 error. The controlled screenshot's title, numeric payment amount, deadline, and email were extracted; the rupee glyph was omitted by the English model. OCR is a transcription aid, not verified evidence. Fully scanned PDFs still report that OCR is required; reusing OCR on PDF pages would need bounded rendering and a separate memory evaluation.

After downsampling, local Windows/Node 22 measurements showed 1,059 ms and 112.2 MiB peak OCR child RSS for the controlled 1,200×280 screenshot. A 12-megapixel white image with a text label took 1,216 ms and reached 127.1 MiB worker RSS. The API process was observed around 75 MiB, so the larger sample implies roughly 202 MiB across API and one OCR child, excluding platform overhead and any concurrent text/URL request. These are sampled observations, not a proven worst case. [Embarko documents a 256 MB per-app limit](https://embarko.ai/guides/free-hosting-for-students); deployment-specific RSS and OCR accuracy still need verification. A controlled HTTPS fixture verifies pinned transport SNI and hostname rejection with a locally trusted test certificate. Its PEM key under `server/processing/fixtures/` is test-only and is never trusted by production requests. Public `https://example.com/` extraction succeeded when outbound network access was granted; sandboxed sockets returned `EACCES`.
