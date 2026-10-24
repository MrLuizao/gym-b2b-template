---
name: rirhub-support-chat
description: >-
  Use this skill when working on the support/chat system between members and
  staff, the /soporte page, unread badges, push notifications for support,
  or conversation lifecycle (creation, resolution, auto-expiration).
---

# Support Chat System

## Data Model

- `conversations/{id}` — active conversations only (deleted on resolve)
  - `member_id`, `member_name`, `branch_id`, `status`, `last_message_at`
  - `unread_member`, `unread_staff` — counters
  - `expires_at` — `last_message_at + 24h` (renewed on each message)
- `conversations/{id}/messages/{id}` — individual messages
  - `sender` (`member`|`staff`), `text`, `created_at`
  - Also has `expires_at` for TTL

## Conversation Lifecycle

1. **Creation** (lazy, on first message from member):
   - `POST /api/support/conversations` — created when member sends first msg
   - NOT created when opening the support screen
2. **Messaging**:
   - `POST /api/support/{id}/messages` — adds message
   - Increments `unread_member` or `unread_staff` based on sender
   - Renews `expires_at` (+24h from now)
   - Staff reply → push FCM to `member_{memberDocId}` with `data.type='support'`
3. **Reading**:
   - `GET /api/support/{id}/messages` — returns messages
   - Resets `unread_member` or `unread_staff` based on who's reading
4. **Resolution**:
   - `POST /api/support/{id}/resolve` — **deletes** doc + all messages
   - No history kept
5. **Auto-expiration**:
   - Auto-checkout cron sweeps conversations where `last_message_at > 24h ago`
   - Firestore TTL policy on `expires_at` (if enabled in console) does the same
   - Both mechanisms coexist safely

## B2B UI (`/soporte`)

- Left: conversation list (filtered by `branch_id` for non-admin)
- Right: chat panel with realtime listeners (`onSnapshot`)
- Status/ordering done in-memory (no compound index needed)
- Any staff can respond; manager/receptionist limited to own branch

## Unread Badge (`useSupportUnread`)

- Singleton composable — listens to `unread_staff` across conversations
- Shows red badge in sidebar menu
- Toast notification + beep via Web Audio API
- Browser allows audio after first user click

## Rate Limits

- Create conversation: 5/min per user
- Send message: 20/min per user
