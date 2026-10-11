# RIR-HUB B2B — Consola de administración

Nuxt 3 + Vue 3 (`<script setup lang="ts">`) + Nuxt UI + Tailwind + Lucide.
**Firebase activo** — Auth + Firestore + FCM son reales (ya no hay mock);
los endpoints en `server/api/**` escriben con firebase-admin y validan
rol/sede server-side (`server/utils/staff-auth.ts`).

Repo hermano — app del socio (Flutter):
`/Users/luis/Develop/Personal/rirhub-app` (tiene su propio `AGENTS.md`).

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

- **Dashboard realtime**: `useDashboardRealtime` usa listeners de
  Firestore (`onSnapshot`) en vez de polling — `branches` y
  `recentCheckIns` se actualizan instantáneamente cuando hay cambios.
  Los KPIs históricos y la curva de tráfico se cargan una vez al montar
  (`/api/dashboard/static`). El composable viejo `useDashboard` con
  polling cada 5s queda deprecado.
- `branches.current_capacity`: check-in `+1` (`checkin.post` rechaza si
  `>= max_capacity`), checkout `-1`, cierre `= 0`. Ajuste manual por
  `POST /api/branches/{id}/adjust` (`delta` o `value`, transacción con
  clamp + sello `capacity_adjusted_at/by`) — admin todas, gerente su sede,
  recepcionista **no puede**.
- **Auto-checkout**: cron externo (cron-job.org) cada 15 min →
  `POST /api/cron/auto-checkout` libera check-ins >90 min sin salida
  (`release_reason: 'auto_checkout_cron'`). El doc queda en `checkins`
  hasta el cierre de día. El decremento de `current_capacity` va en
  transacción con clamp a 0 (el cierre de día pudo haber reseteado
  antes de que el cron aplicara su decremento).
- **Cierre de día** (`sweepCheckins` + `sweepClassBookings` en
  `server/utils/close-day.ts`): agrega check-ins a `dailyStats` por
  (sede, fecha del check-in), actualiza `forecasts` (EMA por weekday),
  borra los docs, limpia `active_checkin_*` de socios, resetea aforo y
  cupo de clases. Dos entradas: botón "Cerrar sede" del header
  (`POST /api/branches/{id}/close-day`, cualquier rol pero solo su sede
  salvo admin) y cron global `/api/cron/close-day` (vercel.json
  23:55 CDMX — handler sin sufijo: acepta el GET de Vercel cron y el
  POST con `Bearer CRON_SECRET` de cron-job.org/manual).
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

### Soporte / chat socio-staff

- `conversations/{id}` + subcolección `messages` — solo conversaciones
  **activas**: al resolver (`POST /api/support/{id}/resolve`) se borra el
  doc y sus mensajes, no hay historial. Las abandonadas también se borran:
  cada doc lleva `expires_at` (última actividad +24h, renovable por
  mensaje) y el cron `auto-checkout` las barre (`last_message_at` >24h).
  La TTL policy nativa de Firestore no se pudo activar vía API (requiere
  billing en el proyecto); si se activa a mano en la consola (Firestore →
  TTL → collection groups `conversations` y `messages`, campo
  `expires_at`), hace la misma limpieza — ambos mecanismos coexisten sin
  problema.
- El socio escribe desde la app ("Ayuda y soporte"); la conversación se
  crea perezosa en el **primer mensaje** (`POST /api/support/conversations`),
  no al abrir la pantalla.
- `unread_member`/`unread_staff` se incrementan en el POST de mensajes y
  se resetean en `GET .../messages` según quién lee.
- Respuesta de staff → push FCM al topic `member_{memberDocId}` con
  `data.type='support'` (la app abre el chat al tocarla).
- B2B `/soporte`: lista + chat con listeners realtime (filtro `branch_id`
  simple — `status`/orden en memoria, sin índice compuesto). Cualquier
  staff responde; gerente/recepcionista solo su sede. Badge rojo en el
  menú + toast: `useSupportUnread` (singleton, escucha `unread_staff`,
  beep via Web Audio — el browser lo permite tras el primer click).

### Lealtad (objetivos + recompensas)

- `checkin.post` concedido → `recordVisitAndReward`
  (`server/utils/loyalty.ts`, transacción): escribe
  `users/{id}/visits/{yyyy-mm-dd}` (doc id = fecha CDMX → dedupe) y, si
  el socio llegó a su `weekly_goal` esta semana (lunes-domingo CDMX),
  suma `GOAL_BONUS_POINTS` (50) a `users.points` marcando
  `goal_awarded_week` — una vez por semana. Fallo de lealtad NO tumba
  el check-in (try/catch). También mantiene `points_earned`
  (acumulado histórico — `points` solo es saldo) y al premiar manda
  push FCM a `member_{userId}` con `data.type='loyalty'` (la app abre
  Recompensas al tocarla).
- `users.weekly_goal` (default 4) lo edita el socio desde la app —
  whitelisted en rules. `points` y `goal_awarded_*` solo functions.
- `GET /api/rewards/stats` — KPIs vía agregaciones: `points_earned`
  emitidos, saldo vivo `points`, socios con meta cumplida esta semana
  (scope por sede para no-admin). La página los muestra junto al
  desglose de canjes por sede.
- `POST /api/rewards/redeem` `{rewardId}` (socio): transacción —
  valida `rewards.active` + saldo → descuenta `points` y crea
  `users/{id}/redemptions` (`code` `RWR-XXXXXX`, `active`, expira 30d).
- Panel B2B `/recompensas`: catálogo CRUD (solo admin;
  `GET/POST /api/rewards` + `PUT /api/rewards/:id`), KPIs de canje,
  listado de canjes (`GET /api/rewards/redemptions`, scope por sede vía
  `branch_id` embebido en el doc — collectionGroup query) y validación
  del código en recepción (`POST /api/rewards/redemptions {code}` →
  marca `used`, verifica vigencia + sede).

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

### Publicidad self-serve (/anuncia)

- Página pública `/anuncia` (sin login — middleware la exime como
  `/legal`): el negocio sube su creativo, elige espacio y semanas, y
  paga por **Stripe Checkout** (hosted). **Los anuncios ya no se
  segmentan por sede** — todo anuncio lo ven todos los socios;
  `branch_id` queda siempre null. Precio server-side:
  `price_per_week × semanas` desde `/config/ads` (lo edita el admin en
  `/publicidad/venta-directa`).
- **`placement`** (sponsorAds): solo dos valores nuevos — `carousel`
  (premium: carrusel del Home + Promociones + tope del directorio
  Aliados) y `list` (solo directorio, orden aleatorio). Docs viejos con
  `both` o sin el campo se normalizan a `carousel` al leerse. Ranking
  `PLACEMENT_RANK` (list<carousel) en shared/types.
- **Carrusel = 5 espacios** (`CAROUSEL_SLOTS`). Ocupan los ads
  `carousel` más antiguos por `created_at`; si hay más de 5 activos el
  excedente espera en la lista y sube cuando venza alguno. En `/anuncia`
  el comprador ve "X de 5 espacios libres" o, si está lleno, el aviso
  de que aparecerá solo en Aliados hasta liberarse el próximo lugar
  (fecha aprox. que calcula `self-serve.get` con ACTIVE + órdenes
  PENDING_APPROVAL).
- **Directorio Aliados** (app): primero los 5 del carrusel fijados,
  después TODOS los demás en orden aleatorio — sin favoritismo
  (`alliesAdsProvider` en la app; `carouselAdsProvider` alimenta Home
  y Promociones).
- **Pushes — gancho + paquete** (`config/ads.push {enabled, count,
  price}`): TODA compra incluye **1 push gratis** que sale al APROBAR
  la orden (nunca al pagar — pasa por el filtro humano). El paquete
  (`wants_push`) agrega `push_pack` pushes extra que quedan como
  `pushLogs` DRAFT con `scheduled_at` semanal (+7d, +14d…) — los
  despacha **`GET/POST /api/cron/push-dispatch`** (Vercel cron diario
  ~10:00 CDMX en vercel.json, o cron externo con Bearer CRON_SECRET;
  mismo motor `dispatchDuePushLogs` que también reactiva los pushes
  programados manuales del CMS). Todos los logs llevan kind SPONSOR,
  audience ALL → topic `all_members`, target `allies`. La orden guarda
  `push_log_ids[]`/`push_sent_at`/`push_error` para trazabilidad y
  reintento desde /cms. En Stripe el paquete viaja como segundo
  line_item.
- **Anuncios comprados** (`order_id != null`) — integridad del
  inventario pagado: upgrade de placement libre, pero **downgrade /
  pausa / borrado vigente requieren `overrideReason`** y dejan
  evidencia en `/auditLogs` (server-only; `server/utils/audit.ts`).
  **Excepciones**: el anuncio EXPIRADO se borra libre (ya cumplió su
  pauta) y el PENDING no se borra por DELETE — se rechaza desde la
  orden (reembolso). Activar un PENDING por edición manual también
  está bloqueado — solo vía approve (define `ends_at` y cierra el
  ciclo de pago).
- El webhook (`checkout.session.completed`, respaldo en
  `payment_intent.succeeded` por `ad_order_id` en metadata) crea el
  `sponsorAds` con **status PENDING** — la app solo consulta ACTIVE, no
  se cuela — y la orden `/adOrders` pasa a `PENDING_APPROVAL`. Correos
  SMTP: admins de staff + `config/ads.notify` (global siempre; como
  toda orden es de "todas las sedes", todos los `by_branch` reciben
  aviso — dedupe) + confirmación al anunciante.
- **Ubicación**: `/anuncia` muestra un mapa OSM (`LocationPicker.vue` —
  Leaflet, tiles Carto dark). Al salir del campo dirección se
  geocodifica (Nominatim client-side, `countrycodes=mx`) y se propone
  el pin; el anunciante lo confirma o lo arrastra (`manual` marca que
  ya no se re-geocodifica). El pin viaja en la orden y gana sobre el
  geocoding server-side del webhook (`server/utils/geo.ts` — respaldo
  cuando no hubo pin). Si nada resuelve quedan null y el admin los
  fija a mano en el detalle (lat/lng editables).
- El admin revisa en `/publicidad` (cola de solicitudes) o en el
  detalle: **aprobar** pone ACTIVE + `ends_at = hoy + weeks` (la vigencia
  arranca en la aprobación); **rechazar** reembolsa automático por
  Stripe y borra el creativo. Si el reembolso falla no se toca nada.
- `checkout.session.expired` marca la orden EXPIRED. Requiere suscribir
  los eventos `checkout.session.*` en el webhook de Stripe (ver
  .env.example).
- **Fin de campaña**: el cron diario `GET /api/cron/ads-report`
  (`vercel.json` 16:30 UTC ≈ 10:30 CDMX, `CRON_SECRET` o admin) barre
  los `sponsorAds` ACTIVE con `ends_at` vencida → los marca `EXPIRED` y
  envía al anunciante el **reporte de campaña** (impresiones/taps/CTR de
  `adStats` + pushes SENT + CTA "Renovar" a `/anuncia`). Sella
  `adOrders.report_sent_at`; reenvío manual `POST /api/ads/orders/{id}/report`
  (admin — el detalle del anuncio muestra el estado + botón).

### Seguridad anti-abuso

- **`server/utils/rate-limit.ts`** — async; doble nivel: memoria por
  instancia (siempre) + Upstash Redis si `UPSTASH_REDIS_REST_URL`/`TOKEN`
  están (ventana fija `SET NX PX`+`INCR` — conteo real entre lambdas;
  fail-open al límite local si Redis cae). Ventana deslizante local por
  uid/endpoint. Aplicado a `members/claim`
  (10/10min), `ads/track` (30/min), `support` conv+msg (5 y 20/min),
  `rewards/redeem` (10/min), `classes/*/book` (20/min),
  `payments/intent` (10/min).
- **Lockout del claim PIN** — `users.claim_attempts`/`claim_locked_until`:
  **3 fallos → 15 min bloqueado**; se resetean al reclamar bien.
- **Dedupe de ads** — `/adEvents/{adId}_{uid}_{fecha}_{evento}` con
  `create()`: 1 impresión/tap por socio por anuncio por día. Además
  `/adStats/{adId}_{fecha}` acumula la serie diaria (solo eventos que
  pasaron el dedupe) — la lee `GET /api/ads/{id}/stats` (admin/gerente)
  para la gráfica de 30d en `/publicidad/[id]`.
- **App Check** — preparado en ambos clientes: app móvil con Play
  Integrity / App Attest (iOS ya registrada), B2B web con reCAPTCHA
  Enterprise ("Fraud Defense") en `useFirebase` — **requiere plan
  Blaze**; en Spark el registro en consola falla y Google ya no acepta
  reCAPTCHA Classic. Mientras `NUXT_PUBLIC_RECAPTCHA_SITE_KEY` esté
  vacía App Check web no se inicializa (seguro: tokens inválidos darían
  401). Tras migrar a Blaze: registrar la web app con Fraud Defense →
  site key a la env → verificar que `X-Firebase-AppCheck` viaja en los
  requests → `APP_CHECK_ENFORCE=1` + enforcement en Firestore/Auth. El `$api` web y el `ApiClient` de
  Flutter mandan `X-Firebase-AppCheck`; `verifyAppCheck` corre en los
  tres gates (`requireStaff`/`requireMember`/`requireUser`) +
  `ads/track`: token inválido → 401 siempre; token ausente → tolerado
  hasta que `APP_CHECK_ENFORCE=1` (env) lo haga obligatorio. Falta en
  Console: registrar la app web con reCAPTCHA Enterprise (genera el
  site key), los providers móviles, y prender enforcement por producto
  (Firestore/Auth) + la env cuando todos los clientes manden token.

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
| Recompensas (`/recompensas`) | ver + validar códigos de su sede | ver + validar códigos de su sede | editar catálogo + validar |
| Publicidad (`/publicidad`) | sin acceso | ver (anuncios en solo lectura; las órdenes son globales → aprobar/rechazar es admin-only) | editar + crear + pausar + eliminar + aprobar órdenes |
| CMS (`/cms`) | sin acceso | ver (detalle solo lectura) | editar + crear + enviar + eliminar |
| Reportes (`/reportes`) | sin acceso | todos los tipos, siempre filtrado a su sede | todos, cualquier sede |

La matriz se enforcea **server-side**, no solo en la UI: `RECEPTIONIST`
recibe 403 en cualquier mutación de trainers (`trainers.post`,
`trainers/{id}/update|duty`), `classes/{id}.put`, en las lecturas de
publicidad/CMS (`ads/orders.get`, `ads/config.get`, `ads/{id}/stats.get`,
`cms/**`) y solo cobra a socios de su sede (`payments.post` valida
`requireBranchScope` contra `member.branch_id`).

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
- **Cron `close-day` en Vercel**: `server/api/cron/close-day.ts` acepta
  GET (Vercel Cron, 23:55 CDMX en `vercel.json`) y POST (manual con
  Bearer). Requiere `CRON_SECRET` en Vercel. `auto-checkout` corre en
  cron-job.org cada 15 min.
- **`bookings` archivadas**: el close-day mueve las de `class_date <
  hoy` a `/bookings_archive` (lectura solo staff — índice
  `branch_id + class_date` deployado). La colección viva queda acotada.
- `html5-qrcode` está en `package.json` sin uso (recepción usa lector USB).
- **Rate limit in-memory en serverless**: `rate-limit.ts` cuenta por
  instancia — en Vercel cada lambda tiene su propia ventana y un bot
  distribuido la diluye. Suficiente contra abuso casual; si hay abuso
  real migrar a Upstash Redis (`@upstash/redis`, free tier 10k
  comandos/día) — INCR+EXPIRE reemplaza el `Map`, la firma de
  `rateLimit()` no cambia. Alternativa: Vercel WAF (Pro) o Cloudflare
  delante del dominio.
- **Wellhub/TotalPass reales**: `validatePartnerToken` es mock — falta
  el convenio del gym (Partner Portal) para obtener API keys, base URL
  y saber qué artefacto valida cada agregador (QR, token, lookup por
  ID). Pendiente también reporte de visitas×tarifa (liquidación
  estimada) una vez conocidas las tarifas negociadas por tier.
- Moneda/locale: México — `es-MX`, `$` (MXN), sedes seed en Toluca/Metepec.
