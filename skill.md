---
name: smart-loan-context
description: Context for the Smart Loan Selector (Fintech) project. Use when the user asks about the loan app, Prisma 7, Next.js, or Supabase integrations.
---
# Smart Loan Selector Project Context

## Tech Stack & Specific Versions
- **Framework:** Next.js 16 (App Router)
- **Database / Auth:** Supabase (PostgreSQL, Passwordless Phone OTP)
- **ORM:** Prisma v7 (`@prisma/client` ^7.10.0, `@prisma/adapter-pg`)
  - *Prisma 7 Gotcha:* `url` is removed from `schema.prisma`. Uses `prisma.config.ts` for CLI commands. Requires passing the pg adapter directly to the `PrismaClient` constructor in code. Seed commands are in `prisma.config.ts`.
- **Styling/UI:** Tailwind CSS v4, Shadcn UI, Radix UI.
- **Package Manager:** pnpm
- **TypeScript Executor:** tsx
- **Validation:** Zod 4.6.5

## Domain Context
- Australian Fintech application for Mortgage product recommendations.
- Flow: Multi-step Questionnaire -> Phone OTP via Supabase -> Save `pending_loan_data` to DB.
- Key Models: Profile, Application, Lender, LenderProduct.
- Future roadmap: CDR (Open Banking) integration.