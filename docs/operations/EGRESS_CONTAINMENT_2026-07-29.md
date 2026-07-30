# Egress containment — 2026-07-29

## Confirmed findings

1. Field Log review pages automatically fetched up to 50 records every 20 seconds.
2. Field Log "My Logs" pages automatically fetched every 30 seconds.
3. The `field_log_get_my_submissions` RPC returned the user's complete history with no upper bound.
4. The Home activity feed automatically refreshed every five minutes.
5. Each Home feed refresh loaded home/session context from Supabase even though the feed provider currently returns an empty list.

## Containment applied

- Field Log background polling has been removed. These pages now refresh only
  on initial navigation, an explicit user action, or a successful mutation.
- Dispatch Console has no timer-, focus-, or visibility-driven refresh loop.
  Its Refresh controls remain user-driven.
- Initial page hydration and manual refresh buttons continue to work.
- The unrelated Home activity feed remains disabled by default and hidden tabs
  do not refresh it if an operator explicitly restores background polling with
  `NEXT_PUBLIC_ENABLE_BACKGROUND_POLLING=true`.
- The empty Home feed endpoint no longer loads unused home/session context.
- The "My Logs" RPC and route now cap responses at 50 records.
- The Field Log landing page no longer downloads 30 days of raw reports.
  `field_log_dashboard_batch` performs the rollup in PostgreSQL and returns
  compact totals plus no more than 25 lightweight work items.
- Technician dashboard scope is forced to the authenticated user's records.
  Elevated users are constrained to the selected organization, and the server
  derives the effective scope from the access pass.
- Dashboard interests are explicit (`review`, `follow_up`, `cases`, `billing`,
  `aging`, and `history`) and load as one bounded batch.

## Deployment order

1. Apply `20260729140000_limit_field_log_my_submissions.sql`.
2. Deploy the web application.
3. Leave `NEXT_PUBLIC_ENABLE_BACKGROUND_POLLING` unset or set it to `false`.
4. Compare Supabase egress over an equivalent 24-hour window.

The web deployment and database migration must ship together because the route now sends the new `p_limit` RPC argument.

## Next measurement

Capture, by route/RPC, request count and response bytes for at least 24 hours. Rank by total bytes. The next optimization should target the largest measured source rather than the largest call count.
