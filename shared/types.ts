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

/// Agregadores corporativos (gimnasio vende acceso por visita vía
/// convenio) — el visitante no es socio, el check-in lo valida la API
/// del proveedor.
export type PartnerProvider = 'wellhub' | 'totalpass';

export interface CheckInRecord {
  id: string;
  userId: string;
  branchId: string;
  memberName: string;
  membershipType: string;
  method: 'qr' | 'usb' | 'manual' | 'partner';
  granted: boolean;
  reason?: string;
  /// 'member' (default) o el agregador que validó el acceso.
  provider?: 'member' | PartnerProvider;
  /// Id del usuario dentro del agregador (no es users/{id} local).
  externalId?: string;
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
  /// Espacio vendido: 'carousel' = carrusel del Home + Promociones
  /// (premium), 'list' = solo directorio de Aliados, 'both' = ambas
  /// superficies (combo con precio propio). Los ads viejos sin el
  /// campo se tratan como 'carousel' (comportamiento previo).
  placement: 'carousel' | 'list' | 'both';
  /// PENDING = comprado por self-serve, esperando aprobación del gym —
  /// la app solo muestra ACTIVE, así que nunca se cuela a producción.
  status: 'PENDING' | 'ACTIVE' | 'PAUSED';
  /// 0 = sin vigencia (anuncio PENDING — arranca al aprobarse).
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
  /// Orden self-serve que originó el anuncio — null = creado por staff.
  orderId: string | null;
}

/// Superficies que compra cada placement — usado para detectar
/// "downgrade" en anuncios ligados a una orden pagada: bajar de rank
/// (p.ej. both → list) requiere razón obligatoria + registro en
/// /auditLogs. Subir de rank es un upgrade gratis del gym.
export const PLACEMENT_RANK: Record<SponsorAd['placement'], number> = {
  list: 1,
  carousel: 2,
  both: 3,
};

/// /auditLogs/{id} — evidencia de cambios excepcionales sobre anuncios
/// comprados por self-serve (downgrade de espacio, pausa, borrado).
/// Escritura solo server; lectura solo admin.
export interface AdAuditEntry {
  id: string;
  entity: 'sponsorAd';
  entityId: string;
  orderId: string | null;
  advertiser: string;
  action: 'PLACEMENT_DOWNGRADE' | 'PLACEMENT_UPGRADE' | 'PAUSE' | 'DELETE';
  actorUid: string;
  actorEmail: string;
  reason: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  /// Snapshot del anuncio (sin imágenes) — solo en DELETE.
  snapshot: Record<string, unknown> | null;
  createdAt: number;
}

/// Precio semanal por espacio publicitario — lo configura el admin en
/// /publicidad (doc /config/ads). `pricePerWeek` en pesos MXN y es la
/// tarifa por sede: elegir "todas las sedes" multiplica por N sedes.
export interface AdSlotConfig {
  enabled: boolean;
  pricePerWeek: number;
}

export interface AdSelfServeConfig {
  enabled: boolean;
  slots: {
    carousel: AdSlotConfig;
    list: AdSlotConfig;
    /// 'both' = el anuncio sale en el carrusel del Home/Promociones Y
    /// en el directorio de Aliados — el gym define el precio del combo
    /// (suele ser menor que la suma de ambos, como gancho de venta).
    both: AdSlotConfig;
  };
  /// Destinatarios del aviso "llegó una solicitud pagada" (además de
  /// los admins de staff, que siempre se notifican por su correo de
  /// login). `global` = siempre; `byBranch` = solo si la orden compró
  /// esa sede — compra de "todas las sedes" → avisa a TODOS los
  /// correos configurados.
  notify: {
    global: string[];
    byBranch: Record<string, string>;
  };
}

/// /adOrders/{orderId} — compra self-serve de un negocio externo (sin
/// login): el anunciante sube su creativo, paga por Stripe Checkout y la
/// orden queda PENDING_APPROVAL hasta que el admin aprueba (anuncio va
/// live) o rechaza (reembolso automático).
export interface AdOrder {
  id: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  /// Creativo — se copia tal cual al sponsorAd al confirmarse el pago.
  title: string;
  subtitle: string;
  badge: string;
  brandColor: number | null;
  imageUrl: string;
  ctaLabel: string;
  description: string;
  address: string;
  socials: SponsorAdSocials;
  photos: string[];
  branchId: string | null;
  placement: SponsorAd['placement'];
  weeks: number;
  amount: number;
  currency: string;
  status:
    | 'AWAITING_PAYMENT'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'EXPIRED';
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  sponsorAdId: string | null;
  rejectionReason: string | null;
  createdAt: number;
  paidAt: number | null;
  reviewedAt: number | null;
  reviewedBy: string | null;
}

/// Respuesta pública de /api/ads/self-serve — lo mínimo para pintar el
/// formulario de compra (nombre de marca, sedes y precios).
export interface AdSelfServeInfo {
  enabled: boolean;
  brandName: string;
  branches: { id: string; name: string }[];
  slots: AdSelfServeConfig['slots'];
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

// ─────────────────────────────────────────────────────────────────────
// Soporte / Chat
// ─────────────────────────────────────────────────────────────────────

export type ConversationStatus = 'open' | 'resolved';

export interface Conversation {
  id: string;
  memberId: string;
  memberName: string;
  branchId: string;
  status: ConversationStatus;
  createdAt: number;
  lastMessageAt: number;
  lastMessagePreview: string;
  /// Mensajes sin leer por el socio
  unreadMember: number;
  /// Mensajes sin leer por staff
  unreadStaff: number;
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  sender: 'member' | 'staff';
  senderName: string;
  text: string;
  createdAt: number;
  read: boolean;
}

// ─────────────────────────────────────────────────────────────────────
// Lealtad — recompensas y canjes
// ─────────────────────────────────────────────────────────────────────

export interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  /// Id de icono — la app lo mapea a Material, el B2B a Lucide.
  icon: string;
  active: boolean;
  createdAt: number;
}

export interface RewardRedemption {
  id: string;
  memberId: string;
  memberName: string;
  branchId: string;
  rewardId: string;
  rewardName: string;
  pointsSpent: number;
  code: string;
  status: 'active' | 'used' | 'expired';
  createdAt: number;
  expiresAt: number;
  usedAt: number | null;
}
