# Cashback source review and manual rule test

## Sync behavior

The CDR sync preserves the complete product payload as before and separately tracks likely cashback features. A candidate is found by the standard `CASHBACK_OFFER` feature type or cashback/rebate wording. The source fingerprint covers its type, amount/value, text, description, and information URL; presentation whitespace and common tracking parameters do not create a new revision.

New or changed source revisions are inserted into `promotion_source_snapshots` with `review_status = REVIEW_REQUIRED`. A missing offer is represented by a tombstone only when the successfully fetched product detail explicitly contains a `features` array. The source snapshot is evidence and a review notification; it is never itself an active offer rule.

Only a rule with `status = PUBLISHED`, `parse_status = PARSED`, an in-window validity period, and a current source snapshot marked `REVIEWED` is read by recommendations. A new source revision does not overwrite the previous rule. Since the recommender requires a current reviewed snapshot, an upstream change pauses the previous rule from ranking until it is reviewed and a rule is published against the new revision.

## Structured conditions

Common offer conditions are stored in typed promotion columns so the matching
engine can apply them consistently:

- `required_goal`: `BUY` or `REFINANCE`.
- `minimum_loan_amount` / `maximum_loan_amount`.
- `first_home_buyer_only`.
- `application_window_start` / `application_window_end`: the qualifying lender
  application date window. Preliminary recommendations use the recommendation
  calculation date as the assumed lender application date.
- `settlement_within_days` / `drawdown_within_days`: maximum elapsed days from
  lender application, supplied as `promotion_answers.daysToSettlement` or
  `promotion_answers.daysToDrawdown`. If the applicant has not provided an
  estimate, preliminary ranking assumes the stated window will be met.

Nullable numeric/date fields mean no condition was configured. Missing first-home
buyer status or an unknown custom rule still produces `NEEDS_REVIEW`; timing
assumptions are explicitly used for preliminary comparison and must be disclosed
to applicants. `first_home_buyer_only = false` means no first-home-buyer
restriction. These columns are optional so existing promotions remain valid.

## Advanced rule JSON format

The rule root must contain `all` or `any`. A rule can be nested in either group. Supported operators are `EQ`, `NEQ`, `IN`, `GTE`, `GT`, `LTE`, and `LT`. Use paths under `application.*` or `loan.*`. Missing application answers return `NEEDS_REVIEW`; they are never treated as true.

Use the JSON fields only for additional reviewed conditions that do not fit the
typed columns (for example an eligible account requirement). Common conditions
should use the typed columns above. Example additional ANZ rule (verify current
terms before publishing):

```json
{
  "all": [
    { "field": "application.hasEligibleLenderAccount", "op": "EQ", "value": true }
  ]
}
```

Example exclusions:

```json
{
  "any": [
    { "field": "application.hasGovernmentGuarantee", "op": "EQ", "value": true },
    { "field": "application.hasLmiWaiver", "op": "EQ", "value": true },
    { "field": "application.isAnzPlusHomeLoan", "op": "EQ", "value": true }
  ]
}
```

The base application currently supplies `goal`, `isFirstHomeBuyer`, `propertyUse`,
loan amount, and LVR. Extra applicant facts such as lender-account status,
guarantee/LMI exclusions, lender application date, and settlement/drawdown timing
can be stored in `applications.promotion_answers` for development trials; the
customer questionnaire does not collect all of them yet. Missing required facts
must remain unknown and must never be filled with assumed test values for a real
applicant.

## Query the review queue

```sql
SELECT
  s.id AS source_snapshot_id,
  l.name AS lender,
  p.external_id,
  p.product_name,
  s.change_type,
  s.review_status,
  s.suggested_amount,
  s.amount_parse_status,
  s.source_feature,
  s.last_observed_at
FROM promotion_source_snapshots s
JOIN loan_products p ON p.id = s.product_id
JOIN lenders l ON l.id = p.lender_id
WHERE s.review_status = 'REVIEW_REQUIRED'
ORDER BY s.last_observed_at DESC;
```

## Publish a reviewed rule for a local test

After verifying the source text and current bank terms, use the `source_snapshot_id` from the query above. Replace the UUID and dates with the revision you checked. `suggested_amount` is only a convenience extracted from an explicit numeric value or a single currency amount in the text; it is not automatically approved. Set a real `valid_from` and `valid_until` from the offer terms before publishing.

```sql
BEGIN;

UPDATE promotion_source_snapshots
SET review_status = 'REVIEWED', reviewed_at = NOW(), reviewed_by = 'local-admin'
WHERE id = 'REPLACE-WITH-SOURCE-SNAPSHOT-UUID'
  AND is_current = TRUE
  AND change_type <> 'REMOVED';

INSERT INTO promotions (
  id, source_snapshot_id, version, promotion_type, name, amount, currency,
  required_goal, minimum_loan_amount, maximum_loan_amount, first_home_buyer_only,
  application_window_start, application_window_end, settlement_within_days, drawdown_within_days,
  eligibility_rules, exclusion_rules, terms, valid_from, valid_until,
  status, parse_status, reviewed_at, reviewed_by, created_at, updated_at
)
VALUES (
  gen_random_uuid(), 'REPLACE-WITH-SOURCE-SNAPSHOT-UUID', 1, 'CASHBACK',
  'ANZ first home buyer cashback', 3000.00, 'AUD',
  'BUY', 250000.00, NULL, TRUE,
  NULL, NULL, NULL, 180,
  '{"all":[{"field":"application.hasEligibleLenderAccount","op":"EQ","value":true}]}',
  '{"any":[{"field":"application.hasGovernmentGuarantee","op":"EQ","value":true},{"field":"application.hasLmiWaiver","op":"EQ","value":true},{"field":"application.isAnzPlusHomeLoan","op":"EQ","value":true}]}',
  'Verify the current official ANZ offer terms before use.', NULL, NULL,
  'DRAFT', 'UNPARSED', NULL, NULL, NOW(), NOW()
);

COMMIT;
```

The inserted draft is intentionally excluded from recommendations. After replacing the validity dates with dates verified from the applicable official offer terms and confirming every rule, change its state with:

```sql
UPDATE promotions
SET valid_from = 'REPLACE-WITH-VERIFIED-START'::timestamptz,
    valid_until = 'REPLACE-WITH-VERIFIED-END'::timestamptz,
    status = 'PUBLISHED',
    parse_status = 'PARSED',
    reviewed_at = NOW(),
    reviewed_by = 'local-admin'
WHERE source_snapshot_id = 'REPLACE-WITH-SOURCE-SNAPSHOT-UUID'
  AND version = 1;
```

For a local-only match test, add simulated answers to the chosen application. This bypasses user input and must not be used as real applicant data:

```sql
UPDATE applications
SET promotion_answers = '{"hasEligibleLenderAccount":true,"daysToDrawdown":120,"hasGovernmentGuarantee":false,"hasLmiWaiver":false,"isAnzPlusHomeLoan":false}'
WHERE id = 'REPLACE-WITH-APPLICATION-UUID';
```

After publishing, regenerate recommendations for that application. The normal monthly repayment remains unchanged. A qualifying cashback reduces the 60-month net comparison cost; an unknown condition leaves cashback out of ranking and labels it as needing review.
