import { createHmac, randomUUID } from 'node:crypto';

import type {
  Branch,
  CheckInRecord,
  ClassSchedule,
  Coupon,
  Member,
  MembershipPlan,
  PaymentRecord,
  PromoBanner,
  PushLog,
  SponsorAd,
  Trainer,
  TrafficPoint,
} from '#shared/types';

const QR_SIGNING_KEY = 'prototipo-gym-dev-key';

export const PROMO_OPT_IN_RATE = 0.68;
export const TOTAL_DEVICES = 1248;

interface MockDb {
  branches: Branch[];
  members: Member[];
  checkIns: CheckInRecord[];
  promos: PromoBanner[];
  coupons: Coupon[];
  pushes: PushLog[];
  ads: SponsorAd[];
  traffic: TrafficPoint[];
  trainers: Trainer[];
  classes: ClassSchedule[];
  payments: PaymentRecord[];
  plans: MembershipPlan[];
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildTrafficCurve(daySeed: number): TrafficPoint[] {
  const random = mulberry32(daySeed);
  const points: TrafficPoint[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    const morning = Math.exp(-((hour - 8) ** 2) / 4.5);
    const evening = Math.exp(-((hour - 19) ** 2) / 5.5);
    const base = 0.16 + 0.52 * morning + 0.78 * evening;
    const noise = (random() - 0.5) * 0.08;
    points.push({
      hour,
      value: Math.round(Math.max(0.05, base + noise) * 560),
    });
  }
  return points;
}

function seedCheckIns(members: Member[], branches: Branch[]): CheckInRecord[] {
  const random = mulberry32(20260919);
  const records: CheckInRecord[] = [];
  const now = Date.now();
  const total = 180 + Math.floor(random() * 60);
  for (let i = 0; i < total; i++) {
    const member = members[Math.floor(random() * members.length)]!;
    const branch = branches[Math.floor(random() * branches.length)]!;
    const minutesAgo = Math.floor(random() * 600);
    const granted = random() > 0.06;
    records.push({
      id: randomUUID(),
      userId: member.id,
      branchId: branch.id,
      memberName: member.name,
      membershipType: member.membershipType,
      method: random() > 0.35 ? 'qr' : 'usb',
      granted,
      reason: granted ? undefined : 'MEMBERSHIP_EXPIRED',
      checkInAt: now - minutesAgo * 60_000,
      checkedOut: minutesAgo > 95,
      checkedOutAt: minutesAgo > 95 ? now - (minutesAgo - 92) * 60_000 : undefined,
    });
  }
  return records.sort((a, b) => b.checkInAt - a.checkInAt);
}

function createMockDb(): MockDb {
  const branches: Branch[] = [
    {
      id: 'select',
      brandId: 'capital_fitness',
      name: 'Select',
      maxCapacity: 200,
      currentCapacity: 96,
      status: 'OPEN',
      imageUrl: 'https://picsum.photos/seed/cf-select/800/500',
      address: 'Av. Arce · Zona Central',
      openMinutes: 360,
      closeMinutes: 1320,
      lat: -16.504,
      lng: -68.13,
    },
    {
      id: 'xpress',
      brandId: 'capital_fitness',
      name: 'Xpress Sopocachi',
      maxCapacity: 90,
      currentCapacity: 31,
      status: 'OPEN',
      imageUrl: 'https://picsum.photos/seed/cf-xpress/800/500',
      address: 'C. Belisario Salinas #412',
      openMinutes: 360,
      closeMinutes: 1320,
      lat: -16.501,
      lng: -68.135,
    },
    {
      id: 'centro',
      brandId: 'capital_fitness',
      name: 'Centro Histórico',
      maxCapacity: 150,
      currentCapacity: 121,
      status: 'OPEN',
      imageUrl: 'https://picsum.photos/seed/cf-centro/800/500',
      address: 'Av. Mariscal Santa Cruz #129',
      openMinutes: 420,
      closeMinutes: 1320,
      lat: -16.499,
      lng: -68.124,
    },
    {
      id: 'carranza',
      brandId: 'capital_fitness',
      name: 'Carranza',
      maxCapacity: 120,
      currentCapacity: 41,
      status: 'OPEN',
      imageUrl: 'https://picsum.photos/seed/cf-carranza/800/500',
      address: 'C. Carranza #285',
      openMinutes: 420,
      closeMinutes: 1300,
      lat: -16.497,
      lng: -68.141,
    },
  ];

  const now = Date.now();
  const day = 86_400_000;

  const members: Member[] = [
    {
      id: 'demo-user-001',
      branchId: 'select',
      name: 'Luis Rojas',
      photoUrl: 'https://picsum.photos/seed/cf-member-1/300/300',
      membershipStatus: 'ACTIVE',
      membershipType: 'Plan Black',
      memberNumber: 'CF-00421',
      membershipUntil: now + 45 * day,
    },
    {
      id: 'demo-user-002',
      branchId: 'carranza',
      name: 'Carla Mendoza',
      photoUrl: 'https://picsum.photos/seed/cf-member-2/300/300',
      membershipStatus: 'EXPIRED',
      membershipType: 'Plan Plus',
      memberNumber: 'CF-01187',
      membershipUntil: now - 12 * day,
    },
    {
      id: 'demo-user-003',
      branchId: 'centro',
      name: 'Diego Salas',
      photoUrl: 'https://picsum.photos/seed/cf-member-3/300/300',
      membershipStatus: 'ACTIVE',
      membershipType: 'Plan Select',
      memberNumber: 'CF-00873',
      membershipUntil: now + 30 * day,
    },
    {
      id: 'demo-user-004',
      branchId: 'select',
      name: 'Roxana Quispe',
      photoUrl: 'https://picsum.photos/seed/cf-member-4/300/300',
      membershipStatus: 'ACTIVE',
      membershipType: 'Plan Black',
      memberNumber: 'CF-00219',
      membershipUntil: now - 1 * day,
    },
    {
      id: 'demo-user-005',
      branchId: 'xpress',
      name: 'Iván Paredes',
      photoUrl: 'https://picsum.photos/seed/cf-member-5/300/300',
      membershipStatus: 'EXPIRED',
      membershipType: 'Plan Xpress',
      memberNumber: 'CF-01540',
      membershipUntil: now - 40 * day,
    },
  ];

  const traffic = buildTrafficCurve(20260919);

  return {
    branches,
    members,
    checkIns: seedCheckIns(members, branches),
    promos: [
      {
        id: randomUUID(),
        title: 'Whey X-Treme 25% OFF',
        subtitle: 'Suplementos de recepción · solo esta semana',
        badge: '-25%',
        imageUrl: 'https://picsum.photos/seed/cf-banner-1/900/500',
        branchId: null,
        createdAt: Date.now() - 86_400_000,
      },
    ],
    coupons: [
      {
        id: 'c1',
        title: 'Proteína X-Treme -25%',
        description: 'En suplementos de recepción',
        badge: '-25%',
        code: 'CF-PRO25',
        levels: ['PLUS', 'BLACK'],
        branchId: null,
        createdAt: Date.now() - 172_800_000,
      },
      {
        id: 'c2',
        title: 'Invita a un amigo',
        description: 'Clase grupal gratis para un acompañante',
        badge: '1 FREE',
        code: 'CF-GUEST1',
        levels: ['BLACK'],
        branchId: null,
        createdAt: Date.now() - 86_400_000,
      },
      {
        id: 'c3',
        title: 'Bebidas 2x1',
        description: 'Bebidas de recepción después de las 18:00',
        badge: '2x1',
        code: 'CF-BEB2X1',
        levels: ['CLASSIC', 'PLUS'],
        branchId: null,
        createdAt: Date.now() - 86_400_000,
      },
      {
        id: 'c4',
        title: 'Merch Capital -15%',
        description: 'Camisetas, guantes y accesorios',
        badge: '-15%',
        code: 'CF-MERCH15',
        levels: ['CLASSIC'],
        branchId: null,
        createdAt: Date.now() - 86_400_000,
      },
    ],
    pushes: [
      {
        id: randomUUID(),
        title: 'Spin Night 🔥',
        body: 'Reserva tu bici para la clase de las 19:00 en Select.',
        audience: 'ALL',
        branchId: null,
        kind: 'BRAND',
        sent: 1248,
        createdAt: Date.now() - 43_200_000,
      },
    ],
    ads: [
      {
        id: 'ad1',
        advertiser: 'NutriShop',
        title: 'Whey X-Treme -20%',
        subtitle: 'Solo con tu credencial de socio',
        badge: 'ALIADO',
        brandColor: 0xfff97316,
        imageUrl: 'https://picsum.photos/seed/ad-nutri/700/400',
        ctaLabel: 'Ver oferta',
        branchId: null,
        status: 'ACTIVE',
        endsAt: Date.now() + 30 * 86_400_000,
        impressions: 8420,
        taps: 512,
        createdAt: Date.now() - 12 * 86_400_000,
        description:
          'Tienda de suplementos deportivos. Muestra tu credencial de socio y obtén 20% de descuento en proteínas, creatina y pre-entrenos.',
        address: 'Av. Tecnológico 1200, Plaza San Carlos, Metepec',
        lat: 19.2547,
        lng: -99.6285,
        phone: '+52 722 555 0101',
        socials: {
          instagram: 'https://instagram.com/nutrishop.metepec',
          facebook: 'https://facebook.com/nutrishopmx',
          tiktok: '',
          website: 'https://nutrishop.mx',
          whatsapp: '+52 722 555 0101',
        },
        photos: [
          'https://picsum.photos/seed/ad-nutri-1/600/400',
          'https://picsum.photos/seed/ad-nutri-2/600/400',
          'https://picsum.photos/seed/ad-nutri-3/600/400',
        ],
      },
      {
        id: 'ad2',
        advertiser: 'SportLine',
        title: 'Guantes y straps -15%',
        subtitle: 'En sucursal Plaza o online',
        badge: 'ALIADO',
        brandColor: 0xffef4444,
        imageUrl: 'https://picsum.photos/seed/ad-sport/700/400',
        ctaLabel: 'Comprar',
        branchId: 'select',
        status: 'ACTIVE',
        endsAt: Date.now() + 15 * 86_400_000,
        impressions: 3210,
        taps: 198,
        createdAt: Date.now() - 8 * 86_400_000,
        description:
          'Tienda de artículos deportivos. Descuento en guantes, straps, cinturones y accesorios de entrenamiento para socios.',
        address: 'Plaza Metepec, Local 214, Metepec',
        lat: 19.2598,
        lng: -99.6012,
        phone: '+52 722 555 0202',
        socials: {
          instagram: 'https://instagram.com/sportline.mx',
          facebook: 'https://facebook.com/sportlinemx',
          tiktok: 'https://tiktok.com/@sportlinemx',
          website: 'https://sportline.mx',
          whatsapp: '',
        },
        photos: [
          'https://picsum.photos/seed/ad-sport-1/600/400',
          'https://picsum.photos/seed/ad-sport-2/600/400',
        ],
      },
      {
        id: 'ad3',
        advertiser: 'Café Verde',
        title: 'Cold brew 2x1 post-entreno',
        subtitle: 'A dos cuadras de sede Centro',
        badge: 'ALIADO',
        brandColor: 0xff22c55e,
        imageUrl: 'https://picsum.photos/seed/ad-cafe/700/400',
        ctaLabel: 'Cómo llegar',
        branchId: 'centro',
        status: 'PAUSED',
        endsAt: Date.now() + 45 * 86_400_000,
        impressions: 1180,
        taps: 74,
        createdAt: Date.now() - 20 * 86_400_000,
        description:
          'Cafetería de especialidad con opciones saludables: cold brew, bowls y snacks post-entreno. 2x1 para socios de lunes a viernes.',
        address: 'Calle Juárez 45, Centro, Metepec',
        lat: 19.2511,
        lng: -99.6049,
        phone: '+52 722 555 0303',
        socials: {
          instagram: 'https://instagram.com/cafeverde.mtp',
          facebook: '',
          tiktok: '',
          website: '',
          whatsapp: '+52 722 555 0303',
        },
        photos: ['https://picsum.photos/seed/ad-cafe-1/600/400'],
      },
    ],
    trainers: [
      {
        id: 't1',
        branchIds: ['select', 'centro'],
        photoUrl: 'https://picsum.photos/seed/cf-t1/300/300',
        name: 'Marcos Villalba',
        specialty: 'Fuerza · Hipertrofia',
        shift: 'MAÑANA',
        isOnDuty: true,
      },
      {
        id: 't2',
        branchIds: ['select'],
        photoUrl: 'https://picsum.photos/seed/cf-t2/300/300',
        name: 'Lucía Ortega',
        specialty: 'Movilidad · Yoga',
        shift: 'MAÑANA',
        isOnDuty: true,
      },
      {
        id: 't3',
        branchIds: ['centro', 'carranza'],
        photoUrl: 'https://picsum.photos/seed/cf-t3/300/300',
        name: 'Diego Salas',
        specialty: 'Cross Training',
        shift: 'TARDE',
        isOnDuty: true,
      },
      {
        id: 't4',
        branchIds: ['carranza', 'select'],
        photoUrl: 'https://picsum.photos/seed/cf-t4/300/300',
        name: 'Carla Mendoza',
        specialty: 'Pérdida de grasa',
        shift: 'TARDE',
        isOnDuty: false,
      },
      {
        id: 't5',
        branchIds: ['xpress', 'carranza'],
        photoUrl: 'https://picsum.photos/seed/cf-t5/300/300',
        name: 'Iván Paredes',
        specialty: 'Boxeo · Acondicionamiento',
        shift: 'NOCHE',
        isOnDuty: false,
      },
    ],
    classes: [
      {
        id: 'cl1',
        branchIds: ['select', 'centro'],
        name: 'Spinning Extreme',
        coach: 'Marcos Villalba',
        room: 'Sala Cycle 1',
        startMinutes: 6 * 60,
        endMinutes: 7 * 60,
        capacity: 24,
        booked: 19,
      },
      {
        id: 'cl2',
        branchIds: ['select'],
        name: 'Yoga Flow',
        coach: 'Lucía Ortega',
        room: 'Sala Mind',
        startMinutes: 7 * 60 + 30,
        endMinutes: 8 * 60 + 30,
        capacity: 18,
        booked: 9,
      },
      {
        id: 'cl3',
        branchIds: ['centro'],
        name: 'Funcional HIIT',
        coach: 'Diego Salas',
        room: 'Sala Cross',
        startMinutes: 12 * 60 + 15,
        endMinutes: 13 * 60 + 15,
        capacity: 20,
        booked: 17,
      },
      {
        id: 'cl4',
        branchIds: ['select', 'carranza'],
        name: 'Body Pump',
        coach: 'Carla Mendoza',
        room: 'Sala Power',
        startMinutes: 18 * 60,
        endMinutes: 19 * 60,
        capacity: 26,
        booked: 26,
      },
      {
        id: 'cl4b',
        branchIds: ['centro', 'carranza'],
        name: 'Zumba Party',
        coach: 'Roxana Medina',
        room: 'Sala Ritmo',
        startMinutes: 19 * 60 + 30,
        endMinutes: 20 * 60 + 30,
        capacity: 30,
        booked: 22,
      },
      {
        id: 'cl4b2',
        branchIds: ['carranza', 'xpress'],
        name: 'Box Training',
        coach: 'Iván Paredes',
        room: 'Ring Central',
        startMinutes: 20 * 60,
        endMinutes: 21 * 60,
        capacity: 16,
        booked: 9,
      },
    ],
    payments: [
      {
        id: randomUUID(),
        memberName: 'Luis Rojas',
        memberId: 'demo-user-001',
        branchId: 'select',
        plan: 'Plan Black',
        amountBs: 399,
        method: 'VISA •••• 4242',
        transactionId: 'TX-1729100001',
        status: 'APPROVED',
        createdAt: Date.now() - 86_400_000,
      },
      {
        id: randomUUID(),
        memberName: 'Diego Salas',
        memberId: 'demo-user-003',
        branchId: 'centro',
        plan: 'Plan Select',
        amountBs: 249,
        method: 'MASTERCARD',
        transactionId: 'TX-1729090000',
        status: 'APPROVED',
        createdAt: Date.now() - 90_000_000,
      },
      {
        id: randomUUID(),
        memberName: 'Roxana Quispe',
        memberId: 'demo-user-004',
        branchId: 'select',
        plan: 'Plan Black',
        amountBs: 399,
        method: 'VISA',
        transactionId: 'TX-1729095000',
        status: 'DECLINED',
        createdAt: Date.now() - 60_000_000,
      },
      {
        id: randomUUID(),
        memberName: 'Carla Mendoza',
        memberId: 'demo-user-002',
        branchId: 'carranza',
        plan: 'Plan Plus',
        amountBs: 299,
        method: 'VISA',
        transactionId: 'TX-1729090500',
        status: 'APPROVED',
        createdAt: Date.now() - 129_600_000,
      },
    ],
    plans: [
      {
        id: 'classic',
        name: 'Plan Classic',
        level: 'CLASSIC',
        priceBs: 199,
        features: ['Acceso a 1 sede', 'Clases grupales', 'Pase digital QR'],
        highlight: false,
        allBranches: false,
      },
      {
        id: 'plus',
        name: 'Plan Plus',
        level: 'PLUS',
        priceBs: 299,
        features: [
          'Acceso a todas las sedes',
          'Clases grupales',
          'Invita a 1 amigo/mes',
        ],
        highlight: false,
        allBranches: true,
      },
      {
        id: 'black',
        name: 'Plan Black',
        level: 'BLACK',
        priceBs: 399,
        features: [
          'Acceso a todas las sedes',
          'Clases + invitados ilimitados',
          'Cupones exclusivos',
        ],
        highlight: true,
        allBranches: true,
      },
      {
        id: 'select',
        name: 'Plan Select',
        level: 'CLASSIC',
        priceBs: 249,
        features: ['Solo sede Select', 'Zona premium', 'Pase digital QR'],
        highlight: false,
        allBranches: false,
      },
      {
        id: 'xpress',
        name: 'Plan Xpress',
        level: 'CLASSIC',
        priceBs: 179,
        features: ['Solo sede Xpress', 'Horario extendido', 'Pase digital QR'],
        highlight: false,
        allBranches: false,
      },
    ],
    traffic: buildTrafficCurve(20260919),
  };
}

const globalRef = globalThis as typeof globalThis & {
  __gymMockDb?: MockDb;
};

export function useMockDb(): MockDb {
  globalRef.__gymMockDb ??= createMockDb();
  return globalRef.__gymMockDb;
}

export function signQrToken(memberId: string, issuedAt: number): string {
  return createHmac('sha256', QR_SIGNING_KEY)
    .update(`${memberId}|${issuedAt}`)
    .digest('hex');
}

export function verifyQrToken(
  memberId: string,
  issuedAt: number,
  signature: string,
): boolean {
  const expected = signQrToken(memberId, issuedAt);
  return expected === signature;
}

export { mulberry32 };
