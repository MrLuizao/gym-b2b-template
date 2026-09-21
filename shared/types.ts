export type MembershipStatus = 'ACTIVE' | 'EXPIRED';

export type MembershipLevel = 'CLASSIC' | 'PLUS' | 'BLACK';

export type MemberAdminStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED';

export interface MembershipPlan {
  id: string;
  name: string;
  level: MembershipLevel;
  priceBs: number;
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
    revenueBs: number;
  };
}

export interface MemberAdmin extends Member {
  membershipLevel: MembershipLevel;
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

export interface ClassSchedule {
  id: string;
  branchIds: string[];
  name: string;
  coach: string;
  room: string;
  startMinutes: number;
  endMinutes: number;
  capacity: number;
  booked: number;
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
  plan: string;
  amountBs: number;
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
    amountApprovedBs: number;
    amountDeclinedBs: number;
    byPlan: { plan: string; count: number; amountBs: number }[];
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
  levels: (MembershipLevel | 'ALL')[];
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
  membershipType: string;
  memberNumber: string;
  membershipUntil: number | null;
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
  member?: Member;
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

export interface PushLog {
  id: string;
  title: string;
  body: string;
  audience: 'ALL' | 'BRANCH' | 'EXPIRED';
  branchId: string | null;
  sent: number;
  createdAt: number;
}

export interface CmsResponse {
  promos: PromoBanner[];
  coupons: Coupon[];
  pushes: PushLog[];
}
