# Prototipo Gym B2B — Consola de administración

Nuxt 3 + Vue 3 (`<script setup lang="ts">`) + Nuxt UI + Tailwind + Lucide.
**Firebase activo** — Auth + Firestore + FCM son reales (ya no hay mock);
los endpoints en `server/api/**` escriben con firebase-admin y validan
rol/sede server-side (`server/utils/staff-auth.ts`).

Repo hermano — app del socio (Flutter):
`/Users/luis/Develop/Personal/prototipo-gym` (tiene su propio `AGENTS.md`).

**Modelo de negocio**: un proyecto Firebase = un negocio con varias sedes.
No existe `brand_id` operativo; el branding vive en `/config/brand`.
Timezone del negocio: `America/Mexico_City` — todas las fechas de
ocurrencia (`class_date`, dailyStats) se calculan en esa TZ.

## Comandos

```bash
npm run dev        # dev server (http://localhost:3000)
npm run typecheck  # vue-tsc — debe quedar en 0 errores
```

Si `npm` no está en PATH: `export PATH="/Users/luis/.nvm/versions/node/v24.13.0/bin:$PATH"`

Nota: `npm run typecheck` a veces crashea con `ERR_PACKAGE_PATH_NOT_EXPORTED`
(bug conocido de Volar/vue-tsc) — revisar que no haya errores TS reales en
la salida; el crash de la herramienta no es un error del código.

## Flujos operativos clave

Detalle de colecciones y campos en `FIRESTORE.md`; reglas en
`firestore.rules`.

### Alta de socios (claim)

Recepción crea al socio (`/socios` → `members.post`) con `member_number`
+ `contact_email` obligatorio; el backend genera un `claim_pin` de 6 díg
y lo envía por correo (`server/utils/mail.ts`, SMTP por env — sin SMTP
se loguea en consola y se muestra en el detalle del socio). La app
**nunca crea** el registro: el usuario entra con Google/Apple y reclama
su ficha vía `POST /api/members/claim` (número + PIN, single-use — se
borra al reclamar). `POST /api/members/{id}/claim-pin` regenera/reenvía
(staff, scope de sede). `contact_email` ≠ `email` (login Google/Apple).
Sin vínculo no ve datos del gym.

### Check-ins y aforo en tiempo real

- `branches.current_capacity`: check-in `+1` (`checkin.post` rechaza si
  `>= max_capacity`), checkout `-1`, cierre `= 0`. Ajuste manual por
  `POST /api/branches/{id}/adjust` (`delta` o `value`, transacción con
  clamp + sello `capacity_adjusted_at/by`) — admin todas, gerente su sede,
  recepcionista **no puede**.
- **Auto-checkout**: cron externo (cron-job.org) cada 15 min →
  `POST /api/cron/auto-checkout` libera check-ins >90 min sin salida
  (`release_reason: 'auto_checkout_cron'`). El doc queda en `checkins`
  hasta el cierre de día.
- **Cierre de día** (`sweepCheckins` + `sweepClassBookings` en
  `server/utils/close-day.ts`): agrega check-ins a `dailyStats` por
  (sede, fecha del check-in), actualiza `forecasts` (EMA por weekday),
  borra los docs, limpia `active_checkin_*` de socios, resetea aforo y
  cupo de clases. Dos entradas: botón "Cerrar sede" del header
  (`POST /api/branches/{id}/close-day`, cualquier rol pero solo su sede
  salvo admin) y cron global `POST /api/cron/close-day` (vercel.json
  23:55 CDMX — requiere `CRON_SECRET` en Vercel; hoy NO corre en
  producción, el cierre real es el botón o cron-job.org).
- **Validación de alcance de sede**: `checkin.post` y
  `classes/{id}/book` rechazan si el plan del socio no tiene
  `all_branches` y la sede no es su `branch_id`
  (`PLAN_BRANCH_RESTRICTED` — registrado como denegado).
- **Agregadores (Wellhub/TotalPass)** — esqueleto con mock:
  `ScannerPanel` tiene modo por proveedor →
  `POST /api/partners/checkin` (`{provider, token}`) →
  `validatePartnerToken` en `server/utils/partners.ts` (**mock hoy** —
  token ≥6 chars pasa como "Visitante demo"; las credenciales reales
  del convenio se enchufan ahí por env, sin tocar UI). El check-in se
  escribe en `checkins` con `provider` + `external_id`,
  `user_id: null`, `method: 'partner'` — mismo aforo/TTL/cierre de día
  que socios. Dedupe: un `external_id` solo rinde una entrada por día.
  CheckInsList/ScanResultPanel muestran el visitante sin link a socio
  y sin botón de pago. Índice compuesto
  `provider+external_id+check_in_at` ya deployado.

### Reservas de clase — por ocurrencia

- `bookings/{id}`: `class_id` + `class_date` (YYYY-MM-DD CDMX) +
  `auth_uid` + `branch_id` (sede donde se toma) + `status`
  (`confirmed`/`cancelled`). El socio lee solo las suyas; escribe solo el
  backend.
- `POST /api/classes/{id}/book` `{date?, branchId?}`: valida membresía
  `ACTIVE`, fecha en `[hoy, hoy+8]`, vigencia (si hoy, no haber pasado
  `end_minutes` — respeta `branch_times` de la sede), cupo **en
  transacción** sobre `classes.booked_by_date[date]`; idempotente por
  (clase+socio+fecha). `DELETE .../book?date=` cancela esa ocurrencia.
- `classes.booked` = espejo de "inscritos hoy" total (compat);
  `booked_by_date` = `{fecha: {branchId: n}}` es la fuente real — cupo
  **por sede**. Valores planos legacy se migran a la sede de la reserva
  (o a `'_'` al leer). Reservas viejas sin `class_date` cuentan por su
  `created_at`. El close-day resetea `booked` y poda llaves `<= hoy`;
  las fechas futuras se conservan.
- `GET /api/classes/{id}/roster` — reservas confirmadas de hoy; staff con
  sede ve solo las de su sede.

### Avatares (sin fotos subidas)

- **Coach**: `trainers.avatar` = id de `COACH_AVATAR_IDS`
  (`shared/coach-avatars.ts`) — se elige con picker al crear en
  `/entrenadores/nuevo` y lo edita solo ADMIN en `[id]` (campo global,
  fuera de MANAGER_KEYS). Los SVG viven en `public/avatars/coaches/` —
  regenerar arte con `node scripts/generate-coach-avatars.mjs` (emite a
  public/ y al bundle de la app). `photo_url` quedó legacy.
- **Socio**: `users.avatar` = id de `memberAvatarCatalog` (app) — el
  socio lo elige en su perfil; self-write permitido vía whitelist en
  firestore.rules. En el B2B se renderiza con `MemberAvatar.vue`
  (espejo del catálogo en `shared/member-avatars.ts` — icono lucide +
  gradiente) en `/socios`, detalle y ScanResultPanel; mantener ids
  alineados con la app.

### Push / CMS

- `pushLogs`: `status` draft/sent/failed + `target` (`auto|home|explore|
  allies|promos|profile`) que la app mapea a tab; `auto` cae al mapping
  por `kind` (SPONSOR→Aliados, BRAND→Descuentos).
- Flujo manual: crear borrador → "Enviar ahora". El scheduler
  (`cms/push/dispatch` + `scheduledAt`) está **apagado por flag**
  `PUSH_SCHEDULER !== '1'` — código intacto, se reactiva con env.
- Audiencias por topic FCM: `all_members`, `branch_{id}`,
  `expired_members`. `log.sent` = 1 por envío exitoso al topic (FCM no
  expone suscriptores); el KPI "Tasa de entrega" es SENT/(SENT+FAILED).

## Matriz de permisos por perfil

## Matriz de permisos por perfil

Roles: `ADMIN` (admin global), `MANAGER` (gerente de sede), `RECEPTIONIST` (recepcionista).
Definidos en `app/composables/useAuth.ts` (`StaffRole`, `ROLE_ROUTES`, `ROLE_HOME`).

**Regla central**: gerente y admin tienen **los mismos permisos de vista**; la
diferencia es solo el **alcance de edición** — el gerente edita únicamente lo de
su propia sede (`session.branchId`), el admin cualquier sede.

| Sección | Recepcionista | Gerente | Admin global |
|---|---|---|---|
| Dashboard (`/`) | ver todas las sedes (sin editar aforo) | ver todas; ajustar aforo solo su sede | ver + ajustar todas |
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

### Pagos con Stripe

- `POST /api/payments/intent` `{planId}`: crea/reusa `stripe_customer_id`
  del socio y devuelve `clientSecret` para el Payment Sheet de la app.
- `POST /api/webhooks/stripe` (firma `STRIPE_WEBHOOK_SECRET`,
  idempotente vía `/webhookEvents/{eventId}`): `payment_intent.succeeded`
  escribe `/payments` (APPROVED) y activa la membresía
  (`membership_status=ACTIVE`, `membership_until` +30d desde
  max(hoy, vencimiento)); `payment_failed` → DECLINED;
  `charge.refunded` → REFUNDED.
- Montos: `plans.price` en pesos MXN → Stripe en centavos (×100).
- Env requeridas en `.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `CRON_SECRET`. Dev: `stripe listen --forward-to
  localhost:3000/api/webhooks/stripe` (requiere Stripe CLI).

## Deuda conocida / pendientes

- **Stripe keys**: el flujo está programado de punta a punta; falta
  poblar `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` (.env B2B) y
  `stripePublishableKey` (app_config.dart) con llaves reales.
- **Cron `close-day` en Vercel**: configurado en `vercel.json` pero no corre
  sin deploy a producción + env `CRON_SECRET`. Hoy el cierre es manual
  (botón header) o vía cron-job.org. `auto-checkout` sí corre en
  cron-job.org cada 15 min.
- **`bookings` sin TTL**: crecen como historial; si el volumen molesta,
  archivar en el close-day.
- `html5-qrcode` está en `package.json` sin uso (recepción usa lector USB).
- **Wellhub/TotalPass reales**: `validatePartnerToken` es mock — falta
  el convenio del gym (Partner Portal) para obtener API keys, base URL
  y saber qué artefacto valida cada agregador (QR, token, lookup por
  ID). Pendiente también reporte de visitas×tarifa (liquidación
  estimada) una vez conocidas las tarifas negociadas por tier.
- Moneda/locale: México — `es-MX`, `$` (MXN), sedes seed en Toluca/Metepec.
