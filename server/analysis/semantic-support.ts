import type { ModelAnalysis } from './contracts.js';

type Finding = ModelAnalysis['findings'][number];

/** Conservative lexical gate. Passing does not prove an interpretation true. */
export function supportsFinding(finding: Finding): boolean {
  const quote = finding.quotation.toLowerCase();
  const interpretation =
    `${finding.title} ${finding.explanation}`.toLowerCase();
  if (
    /\b(definit(?:e|ely)|proven|confirmed|guaranteed)\s+(?:fraud|scam|safe|legitimate)\b|\b(?:fraud|scam|safe|legitimate)\s+(?:is\s+)?(?:proven|confirmed|guaranteed)\b/.test(
      interpretation,
    )
  )
    return false;
  switch (finding.category) {
    case 'payment':
      return (
        !/\b(no|without|waived|never)\b.{0,35}\b(fee|payment|deposit|charge)\b|\b(fee|payment|deposit|charge)\b.{0,25}\b(not required|waived|none|no charge)\b/.test(
          quote,
        ) &&
        (/\b(pay|send|transfer|deposit)\s+(?:a\s+|an\s+|the\s+)?(?:refundable\s+)?(?:verification\s+|application\s+|processing\s+)?(?:fee|deposit|₹|rs\.?|inr|\$|\d)/.test(
          quote,
        ) ||
          /\b(fee|deposit|payment)\b.{0,35}\b(required|must|pay|before|upfront)\b|\b(required|must|need to|to confirm)\b.{0,35}\b(fee|deposit|payment)\b/.test(
            quote,
          ))
      );
    case 'urgency':
      return (
        /\b(within\s+\d+\s*(?:minutes?|hours?|days?)|immediately|urgent(?:ly)?|deadline|by\s+(?:tonight|tomorrow|midnight))\b/.test(
          quote,
        ) && !/\bno\s+(?:deadline|urgency|rush)\b/.test(quote)
      );
    case 'personal_information':
      return (
        /\b(send|share|provide|submit|upload|enter)\b/.test(quote) &&
        /\b(passport|aadhaar|identity|id card|bank|account number|otp|password|social security|ssn)\b/.test(
          quote,
        )
      );
    case 'identity':
      return /\b(mismatch|does not match|different (?:name|company|employer|domain|email)|impersonat|claims to be)\b/.test(
        quote,
      );
    case 'channel':
      return (
        /\b(only|exclusively|must|do not|don't)\b/.test(quote) &&
        /\b(telegram|whatsapp|personal email|direct message|dm|chat)\b/.test(
          quote,
        )
      );
    case 'compensation':
      return (
        /\b(guaranteed|assured|promised?)\b/.test(quote) &&
        /\b(salary|stipend|earnings?|income|compensation|pay)\b/.test(quote)
      );
    case 'verification_avoidance':
      return /\b(do not|don't|must not|never|avoid)\s+(?:contact|verify|check|reach)\b|\bno\s+verification\b/.test(
        quote,
      );
    case 'link':
      return /\b(mismatch|lookalike|different domain|unofficial link|shortened link|bit\.ly|tinyurl)\b/.test(
        quote,
      );
    case 'contradiction':
      return /\b(no fee|free)\b.{0,100}\b(pay|fee required|payment)\b|\b(pay|fee required|payment)\b.{0,100}\b(no fee|free)\b/.test(
        quote,
      );
    case 'other':
      return false;
  }
}

export function supportedExplanation(category: Finding['category']): string {
  const explanations: Record<Finding['category'], string> = {
    payment:
      'The quoted text requests payment in connection with the opportunity. Verify any fee independently before paying.',
    urgency:
      'The quoted text imposes a time constraint. Pause and verify through an independent channel.',
    personal_information:
      'The quoted text asks for sensitive information. Confirm the recipient and necessity before sharing it.',
    identity:
      'The quoted text indicates an identity inconsistency. Confirm the recruiter through official contact details.',
    channel:
      'The quoted text restricts communication to a particular channel. Locate an official contact independently.',
    compensation:
      'The quoted text makes a compensation guarantee. Confirm the terms with the organization independently.',
    verification_avoidance:
      'The quoted text discourages independent verification. Contact the organization through an independently found channel.',
    link: 'The quoted text describes a link or domain concern. Confirm the destination using an independently found official website.',
    contradiction:
      'The quoted text contains conflicting terms. Ask the organization to clarify them in writing.',
    other: 'The quoted text may warrant closer review. Verify independently.',
  };
  return explanations[category];
}
