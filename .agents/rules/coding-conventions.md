# Convenciones de Código — RIR-HUB B2B

## Vue SFC (Frontend)

- Siempre `<script setup lang="ts">` — nunca Options API
- Auto-imports de Nuxt: `ref`, `computed`, `watch`, `useFetch`, `useAsyncData`,
  `navigateTo`, `useRoute`, `useRouter`, `definePageMeta`
- Componentes Nuxt UI v4: `UButton`, `UTable`, `UModal`, `UCard`, `UInput`,
  `USelect`, `UBadge`, `UTabs`, `UDropdownMenu`, `UTooltip`, etc.
- Iconos: `<UIcon name="i-lucide-xxx" />` (no imports manuales de lucide)
- Dark-mode only: `colorMode: false` en nuxt.config — nunca agregar toggle ni
  clases condicionales `dark:`. Todo es dark por defecto.
- UI en español (México)
- Composables propios van en `app/composables/` con prefijo `use`

## Server Routes (Backend)

- Siempre `defineEventHandler(async (event) => { ... })`
- Siempre validar auth: `requireStaff`, `requireMember`, o `requireUser`
- Errores: `throw createError({ statusCode: 4xx, statusMessage: '...' })`
- Nunca exponer datos internos en mensajes de error
- Transacciones Firestore para operaciones atómicas (aforo, cupo, puntos)
- Todas las fechas de negocio en `America/Mexico_City`
- Rate-limit en endpoints sensibles (ver `server/utils/rate-limit.ts`)

## TypeScript

- Strict mode habilitado (`tsconfig.json`)
- Interfaces compartidas en `shared/types.ts`
- No usar `any` — preferir tipos explícitos o `unknown`
- Firestore docs: castear con `as InterfaceType` al leer `.data()`

## Firestore

- Leer `FIRESTORE.md` antes de modificar cualquier colección
- Índices compuestos: `firestore.indexes.json`
- Security rules: `firestore.rules`
- Nunca escribir directamente desde el cliente — siempre vía server API
  (excepto whitelist explícita en rules: avatar, weekly_goal)

## Git

- No commitear: `.env`, `service-account.json`, `node_modules`
- Ramas desde `main`
- Mensajes en español o inglés, concisos
