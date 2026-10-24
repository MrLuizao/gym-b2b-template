---
name: rirhub-loyalty-rewards
description: >-
  Use this skill when working on the loyalty system: weekly goals, visit
  tracking, points, streaks, rewards catalog, redemption codes, or the
  /recompensas page. Covers points earning, streak bonuses, reward CRUD,
  stock management, redemption validation, and expiration reminders.
---

# Loyalty & Rewards System

## Points Earning

### On Check-in (`recordVisitAndReward` in `server/utils/loyalty.ts`)

1. Writes `users/{id}/visits/{yyyy-mm-dd}` (doc id = date CDMX → dedupe)
2. Counts visits this week (Mon-Sun CDMX)
3. If visits ≥ `users.weekly_goal` (default 4) AND not awarded this week:
   - Adds `GOAL_BONUS_POINTS` (50) to `users.points`
   - Sets `goal_awarded_week` to current week identifier
   - Increments `points_earned` (lifetime accumulator)
4. **Streak bonuses** (consecutive weeks meeting goal):
   - 2 weeks → +25, 4 weeks → +50, 8 weeks → +100, 12 weeks → +150
   - Tracked via `goal_streak` + `goal_streak_week`
5. Records in `users/{id}/pointsHistory` via `recordPointsHistory`
6. Sends push FCM to `member_{userId}` with `data.type='loyalty'`

**Failure does NOT block check-in** (wrapped in try/catch).

## Rewards Catalog

- Collection: `rewards` in Firestore
- Fields: `name`, `description`, `points_cost`, `image_url`, `active`, `stock` (null = unlimited), `redeemed_count`
- CRUD: `GET/POST /api/rewards` + `PUT /api/rewards/:id` (admin only)
- Page: `/recompensas` — catalog tab + redemptions tab + KPIs

## Redemption Flow

`POST /api/rewards/redeem` `{rewardId}` (member endpoint):

1. Transaction validates:
   - `rewards.active === true`
   - Member `points >= points_cost`
   - `redeemed_count < stock` (if stock not null)
2. Decrements `users.points`, increments `rewards.redeemed_count`
3. Creates `users/{id}/redemptions/{id}`:
   - `code: 'RWR-XXXXXX'` (6-char random)
   - `status: 'active'`
   - `expires_at`: 30 days from now
   - `reward_id`, `reward_name`, `points_spent`, `branch_id`
4. Sends push confirmation with code
5. Records in `pointsHistory` (negative entry)

## Redemption Validation (Staff)

`POST /api/rewards/redemptions` `{code}` (staff endpoint):

- Looks up code across all users' redemptions (collectionGroup query)
- Validates: status `active`, not expired, branch scope
- Marks `status: 'used'`, sets `used_at`, `used_by`

## KPIs (`GET /api/rewards/stats`)

- Total `points_earned` issued
- Total live `points` balance
- Members who met goal this week
- Scoped by branch for non-admin

## Expiration Reminder Cron

- Daily 09:00 CDMX: pushes to members with codes expiring in 3 days
