# Continued application information

The questionnaire and recommendation engine are unchanged. These rules apply after a customer chooses a product and continues an application.

## Optional information

All continuation fields and document uploads are optional, including final submission. Provided email addresses, telephone numbers, dates, incomes, monetary amounts and enumerated choices are validated on the server. Previous address history can be partial; there is no three-year completeness gate. Authentication, application ownership, selected quote ownership and upload safety checks still apply. Submission still moves the application to broker review and queues the existing admin notification.

Marital status remains optional and is prefilled from the questionnaire. Residency choices are Australian citizen, Australian permanent resident and Temporary resident. Earlier free-text residency answers are retained as previousVisaStatus when an editable form is opened, without automatically asserting a new category.

Date of birth, dependent dates of birth, government benefits, employer name/ABN, home contents, shares, superannuation, personal loans, third-party contacts and additional loan requirements are removed from editable forms and new saves. Historical submitted records are not rewritten. Employer contact name, phone and position, and salary bank are also removed. Workplace address and employment phone remain optional fields.

## Property structure

The existing ApplicationContinuation.details JSON stores properties.items as an array, defaulting to no entries. Each property can contain use (OWNER_OCCUPIED or INVESTMENT), address, selection, propertyType, bedrooms and ownership. Ownership is descriptive text, for example Applicant 1: 50%; Applicant 2: 50%.

Investment properties can additionally contain marketValue, lender, loanLimit, loanBalance, loanStartDate, rentalPerWeek and leasedThrough (REAL_ESTATE_AGENT or PRIVATE). These investment fields are removed when a property is changed to owner-occupied. Address selection uses the existing verified address lookup/manual fallback mechanism. An administrative safety limit allows up to 50 property entries.

Existing properties.ownerOccupied/investment1/investment2/investment3 text notes remain visible separately. They are never automatically parsed into structured answers or duplicated as new properties. Customer submitted-details and broker review pages already render nested records and arrays.

## Documents

The shared checklist in src/lib/application-documents.ts supplies frontend labels and upload endpoint categories. New categories distinguish payslips, salary statements, ATO income statements, car loans, student loans, mortgage summaries, council rates, purchase contracts and rental statements. Identification accepts passport, driver licence or visa. Existing categories remain readable and accessible; earlier income/bank uploads are not reclassified as the new, more specific evidence.

Uploads remain private PDF/JPEG/PNG files with a 10 MB per-file limit and file signature checks. Viewing and removal continue to use authenticated application routes.

## Database structure and rollout

Migration 20261105000000_structure_continuation_information introduces five typed child tables:

- continuation_applicants: numbered applicants, optional contact/residency/marital/address/employment answers.
- continuation_addresses: ordered, optional previous address rows belonging to an applicant.
- continuation_employments: optional current and previous employment records per continuation.
- continuation_assets: optional descriptive asset/liability answers and numeric weekly rent.
- continuation_properties: ordered owned properties with typed dates, decimal amounts and conditional investment details.

Business answers are nullable. Parent IDs, unique applicant numbers/row positions and foreign keys constrain structure. Monetary fields use DECIMAL(18,2), dates use DATE, and bounded text columns constrain length. Checks enforce non-negative amounts, valid ranges, address date order and investment-only fields. Child tables enable RLS without public policies and are accessed only through authorized server endpoints.

New database enums: ResidencyStatus, OwnedPropertyUse, LeasingArrangement, ContinuationEmploymentKind and ApplicationDocumentCategory. Existing RelationshipStatus is reused, with its historical combined value forbidden in the new applicant table. EmploymentStatus is reused and extended with SELF_EMPLOYED, which was already offered by the continuation UI. Document categories are cast in place to an enum, preserving existing category values and files; an unknown category aborts the migration instead of silently rewriting data.

ApplicationContinuation.formVersion defaults to 1 for legacy records. Those records continue to read their original details JSON; no free-form historical answer is guessed or force-converted. On the next save, new typed records and formVersion 2 are written in the same transaction as details. For version 2, customer and admin reads use the typed records as their authoritative answers. details is retained as the form snapshot for address lookup metadata and legacy notes, not a separately editable source. Child rows are atomically replaced on each save; their IDs are internal and have no external references.

Apply the migration to the intended database before running/deploying this branch, then regenerate Prisma Client. Code generation and schema diff do not apply database migrations. Existing application/profile records and storage objects are not removed. Historical submitted forms are not automatically upgraded or rewritten.
