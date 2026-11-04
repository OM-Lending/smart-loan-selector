import { z } from 'zod';

export const ENQUIRY_STATUSES = ['NEW', 'CONTACTING', 'CONVERTED', 'RESOLVED', 'CLOSED'] as const;
export const ENQUIRY_STATUS_LABELS: Record<typeof ENQUIRY_STATUSES[number], string> = {
  NEW: 'New enquiry', CONTACTING: 'Contacting customer', CONVERTED: 'Proceeding with application',
  RESOLVED: 'Enquiry resolved', CLOSED: 'Closed',
};
export const CONTACT_OUTCOMES = ['REACHED', 'NO_ANSWER', 'VOICEMAIL_LEFT', 'MESSAGE_SENT', 'INVALID_CONTACT'] as const;
export const CONTACT_CHANNELS = ['PHONE', 'EMAIL', 'OTHER'] as const;

export const BrokerEnquiryForm = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  phone: z.string().trim().regex(/^\+?[0-9() -]{8,24}$/, 'Enter a valid phone number.')
    .refine(value => { const digits = value.replace(/\D/g, '').length; return digits >= 8 && digits <= 15; }, 'Enter a valid phone number.'),
  message: z.string().trim().min(10, 'Please enter at least 10 characters.').max(4000),
});
export const CreateBrokerEnquiry = BrokerEnquiryForm.extend({
  requestId: z.string().uuid(), website: z.string().max(200).optional(),
});
export const UpdateBrokerEnquiry = z.object({
  updatedAt: z.string().datetime(),
  status: z.enum(ENQUIRY_STATUSES),
  assignedToId: z.string().uuid().nullable(),
  linkedApplicationId: z.string().uuid().nullable(),
  note: z.string().trim().max(2000).optional(),
  channel: z.enum(CONTACT_CHANNELS).optional(),
  outcome: z.enum(CONTACT_OUTCOMES).optional(),
}).refine(value => Boolean(value.channel) === Boolean(value.outcome), { message: 'Choose both a contact channel and an outcome.' })
  .refine(value => value.status !== 'CONVERTED' || Boolean(value.linkedApplicationId), { message: 'Link an application before marking this enquiry as proceeding.' });
