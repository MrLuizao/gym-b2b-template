---
name: rirhub-auth-permissions
description: >-
  Use this skill when working on authentication, authorization, role-based
  access control, the permission matrix, middleware, or route guards.
  Covers the three staff roles (ADMIN/MANAGER/RECEPTIONIST), server-side
  enforcement, client-side guards, and App Check.
---

# Auth & Permissions System

## Staff Roles

| Role | Scope | Key Abilities |
|---|---|---|
| `ADMIN` | All branches | Full CRUD everywhere, approve ad orders, manage plans, CMS |
| `MANAGER` | Own branch (edit), all (view) | Same visibility as admin, edit restricted to `session.branchId` |
| `RECEPTIONIST` | Own branch | Scanner, view/create members, validate reward codes |

Defined in `app/composables/useAuth.ts` — `StaffRole`, `ROLE_ROUTES`, `ROLE_HOME`.

## Server-Side Enforcement

### `requireStaff(event, allowedRoles?, branchScope?)`
File: `server/utils/staff-auth.ts`

```ts
// Returns { session: { uid, role, branchId, branchName, email } }
const { session } = await requireStaff(event, ['ADMIN', 'MANAGER']);

// Branch-scoped check (rejects if manager tries another branch)
const { session } = await requireStaff(event, ['ADMIN', 'MANAGER'], someBranchId);
```

### `requireMember(event)`
File: `server/utils/member-auth.ts`

```ts
// Returns { uid, member } — validates Firebase token + member doc
const { uid, member } = await requireMember(event);
```

### `requireUser(event)`
Validates Firebase token without role check (either staff or member).

## Client-Side Guards

### Route Middleware (`app/middleware/auth.global.ts`)
- Checks `useAuth().user` on every navigation
- Redirects to `/login` if not authenticated
- `ROLE_ROUTES` maps roles to allowed route prefixes
- Public routes exempt: `/login`, `/anuncia`, `/legal/*`

### Composable (`useAuth()`)
```ts
const { user, role, branchId, hasRole, canManage, isSuperAdmin } = useAuth();

// Check if user can edit a specific branch
if (canManage(targetBranchId)) { ... }

// Check role
if (hasRole('ADMIN')) { ... }
```

## Permission Matrix (Quick Reference)

| Page | RECEPTIONIST | MANAGER | ADMIN |
|---|---|---|---|
| Dashboard `/` | View (no adjust) | View + adjust own | View + adjust all |
| Scanner `/recepcion` | Own branch | Own branch | Any branch |
| Members `/socios` | View + create | View + edit own branch | Edit any |
| Classes `/clases` | View | Edit own branch schedule | Edit all |
| Trainers `/entrenadores` | View | Create (own branch) + manage assigned | Edit all |
| Branches `/sedes` | ❌ | View all, edit own | Edit + create |
| Plans `/membresias` | ❌ | View only | Edit + create |
| Rewards `/recompensas` | View + validate | View + validate | Edit catalog |
| Ads `/publicidad` | ❌ | View (read-only) | Full + approve orders |
| CMS `/cms` | ❌ | View (read-only) | Full CRUD + send |
| Reports `/reportes` | ❌ | Own branch | Any branch |
| Retention `/retencion` | ❌ | Own branch | Any branch |
| Support `/soporte` | Own branch | Own branch | All |

## App Check

- Web: reCAPTCHA Enterprise (requires Blaze plan)
- Mobile: Play Integrity / App Attest
- Header: `X-Firebase-AppCheck`
- Enforcement: `APP_CHECK_ENFORCE=1` (env) makes it mandatory
- Without env: tokens validated if present, absence tolerated
- Checked in `requireStaff`, `requireMember`, `requireUser`, `ads/track`
