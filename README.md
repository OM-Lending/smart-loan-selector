Project Roadmap & Progress Tracker

1. Database Schema, Form & Recommendation Engine
Status: In Progress (Core schema finalized, lender tables & algorithm next)
* [x] Design multi-step questionnaire data structure (WizardFormData)
* [x] Implement configuration-driven UI (QUESTIONNAIRE config dictionary)
* [x] Finalize Supabase & Prisma database schema (Users, Applications, Leads)
* [x] Add Lender and Lender Product relational tables in Prisma & Supabase
  - [x] Define Lender model (name, logo, tier, category: Big 4 / non-bank)
  - [x] Define LenderProduct model (interest rate, rate type, repayment type, max LVR, min income requirement)
  - [x] Seed initial Australian lender & loan product mock data into database
* [ ] Write backend recommendation matching algorithm
  - [ ] Calculate borrowing metrics (LVR, DTI ratio, estimated monthly repayments)
  - [ ] Implement product filtering engine based on user profile (Owner Occupied vs Investment, P&I vs IO)
  - [ ] Implement ranking logic (sort by lowest rate, best match tier)
  - [ ] Expose recommendation results via Next.js API route

2. Supabase Authentication & Session Binding
Status: Architecture Designed / Implementation Ready
* [x] Design Aussie-style progressive profiling flow (Email lead capture -> Phone OTP)
* [ ] Configure Supabase Auth settings
  - [ ] Set up SMS provider (Twilio or MessageBird) in Supabase dashboard
  - [ ] Configure auth security limits (OTP expiry, rate limiting per IP/phone)
* [ ] Implement end-to-end authentication in Next.js
  - [ ] Initialize Supabase browser client and server client helpers
  - [ ] Replace mock signInWithOtp in /sign-up with real Supabase Auth call
  - [ ] Replace mock verifyOtp and retrieve verified auth.users id
* [ ] Connect local storage data persistence to user session
  - [ ] Read pending_loan_data from localStorage upon successful OTP verification
  - [ ] Call /api/application/lead to bind questionnaire data with Supabase user_id
  - [ ] Clear localStorage and redirect user to dashboard
* [ ] Setup session management and route protection
  - [ ] Implement Next.js middleware to protect private routes (/dashboard)
  - [ ] Handle token refresh and logout flows

3. Consumer Data Right (CDR) Integration
Status: Pending
* [ ] Define CDR data schema in Prisma
  - [ ] Create CDRConsents table (consent status, expiry, sharing duration)
  - [ ] Create CDRFinancialAccounts and CDRTransactions tables
* [ ] Build CDR connector service
  - [ ] Integrate with Accredited Data Recipient (ADR) API gateway (e.g. Basiq, Frollo)
  - [ ] Build user consent flow modal / redirect UI in client portal
* [ ] Build CDR payload parser & analyzer
  - [ ] Parse banking transaction data into income verification categories
  - [ ] Calculate actual living expenses vs HEM benchmark
  - [ ] Detect existing undisclosed debts and liability balances

4. Frontend Client-Side Application (Borrower Portal)
Status: In Progress
* [x] Build responsive URL-driven Wizard component (/get-started with ?q=...)
* [x] Build standalone secure authentication page (/sign-up)
* [ ] Build borrower matched rates dashboard (/dashboard)
  - [ ] Summary card for user's borrowing capacity and target LVR
  - [ ] Top matched lender cards (interest rate, comparison rate, monthly savings)
  - [ ] "Apply Now" or "Talk to Broker" call-to-action actions
* [ ] Build application tracking view
  - [ ] Timeline of application stages (LEAD_CAPTURED -> CDR_VERIFIED -> SUBMITTED)
  - [ ] Document upload area for supporting files (payslips, IDs)

5. Frontend Admin Portal (Broker CRM)
Status: Pending
* [ ] Setup admin layout, routing group (app/(admin)), and RBAC
  - [ ] Protect admin routes via Supabase custom claims (role = 'broker' | 'admin')
* [ ] Build Lead & Application pipeline table
  - [ ] Filter by stage: unverified leads, completed applications, CDR connected
  - [ ] Detail view for broker to review full questionnaire breakdown & CDR insights
* [ ] Build lender & product management CMS
  - [ ] Create/update/archive lenders and interest rates dynamically

6. Background Automation & Webhooks
Status: Pending
* [ ] Setup webhook listeners
  - [ ] Supabase Auth webhook to create internal user profiles automatically
  - [ ] CDR provider webhook for asynchronous bank data sync notifications
* [ ] Setup automated cron jobs (e.g. Inngest / Vercel Cron)
  - [ ] Automated email nurture for abandoned leads (dropped before phone OTP)
  - [ ] Periodic rate check alerts for existing borrowers

7. Production Deployment & DevOps
Status: Pending
* [ ] Configure production environments in Supabase (Production Project vs Staging)
* [ ] Configure Vercel production deployment and environment variables
* [ ] Apply and migrate production database schema via Prisma migrate
* [ ] Setup domain routing, DNS records, and error monitoring (Sentry)