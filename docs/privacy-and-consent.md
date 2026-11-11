# Privacy, terms and consent implementation

## Company information

- OM LENDING PTY LTD, ABN 71 682 744 252, public brand OpenLending.
- Privacy contact: sherry@omlending.com.au.
- Version 2026-11-11.2, effective 11 November 2026.
- Public routes: /terms, /privacy, /collection-notice. Footer links to all three; the contact email is available in the policy pages.
- Remove the previous footer's placeholder company, investor description, ABN and fictional credit licence number. No ACL/credit representative number is asserted without company confirmation.

The English documents are original, project-specific drafts, not copied Canstar terms. The actual operator should review them for its licensing/business arrangements and adopt workable retention and complaint procedures before public launch. The code does not certify legal compliance or introduce automatic deletion of all retained records.

## Data handling disclosures

The project uses Clerk, Supabase, Vercel, Geoapify, Brevo and GitHub Actions. The policy identifies these provider categories, overseas handling, relevant purposes, service communications, rights and complaints. The configured database region was confirmed as ap-northeast-2 (South Korea) without printing credentials. Provider processing can also involve the US and EU countries; data residency and subprocessors must be revisited if infrastructure changes. No unverified fixed retention period is stated. Retention depends on service purposes and actual obligations, with requests directed to the privacy email.

Reference materials checked:

- https://abr.business.gov.au/ABN/View?abn=71682744252
- https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/more-guidance/guide-to-developing-an-app-privacy-policy
- https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-b-key-concepts
- https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information
- https://help.brevo.com/hc/en-us/articles/360001005510-Data-storage-location
- https://www.geoapify.com/privacy-policy/
- https://www.geoapify.com/maps-geocoding-routing-apis-gdpr-compliant-application/
- https://vercel.com/legal/dpa

## User flows

- Questionnaire: collection notice before inputs/address lookup. One explicit final-step checkbox covers terms/18+ and the specific quote purpose when current terms have not been accepted. For users with current terms on record, one quote-purpose checkbox is shown. These related statements do not include marketing, lender lodgement or credit checks. Separate purpose records store the exact combined statement when it was displayed. Confirmations are not restored as pre-ticked browser draft answers and are scoped to the current account.
- Registration: the explicit combined questionnaire confirmation carries into registration, avoiding a second checkbox. If that confirmation is absent, an unchecked Terms/18+ confirmation gates Clerk OTP controls. After verified sign-in, POST /api/legal/terms records account acceptance independently of loan saving. The create-application endpoint separately requires a current terms acceptance and this quote's collection confirmation.
- Signed-in existing users: GET /api/legal/status checks current account terms; already accepted terms do not need another checkbox. Every new quote still needs its own confirmation.
- Continuation: GET returns current scoped acceptance flags. A first-collection card gates the editable form and automatic draft initialization until the customer explicitly agrees. The initial PUT atomically records acceptance and saves details/selected product. Later drafts require no repeated checkbox while the account/application/legal version is unchanged.
- Upload: POST checks ownership and current account terms/application collection authorisation before reading/uploading the file. Existing documents remain viewable/removable without forcing new consent.
- Final submission: a separate unchecked accuracy/review-request confirmation is required each time, including resubmission following broker requests. Confirming does not assert documents are complete or authorise lender lodgement/credit checks.
- Broker enquiry: unchecked notice/contact confirmation; saved and version-recorded together. Guest evidence is linked to the enquiry. Contact consent is not marketing enrolment.
- Privacy requests can be made directly by email without a broker-enquiry checkbox. A co-applicant's separate consent is not manufactured by the primary applicant's confirmation.

## Database

Migration 20261111000000_legal_documents_and_consents introduces:

- legal_document_versions: typed document category, version, title/path, full document and statement JSON snapshot, SHA-256 content hash, publication and creation dates. Unique (type, version).
- legal_consent_records: typed purpose/action/source, document FK, Clerk actor ID, optional profile/application/enquiry FKs, exact statement snapshot, server-recorded timestamp and a unique idempotency hash. Application/enquiry records have scope constraints. Account acceptance can precede Profile creation, so Clerk identity remains recorded independently.

Both tables enable RLS without public policies. There is no browser database access or public consent-read endpoint. Foreign keys prevent dropping referenced legal versions or scoped evidence accidentally. Application code appends records; it does not expose editing of past acceptances. No earlier customer consent is backfilled or assumed. A WITHDRAWN audit event can be recorded by authorised operational procedures after a privacy request; there is no self-service withdrawal endpoint in this change. A subsequent explicit grant is recorded separately and can restore applicable authorisation.

Registration acceptance survives later loan-save failures. Quote/enquiry/continuation evidence commits in the same database transaction as its associated business change. Source timestamps are generated by the server, not accepted from the browser. Consent is scoped to the authenticated Clerk actor and owned application, never trusted from a global browser flag. Current version checks and required true flags are enforced on server mutations, not just by disabled buttons.

## Version management and deployment

Apply the migration before deploying this branch and regenerate Prisma Client. No new environment variable or email-provider setting is required.

Document snapshots are created lazily when the first acknowledgement is persisted. The same version's content hash must not change: when modifying a document, company details, contact or a confirmation statement, increment LEGAL_VERSION, update effective/publication dates, and deploy them together. Old snapshots and records remain intact. Historical submitted applications remain readable; new writes require the current applicable confirmations.

No real registration, document upload, enquiry or notification was generated as part of implementation checks.

Version .2 shortens the inline collection reminder and combines the questionnaire acknowledgement; it does not overwrite version .1 records. No database schema change is required for this presentation/statement revision.
