---
name: rirhub-churn-retention
description: >-
  Use this skill when working on churn prediction, retention analytics, the
  /retencion page, ML model inference, feature computation crons, or
  re-engagement actions (push/support ticket). Covers both sklearn local
  and Vertex AI tiers.
---

# Churn Prediction & Retention (AI Module)

## Feature Flag

Controlled by developer, NOT by the gym client:
- `AI_CHURN_ENABLED=1` → module active (menu visible, crons run)
- `AI_CHURN_ENABLED=0` or absent → hidden, crons skip immediately

## Architecture: Two Tiers

### Tier 1: sklearn_local (Default/MVP)

- Logistic Regression trained with scikit-learn
- Weights + StandardScaler exported to `server/models/churn-weights.json`
- Inference in pure TypeScript: `server/utils/churn-model.ts` (<0.1ms)
- Zero external dependencies, no cold-start penalty

### Tier 2: vertex_ai (Enterprise)

- Google Cloud Vertex AI AutoML Tabular
- `server/utils/vertex-ai.ts` — OAuth2 via GoogleAuth
- Endpoint inference against dedicated model
- **Auto-fallback** to sklearn_local if cloud unreachable

**Env vars**: `AI_CHURN_PROVIDER` (`sklearn_local`|`vertex_ai`),
`AI_CHURN_PLAN`, `AI_CHURN_ALERT_THRESHOLD`, Vertex AI credentials.

## Feature Computation (Cron 03:00 CDMX)

`POST /api/cron/churn-features`:

1. For each active member, computes:
   - Visits last 30 days (from `users/{id}/visits`)
   - Weekly variance
   - Days since last visit
   - Class cancellations
   - Support tickets
   - Loyalty streaks
2. Saves to `users/{id}/churn_features/{date}`
3. Denormalizes to `users/{id}.latest_churn_features` (avoids N+1)

## Prediction (Cron 03:30 CDMX)

`POST /api/cron/churn-predict`:

1. Evaluates active members using selected provider
2. Updates on member doc:
   - `churn_risk_ml` (0-1 probability)
   - `churn_risk_level` (Alto/Medio/Bajo)
   - `churn_top_factors` (explanatory strings: "Absent 18 days", etc.)
3. Records telemetry in `usage_analytics` (for billing)

## B2B Console (`/retencion`)

- Access: Admin + Manager (filtered to own branch)
- KPI cards: High/Medium/Low risk counts
- Member table with risk level, top factors, days since last visit
- Individual recalculation: `POST /api/analytics/churn-score`
- Re-engagement actions:
  - Send reactivation push FCM
  - Create proactive support ticket
  - Both via `POST /api/analytics/reengage-member`

## Training Scripts

- `scripts/train-churn-model.py` — synthetic dataset or Firestore, exports weights
- `scripts/export-vertex-dataset.py` — CSV for AutoML Tabular training
