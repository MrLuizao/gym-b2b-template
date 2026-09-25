# Esquema de datos — Firestore

Fuente de verdad del modelo de datos para el sistema de gimnasio.
**Un negocio (marca) con N sucursales.** La marca no es una dimensión de los
datos: es configuración del despliegue (`/config/brand`). Un segundo negocio =
otro proyecto Firebase, no otro tenant.

---

## Convenciones

- **IDs canónicos**: toda referencia entre documentos guarda el `id` del
  documento destino (`plan_id`, `coach_id`, `branch_id`, `member_id`…).
  Nunca se referencia por nombre — renombrar no rompe nada.
- **Snapshots / etiquetas denormalizadas**: los nombres se duplican solo para
  display o historia (`member_name`, `plan`, `coach`, `membership_type`).
  Nunca son la relación; no requieren consistencia estricta.
- **`branch_id: null`** en contenido = aplica a todas las sedes.
- **`plan_ids: ['ALL']`** en cupones = todos los planes.
- Timestamps en `snake_case` (`created_at`, `check_in_at`) — convención
  Firestore, igual que los modelos Flutter.
- **Campos monetarios** en pesos MXN (`price`, `amount`), `currency: 'mxn'`.
  La conversión a centavos (×100) se hace solo al llamar a Stripe.
- Escrituras sensibles (pagos, check-ins, vigencias, contadores) las hacen
  **solo Cloud Functions** — los clientes nunca las escriben directo.

## Mapa de colecciones

```
/config/brand                    configuración white-label (1 doc)

/branches/{branchId}             sedes
/plans/{planId}                  planes de membresía (catálogo + Stripe)
/trainers/{trainerId}            entrenadores
/classes/{classId}               clases (definición + overrides por sede)

/users/{userId}                  socios
/users/{userId}/coupons/{id}     cupones generados del socio
/staff/{uid}                     personal (rol + sede)

/checkins/{checkinId}            entradas del día (TTL — se borran solas)
/bookings/{bookingId}            reservas de clase por ocurrencia (class_date)
/dailyStats/{statId}             agregado diario por sede (historia de reportes)
/forecasts/{branchId}            aforo típico por hora/día de semana (app)
/payments/{paymentId}            pagos (solo functions escribe)
/webhookEvents/{eventId}         idempotencia de webhooks Stripe

/promotions/{promotionId}        banners + cupones CMS
/sponsorAds/{adId}               anuncios de aliados + métricas
/pushLogs/{logId}                notificaciones push enviadas
/store/products/{productId}      tienda de la app
```

---

## Colecciones

### `/config/brand` — configuración del negocio

Un solo documento. Lo leen la app y el B2B al arrancar para tematizarse.

| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | Nombre comercial |
| `logo_url` | string | |
| `colors` | map | `{ primary, accent, background }` |
| `timezone` | string | `America/Mexico_City` |
| `currency` | string | `MXN` |
| `socials` | map | `{ instagram, facebook, … }` |

Escritura: solo ADMIN.

---

### `/branches/{branchId}` — sedes

| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | |
| `image_url` | string | |
| `address` | string | |
| `max_capacity` | number | Aforo máximo |
| `current_capacity` | number | **Contador** — solo server (API/functions) |
| `capacity_adjusted_at` | timestamp | Sello del último ajuste manual de aforo |
| `capacity_adjusted_by` | string | Email/uid del staff que ajustó |
| `status` | string | `OPEN` \| `CLOSED` |
| `open_minutes` | number | Minutos desde 00:00 |
| `close_minutes` | number | |
| `lat` / `lng` | number | Para mapa de la app |

Lectura: todos los autenticados. Escritura: ADMIN (cualquier sede),
MANAGER (solo la suya, sin tocar `max_capacity`/`current_capacity`).
`current_capacity` solo se escribe vía API: check-in/out, auto-checkout,
cierre de día y `POST /api/branches/{id}/adjust` (delta o valor absoluto,
clamp `[0, max]`, deja sello `capacity_adjusted_*`).

---

### `/plans/{planId}` — planes de membresía

El plan **es** la membresía: nombre, precio, beneficios y alcance.

| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | Display — no es referencia |
| `price` | number | Centavos / mes |
| `features` | string[] | Beneficios |
| `highlight` | bool | Badge PREMIUM |
| `all_branches` | bool | Acceso multi-sede |
| `stripe_product_id` | string | Catálogo Stripe |
| `stripe_price_id` | string | Price 1:1 con este plan |
| `active` | bool | Soft-delete: no se borran planes con socios |

Lectura: todos. Escritura: solo ADMIN (gerente ni crea ni edita).

---

### `/users/{userId}` — socios

El `userId` es el UID de Firebase Auth del socio — o un doc id aleatorio
para socios creados en recepción aún no reclamados (su `auth_uid` se
escribe al reclamar con `POST /api/members/claim`, número + `claim_pin`
que llegó por correo).

| Campo | Tipo | Quién escribe | Notas |
|---|---|---|---|
| `branch_id` | string | staff | Sede de registro → `branches/{id}` |
| `name` | string | socio/staff | Display |
| `photo_url` | string | socio/staff | Legacy — la app usa `avatar` |
| `avatar` | string | socio | Id de `memberAvatarCatalog` (app) — avatar prediseñado |
| `member_number` | string | functions | `CF-XXXXX` — lector USB |
| `qr_code` | string | functions | Contenido del QR firmado |
| `membership_status` | string | functions | `ACTIVE` \| `EXPIRED` |
| `membership_plan_id` | string | functions | **Canónico** → `plans/{id}` |
| `membership_until` | timestamp | functions | Vigencia — solo cambia por pago |
| `first_name` | string | socio/staff | |
| `middle_name` | string | socio/staff | |
| `paternal_last_name` | string | socio/staff | |
| `maternal_last_name` | string | socio/staff | |
| `sex` | string | socio/staff | |
| `birth_date` | timestamp | socio/staff | |
| `phone` | string | socio/staff | |
| `contact_email` | string | functions | Correo capturado en recepción — recibe el PIN; **independiente** del `email` de login |
| `email` | string | functions | Email de la cuenta de login (Google/Apple) — se escribe al reclamar |
| `claim_pin` | string | functions | PIN de activación de 6 díg — **se borra al reclamar** (single-use) |
| `id_number` | string | staff | Identificación |
| `stripe_customer_id` | string | functions | Customer de Stripe (lazy) |
| `last_checkin_at` | timestamp | functions | Última entrada — la app la muestra |
| `active_checkin_id` | string \| null | functions | Check-in abierto — evita doble entrada |
| `active_checkin_branch` | string \| null | functions | Sede del check-in abierto |
| `created_at` | timestamp | functions | |

Lectura: el socio (su doc), staff según sede. Escritura de perfil: el socio
(campos whitelist) o staff según rol. Campos de membresía: solo functions.

#### `/users/{userId}/coupons/{couponId}`

Cupones que el socio genera desde un anuncio de aliado.

| Campo | Tipo | Notas |
|---|---|---|
| `ad_id` | string | → `sponsorAds/{id}` origen |
| `code` | string | Código canjeable |
| `plan_ids` | string[] | Restricción de planes heredada |
| `expires_at` | timestamp | |

---

### `/staff/{uid}` — personal

El `uid` es el UID de Firebase Auth. La existencia del doc define que es staff.

| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | |
| `role` | string | `ADMIN` \| `MANAGER` \| `RECEPTIONIST` |
| `branch_id` | string \| null | `null` solo para ADMIN global |
| `active` | bool | |

Escritura: solo ADMIN. Las security rules leen este doc para decidir permisos.

---

### `/trainers/{trainerId}` — entrenadores

| Campo | Tipo | Notas |
|---|---|---|
| `branch_ids` | string[] | Sedes donde trabaja → `branches/{id}` |
| `name` | string | |
| `specialty` | string | |
| `photo_url` | string | Legacy — la app usa `avatar` |
| `avatar` | string | Id del catálogo `COACH_AVATAR_IDS` → `public/avatars/coaches/{id}.svg` |
| `shift` | string | `MAÑANA` \| `TARDE` \| `NOCHE` — campo local |
| `is_on_duty` | bool | Campo local |
| `active` | bool | |

Lectura: todos. Escritura: ADMIN todo; MANAGER crea en su sede y solo edita
`shift`/`is_on_duty`/`branch_ids` de coaches asignados a su sede.

---

### `/classes/{classId}` — clases

Definición global + overrides por sede en `branch_times`.

| Campo | Tipo | Quién edita | Notas |
|---|---|---|---|
| `name` | string | ADMIN | |
| `branch_ids` | string[] | ADMIN | Sedes donde se imparte |
| `coach_id` | string | ADMIN | **Canónico** → `trainers/{id}` |
| `coach` | string | ADMIN | Etiqueta denormalizada (display) |
| `room` | string | ADMIN | Sala base |
| `start_minutes` / `end_minutes` | number | ADMIN | Horario base |
| `capacity` | number | ADMIN | |
| `booked` | number | functions | Inscritos de HOY total — suma de sedes (compat) |
| `booked_by_date` | map | functions | Cupo por ocurrencia **y sede**: `{ 'YYYY-MM-DD': { <branchId>: n } }`. Se poda al reservar y en close-day |
| `branch_times` | map | MANAGER (su clave) | `{ <branchId>: { start_minutes, end_minutes, room } }` |

La reserva es por **ocurrencia** (fecha CDMX), no por clase en abstracto:
`POST /api/classes/{id}/book` recibe `{ date, branchId }`, valida vigencia
(no pasada, ≤8 días, si es hoy la clase no debe haber terminado según
`branch_times` de esa sede) y cupo **en transacción por sede** — dos
reservas simultáneas no rebasan `capacity` de esa sede. `DELETE` toma
`?date=` y decrementa la llave de la sede registrada en la reserva.

### `/bookings/{bookingId}` — reservas de clase

Escritura solo vía API (functions); el socio lee las suyas
(`auth_uid == uid`). Historial persistente — el roster del día filtra
`class_date == hoy`.

| Campo | Tipo | Notas |
|---|---|---|
| `class_id` | string | → `classes/{id}` |
| `class_date` | string | `YYYY-MM-DD` CDMX — la ocurrencia reservada |
| `user_id` / `auth_uid` | string | Socio (doc id + auth uid) |
| `member_name` | string | Snapshot para roster |
| `branch_id` | string | Sede donde se toma la clase |
| `status` | string | `confirmed` / `cancelled` |
| `created_at` / `cancelled_at` | timestamp | |

El gerente solo puede escribir su propia clave dentro de `branch_times` —
nada de campos globales ni otras sedes (se fuerza en reglas).

---

### `/checkins/{checkinId}` — entradas del día (efímeras)

**Los check-ins son del día y desaparecen.** Dos mecanismos:

- `expires_at` → **Firestore TTL policy** borra el doc automáticamente al
  expirar (fin del día + margen). Es la red de seguridad.
- Function programada **`closeDay`** (al cierre de cada sede): agrega el día
  en `/dailyStats`, resetea `current_capacity` a 0 y barre los check-ins
  que hayan quedado. La historia vive en `dailyStats`, no aquí.

| Campo | Tipo | Notas |
|---|---|---|
| `user_id` | string | → `users/{id}` |
| `branch_id` | string | → `branches/{id}` |
| `member_name` | string | Snapshot display |
| `membership_type` | string | Snapshot del nombre del plan al entrar |
| `membership_plan_id` | string | **Canónico** — analítica por plan |
| `method` | string | `qr` \| `usb` \| `manual` |
| `granted` | bool | |
| `reason` | string | Motivo de rechazo (si aplica) |
| `check_in_at` | timestamp | Server timestamp |
| `checked_out` | bool | |
| `checked_out_at` | timestamp \| null | |
| `membership_alert` | string | `GREEN` \| `YELLOW` \| `RED` |
| `expires_at` | timestamp | **TTL** — cierre de sede + margen |

Queries: `branch_id + check_in_at` (lista del día en recepción).
No hay historial por socio aquí — el socio ve su `last_checkin_at`.

### `/dailyStats/{statId}` — agregado diario por sede

`statId = "{branchId}_{yyyy-mm-dd}"` — un doc por sede por día.
Lo escribe `closeDay`; **es la fuente de reportes históricos**.

| Campo | Tipo | Notas |
|---|---|---|
| `branch_id` | string | → `branches/{id}` |
| `date` | string | `yyyy-mm-dd` |
| `total` / `granted` / `denied` | number | |
| `by_method` | map | `{ qr: n, usb: n, manual: n }` |
| `by_plan` | map | `{ <planId>: n }` — reporte por membresía |
| `by_hour` | number[] | 24 entradas — gráfica de tráfico |
| `peak_capacity` | number | Pico de aforo del día |
| `unique_members` | number | Socios distintos |

Escritura: solo functions. Lectura: staff según sede.

### `/forecasts/{branchId}` — pronóstico de aforo (app)

Un doc por sede. Lo actualiza `closeDay` cada noche con el `by_hour` del
día que cerró, usando promedio exponencial por día de semana:

```
by_weekday[weekday][h] = 0.8 * anterior + 0.2 * hoy
```

| Campo | Tipo | Notas |
|---|---|---|
| `by_weekday` | map | `{ 1: [24], …, 7: [24] }` lunes–domingo, valor por hora |
| `sample_days` | number | Días que alimentan el promedio |
| `updated_at` | timestamp | |

La app lee **1 doc** para dibujar "aforo típico por hora" — la consulta
más barata posible. Separado por día de semana porque lunes ≠ sábado.
Sin datos aún → la app muestra "sin pronóstico" hasta `sample_days > 0`.

Escritura: solo functions. Lectura: todos los autenticados.

---

### `/payments/{paymentId}` — pagos

**Append-only: solo Cloud Functions escribe.** Dos orígenes:

- `provider: 'stripe'` → webhook `payment_intent.succeeded` (app del socio).
- `provider: 'manual'` → callable `registerManualPayment` (recepción B2B).

| Campo | Tipo | Notas |
|---|---|---|
| `member_id` | string | → `users/{id}` **canónico** |
| `member_name` / `member_number` | string | Snapshots para reportes |
| `branch_id` | string | → `branches/{id}` |
| `plan_id` | string | → `plans/{id}` **canónico** |
| `plan` | string | Etiqueta histórica del cobro |
| `amount` | number | Centavos |
| `currency` | string | `mxn` |
| `provider` | string | `stripe` \| `manual` |
| `method` | string | `card` \| `cash` \| `transfer` \| `terminal` |
| `transaction_id` | string | Folio manual (stripe usa payment_intent_id) |
| `stripe_payment_intent_id` | string \| null | |
| `stripe_charge_id` | string \| null | |
| `receipt_url` | string \| null | |
| `status` | string | `APPROVED` \| `DECLINED` \| `PENDING` \| `REQUIRES_ACTION` \| `REFUNDED` |
| `failure_reason` | string \| null | |
| `created_at` | timestamp | Server timestamp |
| `created_by` | string | `member_app` \| `reception` |

Queries: `branch_id + created_at` (reportes), `member_id + created_at`
(historial del socio), `plan_id` (recaudado por plan).

**Cobro manual** (recepción): efectivo/transferencia/terminal física del gym.
La callable valida plan + socio y extiende `membership_until` +30 días.

**Cobro Stripe** (app): `createPaymentIntent` → SDK confirma → webhook crea
el doc y extiende `membership_until`. Sin suscripciones en fase 1.

---

### `/webhookEvents/{eventId}` — idempotencia Stripe

| Campo | Tipo |
|---|---|
| `type` | string (`payment_intent.succeeded`, …) |
| `processed_at` | timestamp |

Stripe reintenta webhooks: si el `eventId` ya existe, se ignora.
Solo functions accede — reglas niegan todo a clientes.

---

### `/promotions/{promotionId}` — banners + cupones CMS

| Campo | Tipo | Notas |
|---|---|---|
| `type` | string | `banner` \| `coupon` |
| `branch_id` | string \| null | `null` = todas las sedes |
| `title` / `subtitle` / `description` | string | |
| `badge` | string | |
| `image_url` | string | Banner |
| `code` | string | Cupón |
| `plan_ids` | string[] | Cupón: `['ALL']` o ids de `plans` |
| `created_at` / `expires_at` | timestamp | |

Escritura: solo ADMIN.

---

### `/sponsorAds/{adId}` — anuncios de aliados

| Campo | Tipo | Notas |
|---|---|---|
| `advertiser` | string | |
| `title` / `subtitle` / `badge` | string | |
| `brand_color` | string | Hex |
| `image_url` | string | |
| `cta_label` | string | |
| `branch_id` | string \| null | `null` = global |
| `status` | string | `ACTIVE` \| `PAUSED` |
| `ends_at` | timestamp | |
| `impressions` / `taps` | number | **Contadores** — solo functions (increment) |
| `description` / `address` / `phone` | string | Perfil del aliado |
| `lat` / `lng` | number | |
| `socials` | map | `{ instagram, facebook, tiktok, website, whatsapp }` |
| `photos` | string[] | Galería |
| `created_at` | timestamp | |

Escritura: solo ADMIN. Contadores: functions vía `FieldValue.increment()`.

---

### `/pushLogs/{logId}` — notificaciones

| Campo | Tipo | Notas |
|---|---|---|
| `title` / `body` | string | |
| `audience` | string | `ALL` \| `BRANCH` \| `EXPIRED` |
| `branch_id` | string \| null | Si `audience == 'BRANCH'` |
| `kind` | string | `BRAND` \| `SPONSOR` |
| `status` | string | `DRAFT` \| `SENT` |
| `scheduled_at` | timestamp \| null | |
| `sent` | number | Destinatarios alcanzados |
| `created_at` | timestamp | |

Escritura: solo ADMIN.

---

### `/store/catalog/products/{productId}` — tienda

| Campo | Tipo |
|---|---|
| `name` | string |
| `category` | string |
| `price` | number |
| `old_price` | number \| null |
| `image_url` | string |
| `tag` | string |

Escritura: solo ADMIN.

---

## Relaciones (canónicas)

```
users.branch_id            → branches.id
users.membership_plan_id   → plans.id
staff.branch_id            → branches.id        (null = admin global)
trainers.branch_ids[]      → branches.id
classes.branch_ids[]       → branches.id
classes.branch_times{}     → keyed by branches.id
classes.coach_id           → trainers.id
checkins.user_id           → users.id
checkins.branch_id         → branches.id
checkins.membership_plan_id→ plans.id
payments.member_id         → users.id
payments.branch_id         → branches.id
payments.plan_id           → plans.id
plans.stripe_price_id      → Stripe Price
users.stripe_customer_id   → Stripe Customer
users/{id}/coupons.ad_id   → sponsorAds.id
promotions.branch_id       → branches.id | null
promotions.plan_ids[]      → plans.id | 'ALL'
sponsorAds.branch_id       → branches.id | null
pushLogs.branch_id         → branches.id | null
```

## Quién escribe qué

| Escritor | Colecciones / campos |
|---|---|
| **Solo Cloud Functions** | `payments`, `checkins`, `webhookEvents`; `users.membership_*`, `member_number`, `qr_code`, `stripe_customer_id`, `claim_pin`, `contact_email`; `branches.current_capacity`; `sponsorAds.impressions/taps`; `classes.booked` |
| **ADMIN** | `config`, `plans`, `promotions`, `sponsorAds`, `pushLogs`, `store/products`, `staff`, `branches` (todas), `classes` (global), `trainers` (todo) |
| **MANAGER** (su sede) | `branches[suSede]`, `users` (edita los de su sede), `trainers` (`shift`, `is_on_duty`, `branch_ids`), `classes.branch_times[suSede]` |
| **RECEPTIONIST** (su sede) | `users` (crear en su sede); operación de check-in/pagos vía callables |
| **Socio (app)** | su `users/{uid}` (campos de perfil), sus `coupons` |

## Flujos escritos por functions (implementadas en `functions/src/`)

- **`checkIn`** (callable, staff en su sede): valida membresía + gracia
  3 días + aforo + `active_checkin_id` (anti doble entrada) → crea checkin
  con `expires_at` TTL + incrementa `current_capacity` + marca
  `last_checkin_at`. Intentos negados también quedan registrados.
- **`checkOut`** (callable, staff en su sede): cierra el check-in,
  decrementa aforo y libera `active_checkin_id`.
- **`autoCheckoutCron`** (cada 15 min): libera check-ins >90 min sin salida.
- **`createPaymentIntent`** (callable, socio): crea/recupera Customer →
  PaymentIntent `card`-only en centavos → devuelve `client_secret`.
- **`stripeWebhook`** (HTTP): firma verificada → idempotencia por
  `/webhookEvents/{eventId}` → `payment_intent.succeeded` crea `payments`
  + extiende `membership_until` 30 días; `payment_failed` registra
  DECLINED; `charge.refunded` marca REFUNDED.
- **`registerManualPayment`** (callable, staff): crea `payments`
  (APPROVED, provider `manual`) + `membership_until += 30d`.
- **`closeDay`** (23:55 `America/Mexico_City`): por sede agrega el día en
  `/dailyStats` (totales, por método, por plan, por hora, pico de aforo
  por sweep de intervalos) → funde `by_hour` en `forecasts.by_weekday`
  (EMA 0.8/0.2) → resetea `current_capacity` → borra check-ins del día.
  El TTL de `expires_at` respalda el borrado.
- **`seedDemo`** (callable): puebla todo el esquema — primera corrida
  libre (si `config/brand` no existe), después solo ADMIN. Crea usuarios
  Auth de staff y socios demo (password `demo1234`).

## Decisiones tomadas

- [x] **Pagos en app: solo tarjeta** (sin OXXO). `PENDING`/`REQUIRES_ACTION`
      quedan para 3DS; casi nunca se ven.
- [x] **Gerente scopeado a su sede** — lee y opera solo sus datos, no ve
      check-ins/pagos de otras sedes.
- [x] **Reglas con `get(staff)` en MVP** — custom claims (`role`,
      `branch_id` en el token) cuando haya functions que los mantengan.
- [x] **Check-ins efímeros** — TTL `expires_at` + `closeDay` agrega en
      `/dailyStats` y resetea aforo. Historia = `dailyStats`, no checkins.
      Motivo: el sistema es comercial (promos/cupones) + aforo en tiempo
      real; el historial individual de entradas no aporta y cada reporte
      pagaría una lectura por doc. `dailyStats` da los mismos reportes a
      1 doc/día y `users.last_checkin_at` preserva retargeting de
      inactivos. Costo de lo perdido: sin trazabilidad individual por
      día (disputas se resuelven contra `payments`, que es permanente).

## Decisiones pendientes

- [ ] Suscripciones Stripe (cobro recurrente) — fase 2, colección
      `/subscriptions` aparte sin tocar lo demás.
- [ ] Métricas de ads por día/dispositivo: contadores simples (actual) vs.
      subcolección `adEvents` si se necesita desglose.
