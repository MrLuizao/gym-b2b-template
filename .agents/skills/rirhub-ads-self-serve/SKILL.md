---
name: rirhub-ads-self-serve
description: >-
  Use this skill when working on the advertising system: self-serve ad purchase
  (/anuncia page), Stripe Checkout, ad orders, approval/rejection workflow,
  push packages, campaign expiration, stats tracking, or the /publicidad admin
  pages. Covers the full lifecycle from purchase to expiration report.
---

# Self-Serve Advertising System

## Purchase Flow (Public `/anuncia` page)

1. Advertiser fills form: business info, creative (image), placement, weeks, optional push pack
2. `LocationPicker.vue` — Leaflet/Carto dark map, Nominatim geocoding (MX)
3. Submits → `POST /api/ads/checkout` creates Stripe Checkout Session
   - Line item 1: `price_per_week × weeks` (from `/config/ads`)
   - Line item 2 (optional): push pack price
4. Redirect to Stripe hosted checkout

## Stripe Webhooks

| Event | Handler |
|---|---|
| `checkout.session.completed` | Creates `sponsorAds` (PENDING) + `adOrders` (PENDING_APPROVAL) |
| `payment_intent.succeeded` | Backup via `ad_order_id` in metadata |
| `checkout.session.expired` | Marks order EXPIRED |

## Approval Flow (Admin `/publicidad`)

- **Approve**: Sets `sponsorAds.status = ACTIVE`, `ends_at = now + weeks`
  - Fires 1 free push (SPONSOR kind, audience ALL)
  - Creates DRAFT push logs for pack pushes (weekly schedule)
- **Reject**: Triggers Stripe refund, deletes creative
  - If refund fails → nothing changes (safety)

## Placement Rules

- `carousel` (premium): Home carousel + Promotions + top of Allies directory
  - **5 slots max** (`CAROUSEL_SLOTS`) — oldest by `created_at` win
  - Overflow appears in list only, moves up when a slot frees
- `list`: Allies directory only, random order
- Legacy `both` or missing → normalized to `carousel` on read

## Ad Stats & Tracking

- `POST /api/ads/track` `{adId, event: 'impression'|'tap'}` (member)
- Dedupe: `/adEvents/{adId}_{uid}_{date}_{event}` with `create()`
- Daily aggregation: `/adStats/{adId}_{date}` — impressions, taps
- Rate-limited: 30/min per user
- Stats API: `GET /api/ads/{id}/stats` (admin/manager) → 30-day chart

## Campaign Expiration (Cron `GET /api/cron/ads-report`)

- Daily 10:30 CDMX (vercel.json)
- Finds ACTIVE ads with `ends_at` expired → marks EXPIRED
- Sends campaign report email to advertiser (impressions/taps/CTR + pushes sent)
- Sets `adOrders.report_sent_at`

## Push Dispatch (Cron `GET /api/cron/push-dispatch`)

- Daily ~10:00 CDMX
- Dispatches DRAFT push logs where `scheduled_at <= now`
- Same engine as CMS scheduled pushes

## Reactivation Rules

Reactivating an expired ad requires EITHER:
- **Counter payment**: amount + method + receipt → creates approved `adOrders`
- **Courtesy justification**: mandatory reason → logged in `/auditLogs`

Both require a **future `ends_at`** date. Backend rejects without these.

## Integrity Rules for Paid Ads

- Upgrade placement: free
- Downgrade/pause/delete active paid ad: requires `overrideReason` → audit log
- EXPIRED ads: free to delete (campaign fulfilled)
- PENDING ads: cannot delete via DELETE — reject from order instead
- Cannot manually activate PENDING — only via approve flow
