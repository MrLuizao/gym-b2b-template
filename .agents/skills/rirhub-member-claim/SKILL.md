---
name: rirhub-member-claim
description: >-
  Use this skill when working on member registration, the claim PIN flow,
  member CRUD, membership plans, payments, or the /socios pages. Covers
  the full lifecycle from staff creating a member to the end-user claiming
  their account in the Flutter app.
---

# Member Management & Claim Flow

## Member Creation (Staff)

`POST /api/members` (`server/api/members.post.ts`):

1. Staff fills form in `/socios/nuevo`:
   - Required: `member_number`, `contact_email`, `name`, `branch_id`, `plan_id`
   - Optional: phone, emergency contact, medical notes
2. Backend generates 6-digit `claim_pin`
3. Sends claim email via `server/utils/mail.ts` (SMTP)
   - No SMTP configured → logs to console + shows PIN in member detail
4. Creates `users/{id}` in Firestore with membership data
5. Returns member with PIN (shown once in UI for staff reference)

## Claim Flow (Flutter App)

`POST /api/members/claim` (member endpoint):

1. User signs in with Google/Apple in Flutter app
2. Enters `member_number` + `claim_pin`
3. Backend validates:
   - PIN matches (single-use)
   - Not locked (`claim_locked_until`)
   - **3 failed attempts → 15min lockout** (`claim_attempts`)
4. On success:
   - Links `auth_uid` to member doc
   - Clears `claim_pin`, resets attempts
   - Member can now see gym data

**Important**: `contact_email` ≠ `email` — contact is for PIN delivery,
email is the Google/Apple login. They may differ.

## PIN Regeneration

`POST /api/members/{id}/claim-pin` (staff, branch-scoped):
- Generates new 6-digit PIN
- Resends email
- Resets lockout

## Membership Plans

- Collection: `plans` — `name`, `price`, `duration_days`, `all_branches`, `features`
- CRUD: `GET/POST /api/plans` + `PUT /api/plans/:id`
- Admin only for create/edit; all roles can read
- Page: `/membresias`

## Payments

- `POST /api/payments` — records cash/card/transfer payment
- `POST /api/payments/intent` — Stripe PaymentIntent (rate-limited 10/min)
  - **Active Tier Upgrade Rule**: If the member's membership is currently `ACTIVE` and not expired (`membership_until > now`), `POST /api/payments/intent` validates that the target plan's `price` is strictly greater than their current plan's `price` (`targetPrice > currentPrice`). Downgrades or same-tier renewals while active are rejected with `400` (and locked in Flutter's `MembershipCheckoutScreen`). Expired memberships can select any active plan.
- Links to member via `user_id`, extends membership `expires_at`
- Page: member detail → payments tab

## Branch Scope Validation

- Member's `branch_id` determines their home branch
- Plans with `all_branches: false` restrict check-ins to home branch
- Staff sees members filtered by their branch (unless admin)

## Member Deactivation & Deletion (`/socios/[id]`)

- **Deactivate / Activate (`PUT /api/members/{id}`)**:
  - Accepts `membershipStatus: 'EXPIRED' | 'ACTIVE'`
  - Allowed for `ADMIN` (any branch) and `MANAGER` (own branch); `RECEPTIONIST` cannot edit
  - Setting `EXPIRED` immediately blocks check-in and class bookings while preserving payment and visit history
- **Permanent Delete (`DELETE /api/members/{id}`)**:
  - Allowed **only for `ADMIN`** (`403` for `MANAGER` and `RECEPTIONIST`)
  - Deletes `users/{id}` from Firestore after confirmation modal in `/socios/[id].vue`
