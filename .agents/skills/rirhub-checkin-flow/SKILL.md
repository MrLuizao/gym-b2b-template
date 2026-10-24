---
name: rirhub-checkin-flow
description: >-
  Use this skill when working on check-in, checkout, capacity management,
  auto-checkout cron, or partner/aggregator (Wellhub/TotalPass) integrations.
  Covers the full check-in lifecycle: scan → validate membership → capacity
  transaction → loyalty points → auto-checkout → close-day sweep.
---

# Check-in & Capacity Flow

## Entry Points

| Action | Endpoint | File |
|---|---|---|
| Check-in (socio) | `POST /api/checkin` | `server/api/checkin.post.ts` |
| Check-in (partner) | `POST /api/partners/checkin` | `server/api/partners/checkin.post.ts` |
| Checkout manual | `POST /api/checkin` (body `checkout: true`) | same |
| Adjust capacity | `POST /api/branches/{id}/adjust` | `server/api/branches/[id]/adjust.post.ts` |
| Auto-checkout cron | `POST /api/cron/auto-checkout` | `server/api/cron/auto-checkout.post.ts` |
| Close day | `POST /api/branches/{id}/close-day` | `server/api/branches/[id]/close-day.post.ts` |

## Check-in Flow (socio)

1. Staff scans QR → `ScannerPanel.vue` calls `POST /api/checkin`
2. Server validates:
   - Member exists, membership ACTIVE, not expired
   - Plan branch scope (`all_branches` or member's `branch_id` matches)
   - `current_capacity < max_capacity` (transaction)
   - No duplicate active check-in
3. Creates `checkins/{id}` doc, increments `branches.current_capacity`
4. Calls `recordVisitAndReward()` (loyalty — try/catch, won't block check-in)
5. Returns member info + check-in result to scanner

## Capacity Rules

- `branches.current_capacity`: +1 on check-in, -1 on checkout, =0 on close-day
- `adjust.post`: `delta` (relative) or `value` (absolute), transactional with clamp ≥0
- Permissions: admin any branch, manager own branch, receptionist **cannot**
- `capacity_adjusted_at/by` timestamp for audit trail

## Auto-Checkout (Cron every 15min)

- Finds checkins >90min without checkout
- Decrements `current_capacity` in transaction with clamp to 0
- Sets `release_reason: 'auto_checkout_cron'`
- Doc stays in `checkins` until close-day sweep

## Partner Check-ins (Wellhub/TotalPass)

- `ScannerPanel` partner mode → `POST /api/partners/checkin`
- `validatePartnerToken()` in `server/utils/partners.ts` (**mock today**)
- Written to `checkins` with `provider`, `external_id`, `user_id: null`, `method: 'partner'`
- Dedupe: one `external_id` per day per provider
- Same capacity/TTL/close-day as regular members

## Close-Day Sweep

- `sweepCheckins` + `sweepClassBookings` in `server/utils/close-day.ts`
- Aggregates to `dailyStats` by (branch, check-in date)
- Updates `forecasts` (EMA by weekday)
- Deletes checkin docs, clears `active_checkin_*` from members
- Resets `current_capacity = 0`, resets class `booked`/`booked_by_date`

## UI Components

- `app/pages/recepcion.vue` — Scanner page
- `app/components/ScannerPanel.vue` — QR scanner + result display
- `app/components/ScanResultPanel.vue` — Check-in result card
- `app/components/CheckInsList.vue` — Active check-ins list
