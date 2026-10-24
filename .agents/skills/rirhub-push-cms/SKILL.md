---
name: rirhub-push-cms
description: >-
  Use this skill when working on push notifications, the CMS pages (/cms),
  push dispatch cron, audience targeting, FCM topics, or push logs.
  Covers manual push creation, scheduling, and the topic-based delivery system.
---

# Push Notifications & CMS

## Push Log Model

Collection: `pushLogs`

| Field | Description |
|---|---|
| `title`, `body` | Notification content |
| `status` | `draft` / `sent` / `failed` |
| `target` | App tab: `auto` / `home` / `explore` / `allies` / `promos` / `profile` |
| `kind` | `BRAND` / `SPONSOR` / `PROMO` / `INFO` |
| `audience` | `all_members` / `branch_{id}` / `expired_members` |
| `scheduled_at` | When to send (used by dispatch cron) |
| `sent_at` | When actually sent |
| `sent` | 1 = success (per topic send) |

## Manual Push Flow (CMS)

1. Admin creates draft in `/cms/push/nuevo`
2. Selects audience (topic), writes content, chooses target tab
3. "Send now" → `POST /api/cms/push/send` → FCM to topic
4. Scheduling is **disabled by flag** `PUSH_SCHEDULER !== '1'` — code intact

## FCM Topics

| Topic | Audience |
|---|---|
| `all_members` | All registered members |
| `branch_{id}` | Members of specific branch |
| `expired_members` | Members with expired membership |
| `member_{docId}` | Individual member (support, loyalty, rewards) |

## Auto Target Mapping

When `target = 'auto'`, the app maps by `kind`:
- `SPONSOR` → Aliados tab
- `BRAND` → Descuentos tab
- Others → Home

## Push Dispatch Cron

`GET/POST /api/cron/push-dispatch` (daily ~10:00 CDMX):
- `dispatchDuePushLogs()` finds DRAFT logs with `scheduled_at <= now`
- Sends each via FCM
- Updates status to `sent` or `failed`
- Handles both ad package pushes and CMS scheduled pushes

## Delivery KPI

`sent` count = 1 per successful topic send (FCM doesn't expose subscriber count).
"Delivery rate" = SENT / (SENT + FAILED).

## Permissions

- View CMS: Manager (read-only) + Admin
- Create/edit/send/delete: Admin only

## Pages

- `/cms` — push list with filters
- `/cms/push/nuevo` — create push
- `/cms/push/[id]` — push detail
