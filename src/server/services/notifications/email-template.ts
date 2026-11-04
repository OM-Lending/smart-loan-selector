import type { Prisma } from '@prisma/client';

export type NotificationWithSource = Prisma.NotificationEventGetPayload<{ include: {
  enquiry: true;
  application: { include: { user: true; continuation: { include: { selectedQuote: true } } } };
} }>;
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const money = (value: unknown) => value == null ? 'Not provided' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(Number(String(value)));

export function buildAdminEmail(event: NotificationWithSource, baseUrl: string) {
  const submitted = event.type === 'APPLICATION_SUBMITTED';
  const enquiry = event.enquiry;
  const application = event.application;
  const title = enquiry ? 'New broker enquiry received' : submitted ? 'Application submitted for broker review' : 'New application received';
  const rows: Array<[string, unknown]> = enquiry ? [
    ['Name', enquiry.fullName], ['Email', enquiry.email], ['Phone', enquiry.phone], ['Message', enquiry.message],
  ] : application ? [
    ['Name', application.user.fullName], ['Email', application.user.email], ['Phone', application.user.phone],
    ['Loan goal', application.goal === 'BUY' ? 'Purchase' : 'Refinance'],
    ['Loan amount', money(application.goal === 'BUY' ? application.purchasePrice?.minus(application.deposit ?? 0) : application.currentLoanBalance)],
    ...(submitted ? [
      ['Selected lender', application.continuation?.selectedQuote.lenderName],
      ['Selected product', application.continuation?.selectedQuote.productName],
      ['Submitted at', application.continuation?.submittedAt?.toISOString()],
    ] as Array<[string, unknown]> : []),
  ] : [];
  if (!rows.length) throw new Error('NOTIFICATION_SOURCE_NOT_FOUND');
  const path = enquiry ? `/admin/broker-enquiries/${enquiry.id}` : `/admin/applications/${application!.id}${submitted ? '/submission-review' : ''}`;
  const link = new URL(path, baseUrl).toString();
  const subject = `${event.environment === 'production' ? '' : `[${event.environment.toUpperCase()}] `}${title}`;
  return { subject, html: `<!doctype html><html lang="en"><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a"><main style="max-width:600px;margin:32px auto;background:#fff;padding:32px;border-radius:16px"><p style="font-weight:bold;color:#475569">OpenLending · Admin notification</p><h1 style="font-size:24px">${escape(title)}</h1><p>A new item is ready for your team to review.</p><table style="width:100%;border-collapse:collapse">${rows.map(([label, value]) => `<tr><th style="text-align:left;vertical-align:top;padding:12px 8px;border-bottom:1px solid #e2e8f0;width:130px">${escape(label)}</th><td style="padding:12px 8px;border-bottom:1px solid #e2e8f0;white-space:pre-wrap;overflow-wrap:anywhere">${escape(value ?? 'Not provided')}</td></tr>`).join('')}</table><p style="margin-top:28px"><a href="${escape(link)}" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Review in admin workspace</a></p><p style="font-size:12px;color:#64748b">Sign in with an administrator account to view the full details and supporting documents.</p></main></body></html>` };
}
