-- Promotion application windows are calendar dates, not instants. Preserve the
-- configured calendar day while removing timestamp/time-zone ambiguity.
ALTER TABLE "promotions"
  ALTER COLUMN "application_window_start" TYPE DATE
    USING "application_window_start"::DATE,
  ALTER COLUMN "application_window_end" TYPE DATE
    USING "application_window_end"::DATE;
