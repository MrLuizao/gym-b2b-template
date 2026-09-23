#!/usr/bin/env node
/// Siembra el esquema completo de FIRESTORE.md en el proyecto real.
/// Uso: node scripts/seed.mjs   (lee service-account.json de la raíz)
/// Crea usuarios Auth de staff y socios demo — password: demo1234
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(
  readFileSync(resolve(process.cwd(), 'service-account.json'), 'utf8'),
);
const app = initializeApp({ credential: cert(sa) });
const db = getFirestore(app);
const auth = getAuth(app);

const DEMO_PASSWORD = 'demo1234';
const DAY = 86_400_000;
const TZ = 'America/Mexico_City';
const now = Date.now();

async function ensureUser(email, displayName) {
  try {
    return (await auth.getUserByEmail(email)).uid;
  } catch {
    return (await auth.createUser({ email, password: DEMO_PASSWORD, displayName })).uid;
  }
}

function localDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function trafficCurve(seed) {
  const arr = new Array(24).fill(0);
  let a = seed;
  const rnd = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let h = 6; h <= 22; h++) {
    const base = 0.16 + 0.52 * Math.exp(-((h - 8) ** 2) / 4.5) + 0.78 * Math.exp(-((h - 19) ** 2) / 5.5);
    arr[h] = Math.round(Math.max(0.05, base + (rnd() - 0.5) * 0.08) * 40);
  }
  return arr;
}

console.log('Sembrando en proyecto', sa.project_id);

// ═══ config/brand ═══
await db.collection('config').doc('brand').set({
  name: 'Capital Fitness',
  logo_url: '',
  colors: { primary: '#f97316', accent: '#f97316', background: '#0a0a0a' },
  timezone: TZ,
  currency: 'MXN',
  socials: {},
});

// ═══ branches ═══
const branches = [
  { id: 'select', name: 'Select', max: 200, open: 360, close: 1320, address: 'Av. Hidalgo · Centro', lat: 19.2926, lng: -99.6572 },
  { id: 'xpress', name: 'Xpress Metepec', max: 90, open: 360, close: 1320, address: 'Av. Paseo Tollocan #412', lat: 19.2548, lng: -99.6057 },
  { id: 'centro', name: 'Centro Histórico', max: 150, open: 420, close: 1320, address: 'Av. Juárez Sur #129', lat: 19.2855, lng: -99.6549 },
  { id: 'carranza', name: 'Carranza', max: 120, open: 420, close: 1300, address: 'C. Carranza #285', lat: 19.281, lng: -99.6603 },
];
for (const b of branches) {
  await db.collection('branches').doc(b.id).set({
    name: b.name, image_url: `https://picsum.photos/seed/cf-${b.id}/800/500`,
    address: b.address, max_capacity: b.max, current_capacity: 0,
    status: 'OPEN', open_minutes: b.open, close_minutes: b.close,
    lat: b.lat, lng: b.lng,
  });
}
console.log('✓ branches:', branches.length);

// ═══ plans ═══
const plans = [
  { id: 'classic', name: 'Plan Classic', price: 199, features: ['Acceso a 1 sede', 'Clases grupales', 'Pase digital QR'], highlight: false, all: false },
  { id: 'plus', name: 'Plan Plus', price: 299, features: ['Acceso a todas las sedes', 'Clases grupales', 'Invita a 1 amigo/mes'], highlight: false, all: true },
  { id: 'black', name: 'Plan Black', price: 399, features: ['Acceso a todas las sedes', 'Clases + invitados ilimitados', 'Cupones exclusivos'], highlight: true, all: true },
  { id: 'select', name: 'Plan Select', price: 249, features: ['Solo sede Select', 'Zona premium', 'Pase digital QR'], highlight: false, all: false },
  { id: 'xpress', name: 'Plan Xpress', price: 179, features: ['Solo sede Xpress', 'Horario extendido', 'Pase digital QR'], highlight: false, all: false },
];
for (const p of plans) {
  await db.collection('plans').doc(p.id).set({
    name: p.name, price: p.price, features: p.features,
    highlight: p.highlight, all_branches: p.all,
    stripe_product_id: null, stripe_price_id: null, active: true,
  });
}
console.log('✓ plans:', plans.length);

// ═══ trainers ═══
const trainers = [
  { id: 't1', name: 'Marcos Villalba', specialty: 'Fuerza · Hipertrofia', branchIds: ['select', 'centro'], shift: 'MAÑANA', onDuty: true },
  { id: 't2', name: 'Lucía Ortega', specialty: 'Movilidad · Yoga', branchIds: ['select'], shift: 'MAÑANA', onDuty: true },
  { id: 't3', name: 'Diego Salas', specialty: 'Cross Training', branchIds: ['centro', 'carranza'], shift: 'TARDE', onDuty: true },
  { id: 't4', name: 'Carla Mendoza', specialty: 'Pérdida de grasa', branchIds: ['carranza', 'select'], shift: 'TARDE', onDuty: false },
  { id: 't5', name: 'Iván Paredes', specialty: 'Boxeo · Acondicionamiento', branchIds: ['xpress', 'carranza'], shift: 'NOCHE', onDuty: false },
];
for (const t of trainers) {
  await db.collection('trainers').doc(t.id).set({
    branch_ids: t.branchIds, name: t.name, specialty: t.specialty,
    photo_url: `https://picsum.photos/seed/cf-${t.id}/300/300`,
    shift: t.shift, is_on_duty: t.onDuty, active: true,
  });
}
console.log('✓ trainers:', trainers.length);

// ═══ classes ═══
const classes = [
  { id: 'cl1', name: 'Spinning Extreme', coachId: 't1', coach: 'Marcos Villalba', branchIds: ['select', 'centro'], room: 'Sala Cycle 1', start: 360, end: 420, cap: 24, times: { centro: { start_minutes: 510, end_minutes: 570, room: 'Sala Cycle 2' } } },
  { id: 'cl2', name: 'Yoga Flow', coachId: 't2', coach: 'Lucía Ortega', branchIds: ['select'], room: 'Sala Mind', start: 450, end: 510, cap: 18, times: {} },
  { id: 'cl3', name: 'Funcional HIIT', coachId: 't3', coach: 'Diego Salas', branchIds: ['centro'], room: 'Sala Cross', start: 735, end: 795, cap: 20, times: {} },
  { id: 'cl4', name: 'Body Pump', coachId: 't4', coach: 'Carla Mendoza', branchIds: ['select', 'carranza'], room: 'Sala Power', start: 1080, end: 1140, cap: 26, times: { carranza: { start_minutes: 1170, end_minutes: 1230, room: 'Sala Power 2' } } },
  { id: 'cl4b', name: 'Zumba Party', coachId: '', coach: 'Roxana Medina', branchIds: ['centro', 'carranza'], room: 'Sala Ritmo', start: 1170, end: 1230, cap: 30, times: {} },
  { id: 'cl4b2', name: 'Box Training', coachId: 't5', coach: 'Iván Paredes', branchIds: ['carranza', 'xpress'], room: 'Ring Central', start: 1200, end: 1260, cap: 16, times: {} },
];
for (const c of classes) {
  await db.collection('classes').doc(c.id).set({
    name: c.name, branch_ids: c.branchIds, coach_id: c.coachId, coach: c.coach,
    room: c.room, start_minutes: c.start, end_minutes: c.end,
    capacity: c.cap, booked: 0, branch_times: c.times,
  });
}
console.log('✓ classes:', classes.length);

// ═══ staff auth + docs ═══
const staffDefs = [
  { email: 'admin@capitalfitness.mx', name: 'Admin Global', role: 'ADMIN', branch: null },
  { email: 'gerente@capitalfitness.mx', name: 'Gerente Select', role: 'MANAGER', branch: 'select' },
  { email: 'recepcion@capitalfitness.mx', name: 'Recepción Select', role: 'RECEPTIONIST', branch: 'select' },
];
for (const s of staffDefs) {
  const uid = await ensureUser(s.email, s.name);
  await db.collection('staff').doc(uid).set({
    name: s.name, role: s.role, branch_id: s.branch, active: true,
  });
}
console.log('✓ staff:', staffDefs.map((s) => s.email).join(', '));

// ═══ members (auth + users) ═══
const members = [
  { email: 'socio1@capitalfitness.mx', name: 'Luis Rojas', branch: 'select', plan: 'black', num: 'CF-00421', until: now + 45 * DAY, status: 'ACTIVE' },
  { email: 'socio2@capitalfitness.mx', name: 'Carla Mendoza', branch: 'carranza', plan: 'plus', num: 'CF-01187', until: now - 12 * DAY, status: 'EXPIRED' },
  { email: 'socio3@capitalfitness.mx', name: 'Diego Salas', branch: 'centro', plan: 'select', num: 'CF-00873', until: now + 30 * DAY, status: 'ACTIVE' },
  { email: 'socio4@capitalfitness.mx', name: 'Roxana Vega', branch: 'select', plan: 'black', num: 'CF-00219', until: now - 1 * DAY, status: 'ACTIVE' },
  { email: 'socio5@capitalfitness.mx', name: 'Iván Paredes', branch: 'xpress', plan: 'xpress', num: 'CF-01540', until: now - 40 * DAY, status: 'EXPIRED' },
];
const memberIds = [];
for (const m of members) {
  const uid = await ensureUser(m.email, m.name);
  memberIds.push(uid);
  await db.collection('users').doc(uid).set({
    branch_id: m.branch, name: m.name,
    photo_url: `https://picsum.photos/seed/cf-${m.num}/300/300`,
    member_number: m.num, qr_code: uid,
    membership_status: m.status, membership_plan_id: m.plan,
    membership_until: Timestamp.fromMillis(m.until),
    first_name: null, middle_name: null, paternal_last_name: null,
    maternal_last_name: null, sex: null, birth_date: null,
    phone: null, id_number: null,
    stripe_customer_id: null, last_checkin_at: null,
    active_checkin_id: null, active_checkin_branch: null,
    created_at: FieldValue.serverTimestamp(),
  });
}
console.log('✓ members:', members.length);

// ═══ payments (historial) ═══
const paySeeds = [
  { m: 0, plan: 'black', planName: 'Plan Black', amount: 399, method: 'terminal', ago: 1 },
  { m: 2, plan: 'select', planName: 'Plan Select', amount: 249, method: 'terminal', ago: 1 },
  { m: 3, plan: 'black', planName: 'Plan Black', amount: 399, method: 'cash', ago: 0.7, declined: true },
  { m: 1, plan: 'plus', planName: 'Plan Plus', amount: 299, method: 'cash', ago: 1.5 },
];
for (let i = 0; i < paySeeds.length; i++) {
  const s = paySeeds[i];
  await db.collection('payments').add({
    member_id: memberIds[s.m], member_name: members[s.m].name,
    member_number: members[s.m].num, branch_id: members[s.m].branch,
    plan_id: s.plan, plan: s.planName, amount: s.amount, currency: 'mxn',
    provider: 'manual', method: s.method,
    transaction_id: `TX-SEED-${i + 1}`,
    stripe_payment_intent_id: null, stripe_charge_id: null, receipt_url: null,
    status: s.declined ? 'DECLINED' : 'APPROVED',
    failure_reason: s.declined ? 'Fondos insuficientes' : null,
    created_at: Timestamp.fromMillis(now - s.ago * DAY),
    created_by: 'reception',
  });
}
console.log('✓ payments:', paySeeds.length);

// ═══ promotions ═══
await db.collection('promotions').doc('banner-1').set({
  type: 'banner', branch_id: null,
  title: 'Whey X-Treme 25% OFF',
  subtitle: 'Suplementos de recepción · solo esta semana',
  badge: '-25%', image_url: 'https://picsum.photos/seed/cf-banner-1/900/500',
  created_at: Timestamp.fromMillis(now - DAY), expires_at: null,
});
const coupons = [
  { id: 'c1', title: 'Proteína X-Treme -25%', desc: 'En suplementos de recepción', badge: '-25%', code: 'CF-PRO25', plans: ['plus', 'black'] },
  { id: 'c2', title: 'Invita a un amigo', desc: 'Clase grupal gratis para un acompañante', badge: '1 FREE', code: 'CF-GUEST1', plans: ['black'] },
  { id: 'c3', title: 'Bebidas 2x1', desc: 'Bebidas de recepción después de las 18:00', badge: '2x1', code: 'CF-BEB2X1', plans: ['classic', 'plus', 'select', 'xpress'] },
  { id: 'c4', title: 'Merch Capital -15%', desc: 'Camisetas, guantes y accesorios', badge: '-15%', code: 'CF-MERCH15', plans: ['classic', 'select', 'xpress'] },
];
for (const c of coupons) {
  await db.collection('promotions').doc(c.id).set({
    type: 'coupon', branch_id: null, title: c.title, description: c.desc,
    badge: c.badge, code: c.code, plan_ids: c.plans,
    created_at: Timestamp.fromMillis(now - 2 * DAY), expires_at: null,
  });
}
console.log('✓ promotions: 1 banner +', coupons.length, 'cupones');

// ═══ sponsorAds ═══
const ads = [
  { id: 'ad1', advertiser: 'NutriShop', title: 'Whey X-Treme -20%', color: 0xfff97316, branch: null, status: 'ACTIVE', imp: 8420, taps: 512, ends: 30 },
  { id: 'ad2', advertiser: 'SportLine', title: 'Guantes y straps -15%', color: 0xffef4444, branch: 'select', status: 'ACTIVE', imp: 3210, taps: 198, ends: 15 },
  { id: 'ad3', advertiser: 'Café Verde', title: 'Cold brew 2x1 post-entreno', color: 0xff22c55e, branch: 'centro', status: 'PAUSED', imp: 1180, taps: 74, ends: 45 },
];
for (const a of ads) {
  await db.collection('sponsorAds').doc(a.id).set({
    advertiser: a.advertiser, title: a.title,
    subtitle: 'Solo con tu credencial de socio', badge: 'ALIADO',
    brand_color: a.color, image_url: `https://picsum.photos/seed/${a.id}/700/400`,
    cta_label: 'Ver oferta', branch_id: a.branch, status: a.status,
    ends_at: Timestamp.fromMillis(now + a.ends * DAY),
    impressions: a.imp, taps: a.taps,
    description: '', address: '', lat: 19.25, lng: -99.6, phone: '',
    socials: {}, photos: [],
    created_at: Timestamp.fromMillis(now - 10 * DAY),
  });
}
console.log('✓ sponsorAds:', ads.length);

// ═══ pushLogs + store ═══
await db.collection('pushLogs').add({
  title: 'Spin Night', body: 'Reserva tu bici para la clase de las 19:00 en Select.',
  audience: 'ALL', branch_id: null, kind: 'BRAND',
  status: 'SENT', scheduled_at: null, sent: 1248,
  created_at: Timestamp.fromMillis(now - DAY / 2),
});
const products = [
  { name: 'Whey Protein 2lb', category: 'Suplementos', price: 899, tag: 'POPULAR' },
  { name: 'Guantes de entrenamiento', category: 'Accesorios', price: 349, tag: null },
  { name: 'Playera Capital', category: 'Ropa', price: 299, tag: 'NUEVO' },
  { name: 'Creatina 300g', category: 'Suplementos', price: 549, tag: null },
];
for (const p of products) {
  await db.collection('store').doc('catalog').collection('products').add({
    name: p.name, category: p.category, price: p.price,
    old_price: null, image_url: '', tag: p.tag,
  });
}
console.log('✓ pushLogs + products');

// ═══ dailyStats (14 días) + forecasts ═══
for (const b of branches) {
  const weekdayCurve = {};
  for (let d = 14; d >= 1; d--) {
    const date = new Date(now - d * DAY);
    const dateStr = localDate(date);
    const curve = trafficCurve(d * 7 + branches.indexOf(b));
    const total = curve.reduce((s, v) => s + v, 0);
    const granted = Math.round(total * 0.94);
    await db.collection('dailyStats').doc(`${b.id}_${dateStr}`).set({
      branch_id: b.id, date: dateStr, total, granted, denied: total - granted,
      by_method: { qr: Math.round(granted * 0.65), usb: Math.round(granted * 0.35) },
      by_plan: {
        classic: Math.round(granted * 0.3), plus: Math.round(granted * 0.25),
        black: Math.round(granted * 0.2), select: Math.round(granted * 0.15),
        xpress: Math.round(granted * 0.1),
      },
      by_hour: curve,
      peak_capacity: Math.max(...curve),
      unique_members: Math.round(granted * 0.6),
    });
    const wd = String(((date.getDay() + 6) % 7) + 1);
    const key = `${b.id}_${wd}`;
    const prev = weekdayCurve[key] ?? new Array(24).fill(0);
    weekdayCurve[key] = curve.map((v, h) => prev[h] * 0.5 + v * 0.5);
  }
  const byWeekday = {};
  for (let wd = 1; wd <= 7; wd++) {
    byWeekday[String(wd)] =
      weekdayCurve[`${b.id}_${wd}`] ?? trafficCurve(wd + branches.indexOf(b));
  }
  await db.collection('forecasts').doc(b.id).set({
    by_weekday: byWeekday, sample_days: 14,
    updated_at: FieldValue.serverTimestamp(),
  });
}
console.log('✓ dailyStats (14d × 4 sedes) + forecasts');

console.log('\nListo. Accesos demo (password demo1234):');
console.log('  admin@capitalfitness.mx      → ADMIN');
console.log('  gerente@capitalfitness.mx    → MANAGER (Select)');
console.log('  recepcion@capitalfitness.mx  → RECEPTIONIST (Select)');
console.log('  socio1..5@capitalfitness.mx  → socios');
process.exit(0);
