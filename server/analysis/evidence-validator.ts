import type { AnalyzeRequest, ModelAnalysis } from './contracts.js';
import { supportedExplanation, supportsFinding } from './semantic-support.js';

function locate(source: string, quotation: string) {
  const words = quotation.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const escaped = words.map((word) =>
    word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const pattern = new RegExp(escaped.join('\\s+'), 'g');
  for (const match of source.matchAll(pattern)) {
    const start = match.index;
    const end = start + match[0].length;
    const before = source[start - 1];
    const after = source[end];
    if (
      before &&
      /[\p{L}\p{N}]/u.test(before) &&
      /[\p{L}\p{N}]/u.test(match[0][0])
    )
      continue;
    if (
      after &&
      /[\p{L}\p{N}]/u.test(after) &&
      /[\p{L}\p{N}]/u.test(match[0].at(-1)!)
    )
      continue;
    return { start, end };
  }
  return null;
}

const injectedInstruction =
  /ignore (?:all )?previous instructions|reveal.{0,30}system prompt|return a risk score|declare.{0,40}(?:safe|legitimate)|do not mention the payment/i;

function sentenceAt(source: string, position: number) {
  const previous = Math.max(
    source.lastIndexOf('.', position - 1),
    source.lastIndexOf('!', position - 1),
    source.lastIndexOf('?', position - 1),
    source.lastIndexOf('\n', position - 1),
  );
  const following = [
    source.indexOf('.', position),
    source.indexOf('!', position),
    source.indexOf('?', position),
    source.indexOf('\n', position),
  ]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  let left = previous + 1;
  let right =
    following === undefined
      ? source.length
      : following + (source[following] === '\n' ? 0 : 1);
  while (left < right && /\s/.test(source[left])) left++;
  while (right > left && /\s/.test(source[right - 1])) right--;
  return right - left <= 400
    ? { start: left, end: right, quotation: source.slice(left, right) }
    : null;
}

export function validateEvidence(
  model: ModelAnalysis,
  request: AnalyzeRequest,
) {
  const origin = request.extractionMethod;
  const claims = model.claims.flatMap((claim) => {
    const offsets = locate(request.reviewedText, claim.quotation);
    return offsets && !injectedInstruction.test(claim.quotation)
      ? [
          {
            ...claim,
            text: claim.quotation,
            ...offsets,
            origin,
            userCorrected: request.userCorrected,
          },
        ]
      : [];
  });
  const seen = new Set<string>();
  const findings = model.findings.flatMap((finding) => {
    const offsets = locate(request.reviewedText, finding.quotation);
    if (!offsets) return [];
    let context: ReturnType<typeof sentenceAt> = null;
    for (let cursor = offsets.start; cursor < offsets.end;) {
      const candidate = sentenceAt(request.reviewedText, cursor);
      if (!candidate) break;
      if (
        !injectedInstruction.test(candidate.quotation) &&
        supportsFinding({ ...finding, ...candidate })
      ) {
        context = candidate;
        break;
      }
      cursor = candidate.end + 1;
    }
    if (!context) return [];
    const key = `${finding.category}:${context.quotation.replace(/\s+/g, ' ').toLowerCase()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [
      {
        ...finding,
        explanation: supportedExplanation(finding.category),
        id: `F-${seen.size.toString().padStart(2, '0')}`,
        ...context,
        origin,
        userCorrected: request.userCorrected,
        uncertainty:
          request.extractionMethod === 'image_ocr' &&
          /[₹$€£]|\d/.test(context.quotation)
            ? ('high' as const)
            : finding.uncertainty,
      },
    ];
  });
  return {
    claims,
    findings,
    rejectedCount:
      model.claims.length -
      claims.length +
      model.findings.length -
      findings.length,
  };
}
