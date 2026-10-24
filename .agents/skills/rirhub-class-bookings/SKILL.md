---
name: rirhub-class-bookings
description: >-
  Use this skill when working on class management, class bookings/reservations,
  roster views, or the /clases pages. Covers class CRUD, per-occurrence booking,
  branch-specific capacity, trainer assignment, and close-day reset.
---

# Class Bookings System

## Class Model

- Collection: `classes` in Firestore
- Key fields: `name`, `trainer_id`, `schedule` (weekday + time), `max_capacity`,
  `branch_times` (per-branch schedule overrides), `booked_by_date`

## Booking Flow (Per-Occurrence)

`POST /api/classes/{id}/book` `{date?, branchId?}`:

1. Validates:
   - Membership ACTIVE + not expired
   - Date in `[today, today+8]` (CDMX timezone)
   - If today: class hasn't ended yet (checks `end_minutes` + `branch_times`)
   - Branch scope: `all_branches` or member's branch matches
2. **Transaction** on `classes.booked_by_date[date][branchId]`:
   - Checks `< max_capacity` for that branch+date
   - Increments count
3. Creates `bookings/{id}`:
   - `class_id`, `class_date` (YYYY-MM-DD CDMX), `auth_uid`, `branch_id`, `status: 'confirmed'`
4. Idempotent: same class+member+date = no duplicate

### Cancellation

`DELETE /api/classes/{id}/book?date=`:
- Sets booking `status: 'cancelled'`
- Decrements `booked_by_date[date][branchId]`

## Capacity Tracking

- `classes.booked` = legacy mirror of "total booked today" (compat)
- `classes.booked_by_date` = `{date: {branchId: count}}` — **real source**
  - Per-branch capacity: each branch has its own count
  - Legacy flat values migrate to booking's branch (or `'_'` on read)
- Close-day resets `booked` and prunes keys `<= today`; future dates preserved

## Roster

`GET /api/classes/{id}/roster` — confirmed bookings for today:
- Staff with branch sees only their branch's bookings
- Returns member info + booking status

## UI Pages

- `/clases` — class list with schedule grid
- `/clases/[id]` — class detail + roster
- `/clases/nuevo` — create class (admin/manager)

## Permissions

- View: all roles
- Edit schedule/room (branch-specific fields): manager (own branch) + admin
- Edit global fields (name, trainer, max_capacity): admin only
- Create: admin + manager (auto-assigned to own branch)
