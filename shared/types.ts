export type MembershipStatus = 'ACTIVE' | 'EXPIRED';

export type MemberAdminStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  highlight: boolean;
  allBranches: boolean;
}

export interface PlanDetail {
  plan: MembershipPlan;
  payments: PaymentRecord[];
  stats: {
    members: number;
    payments: number;
    revenue: number;
  };
}

export interface MemberAdmin extends Member {
  /// Nombre del plan resuelto desde membershipPlanId — solo para display.
  membershipType: string;
  adminStatus: MemberAdminStatus;
  allBranchesAccess: boolean;
}

export interface MemberDetail {
  member: MemberAdmin;
  checkIns: CheckInRecord[];
  payments: PaymentRecord[];
  stats: {
    totalCheckIns: number;
    monthCheckIns: number;
  };
}

export interface Trainer {
  id: string;
  branchIds: string[];
  name: string;
  /// Partes del nombre capturadas al registrar.
  firstName?: string | null;
  middleName?: string | null;
  paternalLastName?: string | null;
  maternalLastName?: string | null;
  specialty: string;
  photoUrl: string;
  shift: 'MAÑANA' | 'TARDE' | 'NOCHE';
  isOnDuty: boolean;
}

export interface TrainerDetail {
  trainer: Trainer;
  classes: ClassSchedule[];
  stats: {
    classes: number;
    students: number;
  };
}

/// Horario y sala de una clase en una sede concreta — cada sede puede
/// configurar el suyo; sin override se usan los valores base de la clase.
export interface ClassBranchTime {
  startMinutes: number;
  endMinutes: number;
  room: string;
}

export interface ClassSchedule {
  id: string;
  branchIds: string[];
  name: string;
  /// Referencia canónica al coach (Trainer.id); '' = sin asignar.
  coachId: string;
  /// Nombre del coach — etiqueta denormalizada solo para display.
  coach: string;
  room: string;
  startMinutes: number;
  endMinutes: number;
  capacity: number;
  booked: number;
  /// Overrides por sede: branchId → horario/sala local.
  branchTimes?: Record<string, ClassBranchTime>;
}

export interface ClassDetail {
  gymClass: ClassSchedule;
  branches: Branch[];
  trainer: Trainer | null;
}

export interface PaymentRecord {
  id: string;
  memberId: string;
  memberName: string;
  memberNumber?: string | null;
  memberPhotoUrl?: string | null;
  branchId: string;
  /// Referencia canónica al plan cobrado (MembershipPlan.id).
  planId: string;
  /// Nombre del plan al momento del cobro — etiqueta histórica para display.
  plan: string;
  amount: number;
  method: string;
  transactionId: string;
  status: 'APPROVED' | 'DECLINED';
  createdAt: number;
}

export interface PaymentsReport {
  payments: PaymentRecord[];
  stats: {
    total: number;
    approved: number;
    declined: number;
    amountApproved: number;
    amountDeclined: number;
    byPlan: { planId: string; plan: string; count: number; amount: number }[];
  };
}

export interface CheckInsReport {
  checkIns: CheckInRecord[];
  stats: {
    total: number;
    granted: number;
    denied: number;
    uniqueMembers: number;
    byBranch: { branchId: string; count: number }[];
  };
}

export interface Coupon {
  id: string;
  title: string;
  description: string;
  badge: string;
  code: string;
  /// Ids de planes a los que aplica el cupón; 'ALL' = todos los socios.
  planIds: string[];
  branchId: string | null;
  createdAt: number;
}

export interface Branch {
  id: string;
  brandId: string;
  name: string;
  maxCapacity: number;
  currentCapacity: number;
  status: 'OPEN' | 'CLOSED';
  imageUrl: string;
  address: string;
  openMinutes: number;
  closeMinutes: number;
  lat: number | null;
  lng: number | null;
}

export interface BranchDetail {
  branch: Branch;
  classes: ClassSchedule[];
  trainers: Trainer[];
  availableTrainers: Trainer[];
  stats: {
    occupancy: number;
    classes: number;
    trainersOnDuty: number;
  };
}

export interface Member {
  id: string;
  branchId: string;
  name: string;
  photoUrl: string;
  membershipStatus: MembershipStatus;
  /// Referencia canónica al plan (MembershipPlan.id) — nunca el nombre.
  membershipPlanId: string;
  memberNumber: string;
  membershipUntil: number | null;
  /// Datos personales capturados al inscribir.
  firstName?: string | null;
  middleName?: string | null;
  paternalLastName?: string | null;
  maternalLastName?: string | null;
  sex?: 'M' | 'F' | 'O' | null;
  birthDate?: string | null;
  phone?: string | null;
  idNumber?: string | null;
}

export interface CheckInRecord {
  id: string;
  userId: string;
  branchId: string;
  memberName: string;
  membershipType: string;
  method: 'qr' | 'usb' | 'manual';
  granted: boolean;
  reason?: string;
  checkInAt: number;
  checkedOut: boolean;
  checkedOutAt?: number;
}

export interface TrafficPoint {
  hour: number;
  value: number;
}

export interface KpiTrend {
  membersToday: number;
  avgOccupancy: number;
  busiestBranch: number;
  peakHour: number;
}

export interface DashboardKpis {
  membersToday: number;
  avgOccupancy: number;
  busiestBranch: string;
  peakHour: string;
  trends: KpiTrend;
}

export interface DashboardResponse {
  kpis: DashboardKpis;
  branches: Branch[];
  traffic: TrafficPoint[];
  recentCheckIns: CheckInRecord[];
}

export type CheckInAlert = 'GREEN' | 'YELLOW' | 'RED';

export interface CheckInResult {
  granted: boolean;
  alert?: CheckInAlert;
  message?: string;
  reason?: string;
  /// member + membershipType: nombre del plan resuelto solo para display.
  member?: Member & { membershipType?: string };
  record?: CheckInRecord;
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
  branchId: string | null;
  createdAt: number;
}

export interface SponsorAdSocials {
  instagram: string;
  facebook: string;
  tiktok: string;
  website: string;
  whatsapp: string;
}

export interface SponsorAd {
  id: string;
  advertiser: string;
  title: string;
  subtitle: string;
  badge: string;
  brandColor: number | null;
  imageUrl: string;
  ctaLabel: string;
  branchId: string | null;
  status: 'ACTIVE' | 'PAUSED';
  endsAt: number;
  impressions: number;
  taps: number;
  createdAt: number;
  description: string;
  address: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  socials: SponsorAdSocials;
  photos: string[];
}

export interface PushLog {
  id: string;
  title: string;
  body: string;
  audience: 'ALL' | 'BRANCH' | 'EXPIRED';
  branchId: string | null;
  kind: 'BRAND' | 'SPONSOR';
  /// DRAFT = guardada, pendiente de envío; SENT = ya se lanzó.
  status: 'DRAFT' | 'SENT';
  /// Timestamp de envío programado — null = se lanza manualmente.
  scheduledAt: number | null;
  sent: number;
  createdAt: number;
}

export interface CmsResponse {
  promos: PromoBanner[];
  coupons: Coupon[];
  pushes: PushLog[];
  ads: SponsorAd[];
}

export interface AdsReportResponse {
  ads: SponsorAd[];
  stats: {
    impressions: number;
    taps: number;
    ctr: number;
    optedInMembers: number;
  };
}
