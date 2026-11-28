import type { VerificationCategory } from './types';

export const templates: Record<
  VerificationCategory,
  {
    title: string;
    description: string;
    method: string;
    questions: string[];
    criteria: string;
  }
> = {
  payment: {
    title: 'Clarify the payment policy',
    description:
      'Check the requested fee through an independently found organization channel before paying anything.',
    method:
      'Find the organization’s published contact details independently and ask for its written recruitment fee policy.',
    questions: [
      'Is any payment required under your official recruitment policy?',
      'Can you provide written documentation explaining this fee?',
    ],
    criteria:
      'Record the policy response and compare it with an independently published policy. A reply alone is not proof.',
  },
  urgency: {
    title: 'Make time for independent checks',
    description:
      'A short deadline should not prevent checking the opportunity.',
    method:
      'Request enough time to verify the role through an official channel.',
    questions: [
      'Can you provide sufficient time for independent verification?',
    ],
    criteria:
      'Record the response and decide whether independent checks can be completed before any commitment.',
  },
  recruiter_identity: {
    title: 'Confirm the recruiter identity',
    description:
      'Check the sender’s role using contact information published by the organization.',
    method:
      'Locate the organization’s own careers or contact page and initiate a separate inquiry.',
    questions: [
      'Can you provide an official company email address?',
      'Can the organization confirm that you are recruiting for this role?',
    ],
    criteria:
      'Record what an independently contacted organization says; a sender’s reply alone is not confirmation.',
  },
  company_identity: {
    title: 'Check the organization identity',
    description:
      'Find the organization and role through sources you locate independently.',
    method:
      'Use a known official website or published contact channel, not a link supplied only in the message.',
    questions: [
      'Where is this vacancy listed on the official careers portal?',
      'Which organization is responsible for the opportunity?',
    ],
    criteria:
      'Record the independently found listing or contact response and any differences.',
  },
  communication_channel: {
    title: 'Check the communication channel',
    description:
      'Compare the requested channel with the organization’s documented recruitment process.',
    method:
      'Ask through an independently found official channel whether this method is used.',
    questions: [
      'Is this communication channel part of your documented recruitment process?',
    ],
    criteria:
      'Record the organization’s independent response before sharing personal details.',
  },
  opportunity_details: {
    title: 'Clarify role and selection details',
    description:
      'Obtain written details of the opportunity and how candidates are selected.',
    method:
      'Request a role description and compare it with a listing you find independently.',
    questions: [
      'What are the responsibilities, duration, selection process, and reporting arrangements?',
    ],
    criteria:
      'Record the role details and any official listing; unanswered details remain unresolved.',
  },
  sensitive_information: {
    title: 'Check requests for personal information',
    description:
      'Understand why sensitive details are requested and whether the request is necessary at this stage.',
    method:
      'Ask the organization through an independent channel about its data collection process.',
    questions: [
      'Why is this information required now, and how will it be handled?',
    ],
    criteria:
      'Record the documented purpose before deciding whether to share anything.',
  },
  suspicious_link: {
    title: 'Verify the destination independently',
    description:
      'Avoid relying on a supplied link until you can compare it with a known official destination.',
    method:
      'Navigate to the organization’s website independently and find the vacancy from there.',
    questions: [
      'Can you provide the listing location on your official careers site?',
    ],
    criteria:
      'Record the independently located destination or note that none was found.',
  },
  verification_avoidance: {
    title: 'Insist on an independent check',
    description: 'A request to avoid official channels limits verification.',
    method:
      'Contact the organization through a channel found independently, regardless of the message’s instructions.',
    questions: [
      'Can I verify this offer through your published HR or careers contact?',
    ],
    criteria:
      'Record the independent response; refusal or inability to check remains a concern.',
  },
  unconfirmed_claim: {
    title: 'Check the source claim',
    description:
      'A statement in the opportunity remains unconfirmed until checked independently.',
    method:
      'Compare the claim with an official listing or independently contacted organization.',
    questions: ['Where can I verify this claim through an official source?'],
    criteria: 'Record the independent source or mark the claim unresolved.',
  },
  missing_information: {
    title: 'Request missing information',
    description: 'Ask for the details the report identified as absent.',
    method:
      'Request written clarification and compare it with independent sources where possible.',
    questions: ['Can you provide the missing opportunity details in writing?'],
    criteria: 'Record what was provided and what remains unanswered.',
  },
  general: {
    title: 'Perform an independent verification',
    description: 'Complete a basic check before making any commitment.',
    method:
      'Locate the organization through an independent source and contact it directly.',
    questions: [
      'Can you confirm this opportunity through your official recruitment channel?',
    ],
    criteria: 'Record the independent response or mark the check unresolved.',
  },
};

export function categoryForFinding(category: string): VerificationCategory {
  const mapping: Record<string, VerificationCategory> = {
    payment: 'payment',
    urgency: 'urgency',
    personal_information: 'sensitive_information',
    identity: 'recruiter_identity',
    channel: 'communication_channel',
    compensation: 'opportunity_details',
    verification_avoidance: 'verification_avoidance',
    link: 'suspicious_link',
    contradiction: 'unconfirmed_claim',
    other: 'unconfirmed_claim',
  };
  return mapping[category] ?? 'unconfirmed_claim';
}

export function categoryForMissing(text: string): VerificationCategory {
  const value = text.toLowerCase();
  if (/recruiter|sender|contact person/.test(value))
    return 'recruiter_identity';
  if (/company|employer|organization|organisation/.test(value))
    return 'company_identity';
  if (
    /listing|posting|vacancy|career portal|careers? (?:page|site|website)|official (?:website|site)/.test(
      value,
    )
  )
    return 'company_identity';
  if (
    /responsibilit|duration|selection|role|stipend|salary|supervisor|reporting/.test(
      value,
    )
  )
    return 'opportunity_details';
  if (/payment|fee|refund/.test(value)) return 'payment';
  if (/deadline|time limit/.test(value)) return 'urgency';
  if (/channel|email|phone|messag/.test(value)) return 'communication_channel';
  return 'missing_information';
}
