# Prototipo Gym B2B — Consola de administración

Nuxt 3 + Vue 3 (`<script setup lang="ts">`) + Nuxt UI + Tailwind + Lucide.
Mock backend en `server/` (sin persistencia real). Firebase planeado.

## Comandos

```bash
npm run dev        # dev server (http://localhost:3000)
npm run typecheck  # vue-tsc — debe quedar en 0 errores
```

Si `npm` no está en PATH: `export PATH="/Users/luis/.nvm/versions/node/v24.13.0/bin:$PATH"`

## Matriz de permisos por perfil

Roles: `ADMIN` (admin global), `MANAGER` (gerente de sede), `RECEPTIONIST` (recepcionista).
Definidos en `app/composables/useAuth.ts` (`StaffRole`, `ROLE_ROUTES`, `ROLE_HOME`).

**Regla central**: gerente y admin tienen **los mismos permisos de vista**; la
diferencia es solo el **alcance de edición** — el gerente edita únicamente lo de
su propia sede (`session.branchId`), el admin cualquier sede.

| Sección | Recepcionista | Gerente | Admin global |
|---|---|---|---|
| Dashboard (`/`) | ver | ver | ver |
| Recepción (`/recepcion`) | su sede (selector bloqueado) | su sede (selector bloqueado) | cualquier sede |
| Socios (`/socios`) | ver + crear (sin editar existentes) | ver todo; editar/crear solo su sede | editar/crear cualquier sede |
| Clases (`/clases`) | ver | ver todo; editar solo horario/sala **de su sede** | editar todo (campos globales) |
| Entrenadores (`/entrenadores`) | ver | ver todo; crear auto-asignado a su sede; gestionar turno de coaches asignados | editar todo + asignar sedes |
| Sedes (`/sedes`) | sin acceso | ver todas; editar solo la suya | editar todas + crear |
| Membresías (`/membresias`) | sin acceso | ver catálogo — **NO puede editar ni crear** | editar + crear |
| Publicidad (`/publicidad`) | sin acceso | ver (detalle solo lectura) | editar + crear + pausar + eliminar |
| CMS (`/cms`) | sin acceso | ver (detalle solo lectura) | editar + crear + enviar + eliminar |
| Reportes (`/reportes`) | sin acceso | todos los tipos, siempre filtrado a su sede | todos, cualquier sede |

### Reglas de negocio clave

- **Entidad compartida** (clase o coach asignado a varias sedes): el gerente solo
  edita sus campos locales (horario, sala, turno); los globales (nombre, coach,
  capacidad) son admin-only.
- **Entidad propia** (socio de su sede, su sede): edición completa para el gerente.
- **Entidad global** (membresías/precios, cupones, notificaciones push, anuncios):
  solo admin edita; el gerente ve en solo lectura.
- **Membresías**: el gerente **no puede editar ni crear planes bajo ningún caso** —
  es exclusivo del admin global. La creación vive en `/membresias/nuevo`
  (`POST /api/plans`), página admin-only que redirige a cualquier otro rol.
- **La membresía ES el plan** — no existe un "nivel" separado. Los beneficios y
  el alcance del socio los define su `MembershipPlan` (precio, features,
  `allBranches`, `highlight`). La segmentación de cupones es por plan:
  `Coupon.planIds` contiene `'ALL'` o ids de planes específicos.
- **Referencias por ID, nombres solo para display.** Las relaciones guardan el
  `MembershipPlan.id` canónico — nunca el nombre (un rename no debe romper
  referencias):
  - `Member.membershipPlanId` → `MemberAdmin.membershipType` es el nombre
    resuelto (solo lectura/display).
  - `PaymentRecord.planId` (canónico) + `plan` (etiqueta histórica al cobrar).
  - `Coupon.planIds` — `'ALL'` o ids de planes.
  - `CheckInRecord.membershipType` es snapshot del nombre al momento del scan.
  - `ClassSchedule.coachId` (canónico, `Trainer.id`) + `coach` (etiqueta
    denormalizada para display; ''/`'Sin asignar'` si no hay coach).
  - Reportes: `byPlan` agrega por `planId` y expone `plan` (nombre) para display.
  - En Firestore: `users/{id}.membership_plan_id`, `payments.plan_id`,
    `promotions.plan_ids`, `classes.coach_id`; resolver nombres desde las
    colecciones `plans` y `trainers`.
- Creación de coach por gerente → queda auto-asignado a su sede; el admin elige sede.
- Notificaciones: el admin edita/elimina cualquier estado; "Enviar/Reenviar" solo
  desde la tabla `/cms`.

### Helpers de permisos (`useAuth`)

- `canEditBranch(branchId)` — admin siempre; gerente solo su sede.
- `canEditInBranches(branchIds)` — edición completa: gerente solo si la entidad
  pertenece **exclusivamente** a su sede.
- `isAtMyBranch(branchIds)` — acciones locales: la entidad incluye su sede aunque
  sea compartida.
- `canAccess(role, path)` / `ROLE_ROUTES` — gating de navegación
  (middleware `auth.global.ts` + nav en `layouts/default.vue`).

## Deuda conocida para la migración a Firebase

- **Todo el enforcement es cliente.** El server mock (`server/api/**`) no valida
  rol ni sede. En Firebase replicar la matriz en: custom claims (`role`,
  `branchId`), Firestore security rules y endpoints.
- `useAuth.login` es demo (rol elegido en `/login`); con Firebase el rol/sede
  vendrán de custom claims o doc `staff`.
- `html5-qrcode` está en `package.json` sin uso (recepción usa lector USB).
- Moneda/locale: México — `es-MX`, `$` (MXN), sedes seed en Toluca/Metepec.
