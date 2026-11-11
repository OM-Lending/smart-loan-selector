import { z } from 'zod';

export const LEGAL_VERSION = '2026-11-11.2';
export const LEGAL_EFFECTIVE_DATE = '11 November 2026';
export const LEGAL_ENTITY = 'OM LENDING PTY LTD';
export const LEGAL_ABN = '71 682 744 252';
export const PRIVACY_EMAIL = 'sherry@omlending.com.au';
export const CONSENT_STATEMENTS = {
  quoteTermsAccepted: 'I am at least 18 years old, agree to the Terms of Use, and acknowledge the Privacy Policy and Collection Notice. I authorise OM LENDING PTY LTD to use my information to prepare preliminary home loan comparisons and contact me about this enquiry.',
  termsAccepted: 'I am at least 18 years old and agree to the Terms of Use of OM LENDING PTY LTD.',
  quoteAccepted: 'I have read the Collection Notice and Privacy Policy and authorise OM LENDING PTY LTD to use the information I provide to prepare preliminary home loan comparisons and contact me about this enquiry.',
  collectionAccepted: 'I have read the Application Collection Notice and Privacy Policy and authorise OM LENDING PTY LTD and its authorised brokers to collect and use the information and documents I provide to review and assist with this home loan enquiry.',
  submissionConfirmed: 'To the best of my knowledge, the information and documents I have provided are accurate. I request a broker review and agree to be contacted about this application.',
  brokerContactAccepted: 'I have read the Collection Notice and Privacy Policy and agree to be contacted by OM LENDING PTY LTD about this enquiry.',
} as const;
export type ConsentFlag = keyof typeof CONSENT_STATEMENTS;
export const ConsentPayloadSchema = z.object({
  version: z.literal(LEGAL_VERSION, { error: 'The legal notices have changed. Refresh this page and review the current notices.' }),
  quoteTermsAccepted: z.boolean().optional(),
  termsAccepted: z.boolean().optional(), quoteAccepted: z.boolean().optional(), collectionAccepted: z.boolean().optional(),
  submissionConfirmed: z.boolean().optional(), brokerContactAccepted: z.boolean().optional(),
}).refine(value => !value.quoteTermsAccepted || (value.termsAccepted === true && value.quoteAccepted === true), { message: 'Confirm both the Terms of Use and this enquiry purpose.', path: ['quoteTermsAccepted'] });
export type ConsentPayload = z.infer<typeof ConsentPayloadSchema>;
