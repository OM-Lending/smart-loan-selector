# Broker enquiries and admin email notifications

## Enquiry workflow

One enquiry has one current status:

| Status | Meaning |
| --- | --- |
| NEW | Received; no work has started |
| CONTACTING | The team is contacting or discussing needs with the customer |
| CONVERTED | The customer is proceeding with a linked continued loan application |
| RESOLVED | The question has been answered |
| CLOSED | No further action is planned |

There are no next-follow-up dates, last-contact dates, close reasons, closing-note fields, waiting states or on-hold states.

Contact attempts are separate activity records. Their channel is PHONE, EMAIL or OTHER, and their outcome is REACHED, NO_ANSWER, VOICEMAIL_LEFT, MESSAGE_SENT or INVALID_CONTACT. An optional general activity note records context. A contact attempt on a NEW enquiry moves it to CONTACTING. Closed, resolved and converted enquiries can be reopened as CONTACTING; they cannot be reset to NEW.

The admin pages are `/admin/broker-enquiries`, `/admin/broker-enquiries/[id]` and `/admin/notifications`. All data endpoints verify the database ADMIN role. Contact details on an enquiry never update the customer's profile. Visitors can send enquiries without registering. A converted enquiry must link to a continued application belonging to its customer; a generated comparison alone is insufficient.

## Database

- `broker_enquiries`: contact details, message, five-state status, optional customer/assignee/application relationships, timestamps, unique submission ID and HMAC-hashed IP for submission throttling.
- `broker_enquiry_activities`: who created, contacted, reassigned, linked or changed an enquiry, including optional general notes and contact results.
- `notification_events`: an outbox event committed in the same transaction as its business record. Unique event keys prevent duplicate events. Production, preview and development queues are separated.
- `notification_deliveries`: per-recipient delivery status, retry count, lease, provider message ID and error summary. A unique event/recipient pair prevents duplicate recipient rows.

New tables enable PostgreSQL row-level security with no public policies. Access is through the server database connection, not the browser's Supabase client. Run the checked-in migrations before deploying the application code.

## Brevo setup

1. Use the company's Brevo account and enable transactional email sending if needed.
2. Authenticate the sending domain in Brevo. Add its requested DNS records at the authoritative DNS provider (GoDaddy if DNS is hosted there). Do not replace existing company mail records.
3. Register/verify the sender email address.
4. Create a server API key. This integration uses the Brevo HTTP API, so supply an API key, not an SMTP key.
5. Choose the administrator recipients and the deployed application URL.

Templates are English HTML maintained in `src/server/services/notifications/email-template.ts`. No Brevo template IDs are required. All customer-provided text is escaped before rendering. Supporting documents are linked through authenticated admin pages rather than attached to email.

## Server environment variables

Configure in Vercel and, if desired, `.env.local`. Never use a `NEXT_PUBLIC_` prefix for these credentials.

```dotenv
BREVO_API_KEY=replace-with-brevo-api-key
EMAIL_FROM_ADDRESS=notifications@notify.example.com
EMAIL_FROM_NAME=OpenLending
ADMIN_NOTIFICATION_EMAILS=admin1@example.com,admin2@example.com
APP_BASE_URL=https://your-deployed-app.example.com
EMAIL_NOTIFICATIONS_ENABLED=true
NOTIFICATION_ENVIRONMENT=production
```

- `BREVO_API_KEY`, sender address, administrator recipients and `APP_BASE_URL` are required to send.
- `EMAIL_FROM_NAME` defaults to OpenLending.
- `EMAIL_NOTIFICATIONS_ENABLED` defaults to disabled unless set to exactly `true`. Data and outbox events still save while disabled.
- `NOTIFICATION_ENVIRONMENT` may be production, preview or development. Vercel defaults to its deployment environment; local development defaults to development. Set local sending to false while using a production database, and use test recipient addresses when enabling development sending. Production workers never send preview/development events.
- `BROKER_ENQUIRY_RATE_LIMIT_SECRET` is optional; without it, the existing server-side `CLERK_SECRET_KEY` is used as the HMAC key. Use a stable random server-only value if providing a separate secret.

## Events and delivery

- A new saved questionnaire creates APPLICATION_CREATED.
- A final continued-application submission creates APPLICATION_SUBMITTED. Draft saves and document uploads do not send. A later resubmission after a broker requests information creates a new submission event.
- A saved broker message creates BROKER_ENQUIRY_CREATED.

After the response, the server attempts sending. Disabled or incomplete mail configuration leaves outbox events queued. Failures do not change a successfully saved application/enquiry into a failed submission. Each recipient gets at most six automatic attempts across three rounds: two attempts per round, separated by at least 15 minutes after failure. The second and third rounds each begin at least 24 hours after the previous round's second failure. These are elapsed-time rounds, not local calendar days or a claim about Brevo's quota reset timezone. The worker processes due deliveries on its next run. Interrupted sends consume an attempt and follow the same waiting policy. Administrators can manually retry failed deliveries, which resets the attempt count and starts a new round. Already-sent deliveries are not requeued.

SENT means Brevo accepted the request, not confirmed inbox delivery. Provider idempotency keys supplement database deduplication, but this is an at-least-once delivery mechanism; exactly-once email delivery cannot be guaranteed across provider timeouts and crashes.

## GitHub Actions retry worker

`.github/workflows/admin-email-notifications.yml` runs every 15 minutes at UTC minute 8, 23, 38 and 53. GitHub scheduling can be delayed. Run it manually after configuration to process the production queue. It does not apply database migrations.

Required repository secrets:

```text
PRODUCTION_DATABASE_URL
BREVO_API_KEY
EMAIL_FROM_ADDRESS
ADMIN_NOTIFICATION_EMAILS
APP_BASE_URL
```

Optional repository variable: `EMAIL_FROM_NAME`. The workflow sets sending enabled and selects the production queue explicitly.

For a manually configured local worker, run `pnpm notifications:send`. This can send real emails: use the intended environment and recipient configuration. Do not run it just to check compilation.
