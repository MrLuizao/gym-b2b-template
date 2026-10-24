# Estructura del Proyecto — RIR-HUB B2B

## Arquitectura

```
rirhub-b2b/
├── app/                        # Frontend Nuxt 4
│   ├── pages/                  # File-based routing (español: socios, clases, etc.)
│   ├── components/             # Vue SFC auto-importados
│   ├── composables/            # useAuth, useFirebase, useDashboardRealtime...
│   ├── layouts/                # default.vue (sidebar + header)
│   ├── middleware/             # auth.global.ts
│   ├── plugins/                # firebase.client.ts
│   └── utils/                  # Helpers
├── server/                     # Backend (Vercel Serverless)
│   ├── api/                    # REST endpoints
│   ├── utils/                  # Lógica de negocio (auth, db, loyalty, etc.)
│   ├── models/                 # ML weights (JSON)
│   └── middleware/             # Server middleware
├── shared/                     # Compartido B2B ↔ Flutter app
│   ├── types.ts                # Interfaces centrales
│   ├── coach-avatars.ts        # Catálogo avatares coaches
│   └── member-avatars.ts       # Catálogo avatares socios
├── AGENTS.md                   # Contexto completo (FUENTE DE VERDAD)
├── FIRESTORE.md                # Schema detallado
├── firestore.rules             # Security rules
├── firestore.indexes.json      # Índices compuestos
├── vercel.json                 # Deploy + crons
└── scripts/                    # ML training, avatar generation
```

## Stack Técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Nuxt | ^4.5 |
| UI Components | @nuxt/ui | ^4.11 |
| Styling | Tailwind CSS | ^4.3 |
| Frontend | Vue 3 | ^3.5 |
| Icons | Lucide (@iconify-json/lucide) | ^1.2 |
| Auth/DB/Push | Firebase + firebase-admin | ^12.19 / ^12.7 |
| Payments | Stripe | ^22.6 |
| Charts | Chart.js | ^4.5 |
| Maps | Leaflet | ^1.9 |
| Email | Nodemailer | ^10 |
| Deploy | Vercel Serverless | — |
| Timezone | America/Mexico_City | — |

## Documentos Clave

- `AGENTS.md` → Fuente de verdad del proyecto (flujos, permisos, integraciones)
- `FIRESTORE.md` → Schema de todas las colecciones
- `shared/types.ts` → Interfaces TypeScript
- `firestore.rules` → Reglas de seguridad
