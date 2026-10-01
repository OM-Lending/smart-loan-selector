Project Roadmap & Progress Tracker

1. Database Schema, Form & Recommendation Engine
Status: In Progress (Core frontend & data flow designed)
* [x] Design multi-step questionnaire data structure (WizardFormData)[cite: 3]
* [x] Implement configuration-driven UI (QUESTIONNAIRE config dictionary)[cite: 3]
* [x] Finalize Supabase & Prisma database schema (Users, Applications, Leads)
* [ ] Add Lender and Lender Product relational tables in Prisma & Supabase
* [ ] Write the backend recommendation algorithm matching borrower profile (LVR, serviceability, employment) to lender products

2. Consumer Data Right (CDR) Integration
Status: Pending
* [ ] Define CDR data schema & database storage tables for open banking data
* [ ] Establish CDR API fetching service/integration connector
* [ ] Build parser service to process incoming CDR financial payloads (income verification, liabilities, expenses)

3. Supabase Authentication & Security
Status: Architecture Designed / Implementation Ready
* [x] Design Aussie-style progressive profiling flow (Email lead capture -> Phone OTP)[cite: 3]
* [ ] Configure Supabase Auth Phone OTP provider and Twilio/SMS settings
* [ ] Implement secure session management and middleware route protection

4. Frontend Client-Side Application
Status: Core Wizard & Auth Flow Built
* [x] Build responsive URL-driven Wizard component (/get-started with ?q=... routing)[cite: 3]
* [x] Build standalone secure authentication & verification page (/sign-up with progressive profiling)[cite: 1]
* [ ] Connect local storage data persistence to Supabase session binding upon OTP verification
* [ ] Build the borrower results dashboard / matched rates display view

5. Frontend Admin Portal
Status: Pending
* [ ] Setup admin layout, routing, and role-based access control (RBAC)
* [ ] Build lead pipeline management table (viewing unverified/verified leads and applications)
* [ ] Build lender & product configuration management UI for brokers

6. Background Automation & Cron Jobs
Status: Pending
* [ ] Setup scheduled tasks (cron jobs) for lead nurturing or expired rate checks
* [ ] Configure webhooks for Supabase auth events and asynchronous CDR data synchronization

7. Production Deployment & DevOps
Status: Pending
* [ ] Configure production environment variables & build pipeline (Vercel + Supabase)
* [ ] Run production database migrations via Prisma
* [ ] Setup domain configuration, SSL certificates, and error tracking (e.g., Sentry)