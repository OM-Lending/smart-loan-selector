-- Seed reviewed-for-entry drafts from the supplied promotion_source_snapshots_rows.sql.
-- Deliberately keep promotions DRAFT/UNPARSED and source snapshots REVIEW_REQUIRED:
-- the source text says other eligibility criteria/T&Cs apply and is not a complete rule set.
-- Safe to rerun: (source_snapshot_id, version) is unique and conflicts are left unchanged.
BEGIN;

INSERT INTO promotions (
  id, source_snapshot_id, version, promotion_type, name, amount, currency,
  required_goal, minimum_loan_amount, maximum_loan_amount, first_home_buyer_only,
  application_window_start, application_window_end,
  settlement_within_days, drawdown_within_days,
  eligibility_rules, exclusion_rules, terms,
  status, parse_status, created_at, updated_at
)
SELECT
  gen_random_uuid(), v.source_snapshot_id::uuid, 1, 'CASHBACK', v.name, v.amount,
  'AUD', v.required_goal::"LoanGoal", v.minimum_loan_amount, NULL, v.first_home_buyer_only,
  v.application_window_start::date, v.application_window_end::date,
  v.settlement_within_days, v.drawdown_within_days,
  '{}'::jsonb, '{}'::jsonb, v.terms,
  'DRAFT', 'UNPARSED', NOW(), NOW()
FROM (VALUES
  (
    '1bfa15e4-7ba2-4680-aee0-2ecc54d1cbc0', 'myBOQ Refinance Cashback', 2000.00,
    'REFINANCE', NULL::numeric, FALSE,
    '2026-08-28', '2027-02-28', 120, NULL::integer,
    'The $2000 myBOQ Refinance Cashback offer is being introduced for myBOQ applications submitted on or after Friday, 28 August 2026 until the application deadline of Sunday, 28 February 2027, and must settle within 120 days of the loan application date.'
  ),
  (
    '48b48a61-1c57-4938-a53d-42ef40033824', 'myBOQ Refinance Cashback', 2000.00,
    'REFINANCE', NULL::numeric, FALSE,
    '2026-08-28', '2027-02-28', 120, NULL::integer,
    'The $2000 myBOQ Refinance Cashback offer is being introduced for myBOQ applications submitted on or after Friday, 28 August 2026 until the application deadline of Sunday, 28 February 2027, and must settle within 120 days of the loan application date.'
  ),
  (
    '3677365e-5fd1-4af9-89a9-710046a2266e', 'BOQ Classic Refinance Cashback', 2000.00,
    'REFINANCE', NULL::numeric, FALSE,
    '2026-08-28', '2027-02-28', 120, NULL::integer,
    'The $2000 BOQ Classic Refinance Cashback offer is being extended for applications submitted on or after Friday, 28 August 2026 until the new application deadline of Sunday, 28 February 2027, and must settle within 120 days of the loan application date. All other eligibility criteria will remain unchanged.'
  ),
  (
    'd25ce431-4e65-4ef6-a32a-162285256f43', 'BOQ Classic Refinance Cashback', 2000.00,
    'REFINANCE', NULL::numeric, FALSE,
    '2026-08-28', '2027-02-28', 120, NULL::integer,
    'The $2000 BOQ Classic Refinance Cashback offer is being extended for applications submitted on or after Friday, 28 August 2026 until the new application deadline of Sunday, 28 February 2027, and must settle within 120 days of the loan application date. The source repeats this sentence; all other eligibility criteria remain unchanged.'
  ),
  (
    'd6e61285-699d-4f3b-8a28-6d3260b50330', 'BOQ Classic Refinance Cashback', 2000.00,
    'REFINANCE', NULL::numeric, FALSE,
    '2026-08-28', '2027-02-28', 120, NULL::integer,
    'The $2000 BOQ Classic Refinance Cashback offer is being extended for applications submitted on or after Friday, 28 August 2026 until the new application deadline of Sunday, 28 February 2027, and must settle within 120 days of the loan application date.'
  ),
  (
    '38824efe-c667-4385-b5eb-a4e760982d55', 'ANZ First Home Buyer Cashback', 3000.00,
    'BUY', 250000.00, TRUE,
    NULL::date, NULL::date, NULL::integer, 180,
    'If you are buying your first home, you could get $3,000 to spend however you like, plus support from an ANZ First Home Coach. Available to eligible first home buyers with an ANZ home loan of $250,000 or more. Drawdown within 180 days of applying; bonus paid after settlement. Eligibility criteria and T&Cs apply.'
  ),
  (
    '3c7e0852-bb96-40fb-9cf0-d057fae63584', 'ANZ First Home Buyer Cashback', 3000.00,
    'BUY', 250000.00, TRUE,
    NULL::date, NULL::date, NULL::integer, 180,
    'If you are buying your first home, you could get $3,000 to spend however you like, plus support from an ANZ First Home Coach. Available to eligible first home buyers with an ANZ home loan of $250,000 or more. Drawdown within 180 days of applying; bonus paid after settlement. Eligibility criteria and T&Cs apply.'
  ),
  (
    'ddff1150-df8a-4d66-a603-8092531a16f7', 'ANZ First Home Buyer Cashback', 3000.00,
    'BUY', 250000.00, TRUE,
    NULL::date, NULL::date, NULL::integer, 180,
    'If you are buying your first home, you could get $3,000 to spend however you like, plus support from an ANZ First Home Coach. Available to eligible first home buyers with an ANZ home loan of $250,000 or more. Drawdown within 180 days of applying; bonus paid after settlement. Eligibility criteria and T&Cs apply.'
  )
) AS v(
  source_snapshot_id, name, amount, required_goal, minimum_loan_amount,
  first_home_buyer_only, application_window_start, application_window_end,
  settlement_within_days, drawdown_within_days, terms
)
JOIN promotion_source_snapshots s
  ON s.id = v.source_snapshot_id::uuid
 AND s.is_current = TRUE
 AND s.change_type = 'DISCOVERED'
 AND s.review_status = 'REVIEW_REQUIRED'
 AND s.source_feature->>'featureType' = 'CASHBACK_OFFER'
ON CONFLICT (source_snapshot_id, version) DO NOTHING;

COMMIT;
