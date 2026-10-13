-- Manually reviewed initial cashback batch per the user's instruction to ignore
-- generic "eligible / T&Cs apply / other criteria unchanged" wording for now.
-- Run only for these eight current CASHBACK_OFFER source snapshots.
BEGIN;

UPDATE promotion_source_snapshots
SET review_status = 'REVIEWED',
    reviewed_at = NOW(),
    reviewed_by = 'manual-review'
WHERE id IN (
  '1bfa15e4-7ba2-4680-aee0-2ecc54d1cbc0',
  '48b48a61-1c57-4938-a53d-42ef40033824',
  '3677365e-5fd1-4af9-89a9-710046a2266e',
  'd25ce431-4e65-4ef6-a32a-162285256f43',
  'd6e61285-699d-4f3b-8a28-6d3260b50330',
  '38824efe-c667-4385-b5eb-a4e760982d55',
  '3c7e0852-bb96-40fb-9cf0-d057fae63584',
  'ddff1150-df8a-4d66-a603-8092531a16f7'
)
  AND is_current = TRUE
  AND change_type = 'DISCOVERED'
  AND source_feature->>'featureType' = 'CASHBACK_OFFER';

UPDATE promotions
SET status = 'PUBLISHED',
    parse_status = 'PARSED',
    reviewed_at = NOW(),
    reviewed_by = 'manual-review',
    updated_at = NOW()
WHERE source_snapshot_id IN (
  '1bfa15e4-7ba2-4680-aee0-2ecc54d1cbc0',
  '48b48a61-1c57-4938-a53d-42ef40033824',
  '3677365e-5fd1-4af9-89a9-710046a2266e',
  'd25ce431-4e65-4ef6-a32a-162285256f43',
  'd6e61285-699d-4f3b-8a28-6d3260b50330',
  '38824efe-c667-4385-b5eb-a4e760982d55',
  '3c7e0852-bb96-40fb-9cf0-d057fae63584',
  'ddff1150-df8a-4d66-a603-8092531a16f7'
)
  AND status = 'DRAFT';

COMMIT;
