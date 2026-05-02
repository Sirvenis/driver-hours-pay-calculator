# WageCheck AU Phase 3 commercial plan

Goal: reach a paid personal/backpacker upgrade without publicly sharing an unlocked paid-feature app.

## Phase 3 completion criteria

1. Free app remains directly shareable.
2. Pro/beta features are visibly locked by default in the public app.
3. One-click timer feature exists as the first upgrade feature:
   - Start Shift stamps start time.
   - Start Break stamps break start.
   - Paid/unpaid break choice is preserved.
   - Resume stamps break finish and duration.
   - Finish Shift stamps finish time.
   - User copies timer times into the normal shift form and can manually edit before saving.
4. Landing page explains the upgrade path:
   - free beta/trial during development;
   - planned 7-day trial;
   - planned 3-month backpacker/worker pass;
   - paid launch requires secure license/payment backend.
5. Before public paid launch, replace local/static beta access with backend-verified license access.

## Current implementation status

Implemented in the static PWA:

- locked Pro Beta timer card;
- one-click Start / Break / Resume / Finish state machine;
- active timer recovery via localStorage;
- manual correction via copying timer result into the existing editable shift form;
- free app sharing/help/upgrade/suggestions links;
- service-worker cache bumped to `wagecheck-au-v18`;
- calculator tests cover timer shift flow and paid-break behavior.

Implemented on the landing page:

- Upgrade section;
- private beta/free trial language;
- planned 3-month backpacker pass language;
- note that real paid launch needs secure license/payment backend.

## Important access-control warning

A static PWA cannot securely enforce paid access by itself. JavaScript feature flags or local access codes are only suitable for private beta validation. For a real paid public launch, do not rely on client-side locking.

Recommended paid-launch stack:

- GitHub Pages keeps hosting the static app.
- Stripe Payment Links or Stripe Checkout collects payment.
- Cloudflare Worker verifies license/trial status.
- Supabase, Cloudflare D1, or Airtable stores license records.
- App calls the license endpoint before enabling Pro features.

Minimum license record:

```json
{
  "email": "worker@example.com",
  "licenseKeyHash": "...",
  "plan": "backpacker_3_month",
  "trialStartedAt": "2026-05-03T00:00:00Z",
  "trialExpiresAt": "2026-05-10T00:00:00Z",
  "accessExpiresAt": "2026-08-03T00:00:00Z",
  "status": "trialing|active|expired|revoked",
  "maxDevices": 2
}
```

Suggested first offer:

- 7-day free trial.
- AUD $9–$15 for 3 months.
- Referral/share extension later, after usage is proven.

## Next backend milestone

When Andrew is ready to connect payments, build a small `/api/license/verify` endpoint and replace the current local beta unlock with server verification.
