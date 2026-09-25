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
  /// Avatar ilustrado prediseñado (COACH_AVATAR_IDS) — elegido al
  /// crear el coach; reemplaza a photoUrl en la app.
  avatar?: string | null;
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
  /// Inscritos de HOY (America/Mexico_City) — compat con vistas viejas.
  booked: number;
  /// Cupo por ocurrencia Y sede: 'YYYY-MM-DD' → { branchId → inscritos }.
  /// La llave '_' contiene un conteo legacy sin sede. Se poda al reservar
  /// y en close-day.
  bookedByDate?: Record<string, Record<string, number>>;
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
  /// Avatar prediseñado elegido en la app (MEMBER_AVATARS) —
  /// reemplaza a photoUrl.
  avatar?: string | null;
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
  /// Correo capturado por recepción — ahí llega el PIN de activación;
  /// es independiente del email de login (Google/Apple).
  contactEmail?: string | null;
  /// PIN de activación de un solo uso (vista staff) — null una vez
  /// reclamada la cuenta.
  claimPin?: string | null;
  /// Ya vinculó su cuenta con Google/Apple (auth_uid presente).
  linked?: boolean;
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
  /// Espacio vendido: 'carousel' = carrusel del Home (premium),
  /// 'list' = directorio de Aliados. Los ads viejos sin el campo
  /// se tratan como 'carousel' (comportamiento previo).
  placement: 'carousel' | 'list';
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

/// Tab de la app al tocar el push — 'auto' usa el mapping por kind
/// (SPONSOR → Aliados, BRAND → Descuentos).
export type PushTarget =
  | 'auto'
  | 'home'
  | 'explore'
  | 'allies'
  | 'promos'
  | 'profile';

export interface PushLog {
  id: string;
  title: string;
  body: string;
  audience: 'ALL' | 'BRANCH' | 'EXPIRED';
  branchId: string | null;
  kind: 'BRAND' | 'SPONSOR';
  target: PushTarget;
  /// DRAFT = guardada/pendiente · SENDING = despachándose · SENT = enviada ·
  /// FAILED = FCM rechazó.
  status: 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED';
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
