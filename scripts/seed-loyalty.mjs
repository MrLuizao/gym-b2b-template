#!/usr/bin/env node
/// Siembra SOLO la lealtad: catálogo /rewards, weekly_goal+points en
/// users, y un historial demo de users/{id}/visits. No toca lo demás.
/// Uso: node scripts/seed-loyalty.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(
  readFileSync(resolve(process.cwd(), 'service-account.json'), 'utf8'),
);
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);

const DAY = 86_400_000;
const TZ = 'America/Mexico_City';
const now = Date.now();

function localDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

console.log('Sembrando lealtad en', sa.project_id);

// ═══ rewards (catálogo fijo) ═══
const rewards = [
  { id: 'smoothie', name: 'Smoothie gratis', desc: 'Un smoothie del bar al terminar tu entrenamiento', cost: 50, icon: 'cup' },
  { id: 'guest-pass', name: 'Pase de invitado', desc: 'Un día gratis para un acompañante', cost: 100, icon: 'users' },
  { id: 'pt-session', name: 'Sesión con entrenador', desc: '30 minutos de sesión personalizada', cost: 200, icon: 'dumbbell' },
  { id: 'week-free', name: 'Semana gratis', desc: '7 días de extensión en tu membresía', cost: 350, icon: 'calendar' },
  { id: 'merch', name: 'Kit merch RIR-HUB', desc: 'Playera + shaker de la marca del gym', cost: 500, icon: 'shirt' },
];
for (const r of rewards) {
  await db.collection('rewards').doc(r.id).set({
    name: r.name, description: r.desc, points_cost: r.cost,
    icon: r.icon, image_url: '', active: true,
    created_at: FieldValue.serverTimestamp(),
  });
}
console.log('✓ rewards:', rewards.length);

// ═══ weekly_goal + points + visits demo en socios existentes ═══
const usersSnap = await db.collection('users').get();
let i = 0;
for (const doc of usersSnap.docs) {
  const data = doc.data();
  const patch = {};
  if (data.weekly_goal == null) patch.weekly_goal = 4;
  if (data.points == null) patch.points = 0;
  if (Object.keys(patch).length) await doc.ref.update(patch);

  // Historial demo: 4-6 visitas en los últimos 14 días (salta domingos)
  const visitsSnap = await doc.ref.collection('visits').limit(1).get();
  if (visitsSnap.empty) {
    for (let d = 1; d <= 14; d++) {
      const date = new Date(now - d * DAY);
      if (date.getDay() === 0 || (d + i) % 3 !== 0) continue;
      await doc.ref.collection('visits').doc(localDate(date)).set({
        branch_id: data.branch_id ?? 'select', checkin_id: null,
        at: Timestamp.fromMillis(date.getTime()),
      });
    }
  }
  i++;
}
console.log('✓ users: weekly_goal/points + visits demo en', usersSnap.size);
process.exit(0);
