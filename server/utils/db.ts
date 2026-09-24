import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

import type {
  Branch,
  CheckInRecord,
  ClassSchedule,
  Coupon,
  Member,
  MemberAdmin,
  MembershipPlan,
  PaymentRecord,
  PromoBanner,
  PushLog,
  SponsorAd,
  Trainer,
} from '#shared/types';

import { useAdmin } from './firebase-admin';

export function db() {
  return useAdmin().db;
}

export { FieldValue, Timestamp };

/// Firestore Timestamp/number → ms epoch (los tipos compartidos usan number).
export function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  if (typeof v === 'object' && 'toMillis' in (v as object)) {
    return (v as Timestamp).toMillis();
  }
  return null;
}

export function toBranch(s: DocumentSnapshot): Branch {
  const d = s.data() ?? {};
  return {
    id: s.id,
    brandId: 'capital_fitness',
    name: d.name ?? '',
    maxCapacity: d.max_capacity ?? 0,
    currentCapacity: d.current_capacity ?? 0,
    status: d.status ?? 'OPEN',
    imageUrl: d.image_url ?? '',
    address: d.address ?? '',
    openMinutes: d.open_minutes ?? 0,
    closeMinutes: d.close_minutes ?? 0,
    lat: d.lat ?? null,
    lng: d.lng ?? null,
  };
}

export function toPlan(s: DocumentSnapshot): MembershipPlan {
  const d = s.data() ?? {};
  return {
    id: s.id,
    name: d.name ?? '',
    price: d.price ?? 0,
    features: d.features ?? [],
    highlight: d.highlight ?? false,
    allBranches: d.all_branches ?? false,
  };
}

export function toMember(s: DocumentSnapshot): Member {
  const d = s.data() ?? {};
  return {
    id: s.id,
    branchId: d.branch_id ?? '',
    name: d.name ?? '',
    photoUrl: d.photo_url ?? '',
    membershipStatus: d.membership_status ?? 'ACTIVE',
    membershipPlanId: d.membership_plan_id ?? '',
    memberNumber: d.member_number ?? '',
    membershipUntil: toMs(d.membership_until),
    firstName: d.first_name ?? null,
    middleName: d.middle_name ?? null,
    paternalLastName: d.paternal_last_name ?? null,
    maternalLastName: d.maternal_last_name ?? null,
    sex: d.sex ?? null,
    birthDate: d.birth_date ?? null,
    phone: d.phone ?? null,
    idNumber: d.id_number ?? null,
  };
}

export function toTrainer(s: DocumentSnapshot): Trainer {
  const d = s.data() ?? {};
  return {
    id: s.id,
    branchIds: d.branch_ids ?? [],
    name: d.name ?? '',
    specialty: d.specialty ?? '',
    photoUrl: d.photo_url ?? '',
    shift: d.shift ?? 'MAÑANA',
    isOnDuty: d.is_on_duty ?? false,
  };
}

export function toClass(s: DocumentSnapshot): ClassSchedule {
  const d = s.data() ?? {};
  return {
    id: s.id,
    branchIds: d.branch_ids ?? [],
    name: d.name ?? '',
    coachId: d.coach_id ?? '',
    coach: d.coach ?? '',
    room: d.room ?? '',
    startMinutes: d.start_minutes ?? 0,
    endMinutes: d.end_minutes ?? 0,
    capacity: d.capacity ?? 0,
    booked: d.booked ?? 0,
    bookedByDate:
      d.booked_by_date == null
        ? undefined
        : Object.fromEntries(
            Object.entries(
              d.booked_by_date as Record<string, unknown>,
            ).map(([date, v]) => [
              date,
              /// Legacy: número plano → llave '_' (conteo sin sede).
              typeof v === 'number'
                ? { _: v }
                : (v as Record<string, number>),
            ]),
          ),
    branchTimes: d.branch_times ?? undefined,
  };
}

export function toCheckIn(s: DocumentSnapshot): CheckInRecord {
  const d = s.data() ?? {};
  return {
    id: s.id,
    userId: d.user_id ?? '',
    branchId: d.branch_id ?? '',
    memberName: d.member_name ?? '',
    membershipType: d.membership_type ?? '',
    method: d.method ?? 'qr',
    granted: d.granted ?? false,
    reason: d.reason ?? undefined,
    checkInAt: toMs(d.check_in_at) ?? 0,
    checkedOut: d.checked_out ?? false,
    checkedOutAt: toMs(d.checked_out_at) ?? undefined,
  };
}

export function toPayment(s: DocumentSnapshot): PaymentRecord {
  const d = s.data() ?? {};
  return {
    id: s.id,
    memberId: d.member_id ?? '',
    memberName: d.member_name ?? '',
    memberNumber: d.member_number ?? null,
    memberPhotoUrl: d.member_photo_url ?? null,
    branchId: d.branch_id ?? '',
    planId: d.plan_id ?? '',
    plan: d.plan ?? '',
    amount: d.amount ?? 0,
    method: d.method ?? '',
    transactionId: d.transaction_id ?? d.stripe_payment_intent_id ?? '',
    status: d.status ?? 'APPROVED',
    createdAt: toMs(d.created_at) ?? 0,
  };
}

/// /promotions con type 'banner' → PromoBanner
export function toPromo(s: DocumentSnapshot): PromoBanner {
  const d = s.data() ?? {};
  return {
    id: s.id,
    title: d.title ?? '',
    subtitle: d.subtitle ?? '',
    badge: d.badge ?? '',
    imageUrl: d.image_url ?? '',
    branchId: d.branch_id ?? null,
    createdAt: toMs(d.created_at) ?? 0,
  };
}

/// /promotions con type 'coupon' → Coupon
export function toCoupon(s: DocumentSnapshot): Coupon {
  const d = s.data() ?? {};
  return {
    id: s.id,
    title: d.title ?? '',
    description: d.description ?? '',
    badge: d.badge ?? '',
    code: d.code ?? '',
    planIds: d.plan_ids ?? [],
    branchId: d.branch_id ?? null,
    createdAt: toMs(d.created_at) ?? 0,
  };
}

export function toSponsorAd(s: DocumentSnapshot): SponsorAd {
  const d = s.data() ?? {};
  return {
    id: s.id,
    advertiser: d.advertiser ?? '',
    title: d.title ?? '',
    subtitle: d.subtitle ?? '',
    badge: d.badge ?? '',
    brandColor: d.brand_color ?? null,
    imageUrl: d.image_url ?? '',
    ctaLabel: d.cta_label ?? '',
    branchId: d.branch_id ?? null,
    placement: d.placement === 'list' ? 'list' : 'carousel',
    status: d.status ?? 'PAUSED',
    endsAt: toMs(d.ends_at) ?? 0,
    impressions: d.impressions ?? 0,
    taps: d.taps ?? 0,
    createdAt: toMs(d.created_at) ?? 0,
    description: d.description ?? '',
    address: d.address ?? '',
    lat: d.lat ?? null,
    lng: d.lng ?? null,
    phone: d.phone ?? '',
    socials: d.socials ?? {
      instagram: '',
      facebook: '',
      tiktok: '',
      website: '',
      whatsapp: '',
    },
    photos: d.photos ?? [],
  };
}

export function toPushLog(s: DocumentSnapshot): PushLog {
  const d = s.data() ?? {};
  return {
    id: s.id,
    title: d.title ?? '',
    body: d.body ?? '',
    audience: d.audience ?? 'ALL',
    branchId: d.branch_id ?? null,
    kind: d.kind ?? 'BRAND',
    target: d.target ?? 'auto',
    status: d.status ?? 'DRAFT',
    scheduledAt: toMs(d.scheduled_at),
    sent: d.sent ?? 0,
    createdAt: toMs(d.created_at) ?? 0,
  };
}

// ── Catálogos cacheados por request ──

export async function allPlans(): Promise<MembershipPlan[]> {
  const snap = await db().collection('plans').get();
  return snap.docs.map(toPlan);
}

export async function planNameFor(planId: string): Promise<string> {
  if (!planId) return '';
  const snap = await db().collection('plans').doc(planId).get();
  return (snap.data()?.name as string | undefined) ?? '';
}

const GRACE_DAYS = 3;

/// Member + campos admin derivados (nombre de plan resuelto, estatus).
/// EXPIRING = dentro de la gracia de 3 días o a ≤3 días de vencer.
export function toMemberAdmin(
  member: Member,
  plans: MembershipPlan[],
): MemberAdmin {
  const plan = plans.find((p) => p.id === member.membershipPlanId);
  const until = member.membershipUntil;
  const now = Date.now();
  let adminStatus: MemberAdmin['adminStatus'] = 'ACTIVE';
  if (member.membershipStatus !== 'ACTIVE') {
    adminStatus = 'EXPIRED';
  } else if (until !== null) {
    if (until < now) {
      adminStatus = until + GRACE_DAYS * 86_400_000 >= now ? 'EXPIRING' : 'EXPIRED';
    } else if (until - now <= GRACE_DAYS * 86_400_000) {
      adminStatus = 'EXPIRING';
    }
  }
  return {
    ...member,
    membershipType: plan?.name ?? 'Sin plan',
    adminStatus,
    allBranchesAccess: plan?.allBranches ?? false,
  };
}
