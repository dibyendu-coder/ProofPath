# ProofPath

**Before you trust an opportunity, verify it.**

ProofPath is an opportunity verification product for students and job seekers. The `/verify` workspace accepts text, URLs, screenshots, and text-based PDFs, then lets users review extracted text before requesting AI analysis. Reports identify text-supported warning signs; they do not independently verify organizations or store submissions.

## Requirements and development

- Node.js 20.19+ (Node 22 recommended)
- npm 10+

```bash
npm install
npm run dev:api
```

In another terminal run `npm run dev`, then open `http://localhost:5173/verify`. Vite proxies `/api` to the Node server at `http://localhost:3000`. Stop any older server already using port 3000 before starting `dev:api`; an older build can answer intake requests with an empty 405 response. `dev:api` compiles the bounded PDF and OCR workers before starting the server. Restart `dev:api` after editing either worker **or `.env`**: environment variables are loaded when the backend process starts. On Windows PowerShell setups that block `npm.ps1`, use `npm.cmd`.

## Source limits

| Source     | Accepted input                              | Limit                                        | Preparation                                                                         |
| ---------- | ------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| Text       | Opportunity message or description          | 20,000 characters                            | Returned as submitted                                                               |
| URL        | HTTP or HTTPS, without embedded credentials | 2,048 normalized characters                  | Public webpage text retrieved when safe; otherwise recorded with unavailable status |
| Screenshot | PNG, JPEG, WebP                             | 5 MB, 12 megapixels                          | Full image decode and local English OCR in an isolated worker                       |
| PDF        | Text-based PDF                              | 10 MB, 15 pages, 20,000 extracted characters | Selectable text extracted in a bounded child process                                |

Blank, malformed, encrypted, and scanned image-only PDFs produce clear errors. Mixed text/scanned PDFs report partial extraction and affected pages. PDF text is never silently truncated. Submissions are processed in memory and returned to the browser; no database or permanent file storage is used. A case identifier identifies the response, but it cannot be retrieved after leaving the page.

URL retrieval accepts only conventional public hostnames and ports 80/443, resolves and checks every DNS address, pins the connection to a checked address, and repeats validation after redirects. It uses GET without credentials or cookies, executes no page JavaScript, and caps time, headers, compressed bytes, and decompressed bytes. A blocked destination returns a 422 error; a network, content, or size failure returns an honest unavailable receipt. Retrieved content is **not** verified evidence. HTML text extraction is best effort and may omit unusual page layouts.

Screenshot OCR uses Tesseract.js 7 with a bundled English model and Sharp image decoding. It does not contact a CDN or persist image data. OCR is approximate: the controlled rupee-sign screenshot preserves the numeric amount but omits the `₹` symbol, and other fonts may produce a wrong leading digit. Always compare amounts, deadlines, and contact details with the original. Corrupt, oversized, blank, timed-out, or failed images return structured errors rather than invented text. See [architecture](docs/architecture.md) for resource limits and measured memory.

Embarko publishes a 256 MB per-app memory limit. OCR and PDF jobs are serialized, and the OCR child downsizes large images, but local RSS samples do not prove worst-case deployment fit. Test the target deployment with a representative screenshot and inspect peak container memory before relying on OCR availability.

Public URL retrieval requires outbound DNS and HTTPS from the server. If the hosting environment blocks it, the receipt reports `unavailable`. To verify a deployment, submit `https://example.com/` through `/api/intake` and confirm `processingStatus: "extracted"`, `pageTitle: "Example Domain"`, a final URL, and a retrieval timestamp. Keep the SSRF protections and TLS certificate verification enabled.

## Groq analysis

Set `GROQ_API_KEY` as a server-side environment variable or in an ignored local `.env` file and optionally set `GROQ_MODEL` (default `openai/gpt-oss-120b`). The Node entry point loads `.env` when present; deployed environment variables take precedence. Keep `.env.example` as a placeholder template and never put credentials in `VITE_` variables. The default model is listed by [Groq as supporting strict structured outputs](https://console.groq.com/docs/structured-outputs). The server sends only text the user reviewed and explicitly confirmed; uploaded file bytes are not sent. If the text is unchanged, the confirmed text is the original extraction. A missing key returns `503 not_configured`, and provider failures return safe JSON without fabricated reports.

`POST /api/analyze` accepts JSON:

```json
{
  "caseId": "uuid-from-intake",
  "sourceType": "text",
  "extractionMethod": "user_supplied",
  "reviewedText": "At least 20 characters of confirmed opportunity text",
  "userCorrected": false,
  "confirmed": true
}
```

Success returns HTTP 200 with `status: "complete"`, analysis and case identifiers, timestamp, model, opportunity type, summary, source claims, supported findings with exact quotes and offsets, unanswered questions, verification actions, limitations, and `{score,classification,explanation}`. Errors return `{status:"failed",code,message}`. Case ID and extraction metadata are client-provided references, not authenticated provenance. No database or case lookup exists.

The warning-sign index is a deterministic heuristic, not a fraud probability. Duplicate or unsupported findings contribute zero, uncertainty reduces weight, and insufficient evidence produces **Inconclusive**. The server expands narrow quotes to exact source sentences, applies conservative category checks, and builds report prose from retained evidence; these checks do not prove that every interpretation is correct. See [architecture](docs/architecture.md) for weights and thresholds. OCR can misread payment amounts, including currency symbols and digits; check them against the original image before analysis.

## Evidence graph

After a successful analysis, switch between **Investigation report** and **Evidence graph**. The graph is built in the browser from the same validated report; opening or filtering it makes no Groq request and does not change the warning-sign index. Select a node for its context, use **View in source** to highlight an exact span of reviewed text, or open the structured evidence list. Drag the canvas to pan; the toolbar provides zoom, fit, and reset controls. Filters and severity narrow the view without altering the report. The landing page graph remains a separate fictional demonstration.

Graph quotations are rechecked against reviewed-text offsets. Source claims remain unverified, findings remain AI interpretations, and actions are linked to the opportunity overall because the analysis contract does not identify a reliable action-to-finding mapping. The graph cannot independently verify an organization or recover a case after leaving the page. See [architecture](docs/architecture.md) for the node model and layout limits.

## Intake API contract

`POST /api/intake` accepts JSON for text and URLs:

```json
{"sourceType":"text","text":"Opportunity message"}
{"sourceType":"url","url":"https://example.org/jobs"}
```

Images and PDFs use a raw `application/octet-stream` body with `X-Source-Type: image` or `pdf` and a URI-encoded `X-File-Name`. A successful response has HTTP 201 and the Phase 2 fields `{status:"prepared",caseId,sourceType,submittedAt,metadata,warnings,extractedText?}` plus `processingStatus`, `extractionMethod`, `provenance`, and `errors`. Statuses distinguish supplied, extracted, partial, and unavailable content. Errors use `{status:"failed",code,message}` and an appropriate HTTP status. See [architecture](docs/architecture.md) for security details.

## Checks and production run

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm start
```

`npm start` serves the built site and API from one Node process on `PORT` (default `3000`). Build before starting. Intake works without an API key; analysis reports a configuration error until `GROQ_API_KEY` is provided. See [design system](docs/design-system.md) and [roadmap](docs/roadmap.md).
