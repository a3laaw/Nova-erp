import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt?: Timestamp | any; 
  createdBy?: string;          
  updatedAt?: Timestamp | any;
}

export interface UserProfile extends BaseEntity {
  uid: string;
  username: string;
  email: string;
  role: 'Developer' | 'Admin' | 'HR' | 'Accountant' | 'Engineer' | 'Secretary' | 'User';
  isActive: boolean;
  employeeId?: string;
  fullName?: string;
  jobTitle?: string;
  avatarUrl?: string;
  bio?: string;
  totalPoints?: number;         // ✨ رصيد النقاط التراكمي
  currentMood?: string;         // ✨ الحالة المزاجية الحالية
  currentFocus?: string;        // ✨ عنوان التركيز اليومي
  activatedAt?: Timestamp | any;
  isSuperAdmin?: boolean;
  currentCompanyId?: string;
  companyName?: string;
}

export interface HubPost extends BaseEntity {
    userId: string;
    userName: string;
    userAvatar?: string;
    postType: 'system_achievement' | 'employee_idea' | 'kudos' | 'birthday' | 'anniversary';
    content: string;
    moodIcon?: string;
    votesCount: number;
    voters?: string[];
    pointsAwarded: number;
    metadata?: any; // للتخزين الإضافي مثل ID المشروع المرتبط
}

export interface PointsLedgerEntry extends BaseEntity {
    userId: string;
    source: 'kudos_received' | 'idea_posted' | 'vote_received' | 'task_completed' | 'system_reward';
    points: number;
    description: string;
    referenceId?: string; // ID المنشور أو المشروع المرتبط
    periodKey: string; // yyyy-ww (للحصر الأسبوعي) أو yyyy-mm (للشهري)
}

export interface LeaveRequest extends BaseEntity {
  employeeId: string;
  employeeName: string;
  leaveType: 'Annual' | 'Sick' | 'Emergency' | 'Unpaid';
  startDate: Timestamp | any;
  endDate: Timestamp | any;
  actualStartDate?: Timestamp | any;
  actualReturnDate?: Timestamp | any;
  days: number;
  workingDays: number;
  unpaidDays: number;
  status: 'pending' | 'approved' | 'rejected' | 'on-leave' | 'returned';
  approvedBy?: string;
  rejectedBy?: string;
  approvedAt?: Timestamp | any;
  rejectedAt?: Timestamp | any;
  notes?: string;
  adminComment?: string;
  rejectionReason?: string;
  passportReceived?: boolean;
}

export interface PermissionRequest extends BaseEntity {
  employeeId: string;
  employeeName: string;
  type: 'late_arrival' | 'early_departure';
  date: Timestamp | any;
  durationHours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminComment?: string;
  rejectionReason?: string;
  approvedBy?: string;
  approvedAt?: Timestamp | any;
}

export interface CustodyReconciliation extends BaseEntity {
  reconciliationNumber: string;
  employeeId: string;
  employeeName: string;
  date: Timestamp | any;
  totalAmount: number;
  items: any[];
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  journalEntryId?: string;
}

export interface Company extends BaseEntity {
  name: string;
  nameEn?: string;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  isActive: boolean;
  adminEmail: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  activityType?: string;
  subscriptionType: 'trial' | 'premium';
  trialEndDate?: Timestamp | any;
  subscriptionExpiryDate?: Timestamp | any; 
  maxUsersLimit: number;
}

export interface CompanyRequest extends BaseEntity {
    companyName: string;
    contactName: string;
    email: string; 
    username: string; 
    phone: string;
    activity?: string;
    status: 'pending' | 'activated' | 'rejected';
    activatedAt?: Timestamp | any;
    companyId?: string;
}

export interface Client extends BaseEntity {
  fileId: string;
  fileNumber: number;
  fileYear: number;
  nameAr: string;
  nameEn?: string;
  civilId?: string;
  mobile: string;
  address?: {
      governorate: string;
      area: string;
      block?: string;
      street?: string;
      houseNumber?: string;
  };
  status: 'prospective' | 'registered' | 'active' | 'completed' | 'archived' | 'contracted' | 'reContracted';
  assignedEngineer?: string;
  isActive?: boolean;
  transactionCounter?: number;
}

export interface Appointment extends BaseEntity {
  clientId?: string;
  clientName: string;
  clientMobile?: string;
  engineerId: string;
  appointmentDate: Timestamp | any;
  type: 'architectural' | 'room' | string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  meetingRoom?: string;
  color?: string;
  visitCount?: number;
  workStageUpdated?: boolean;
  transactionId?: string;
}

export interface ConstructionProject extends BaseEntity {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName?: string;
  projectCategory: 'Private (Subsidized)' | 'Private (Non-Subsidized)' | 'Commercial' | 'Government';
  status: string;
  progressPercentage: number;
  boqId?: string;
  linkedTransactionId?: string;
  mainEngineerId?: string;
  startDate: Timestamp | any;
  contractValue?: number;
  subcontractorId?: string | null;
  subcontractorName?: string | null;
}

export interface Boq extends BaseEntity {
  boqNumber: string;
  name: string;
  projectId?: string | null;
  clientName?: string | null;
  totalValue: number;
  itemCount: number;
  status: string;
}

export interface BoqItem extends BaseEntity {
  itemNumber: string;
  description: string;
  unit?: string;
  quantity: number;
  sellingUnitPrice: number;
  notes?: string;
  parentId?: string | null;
  level: number;
  isHeader: boolean;
  itemId?: string;
}

export interface JournalEntry extends BaseEntity {
  entryNumber: string;
  date: Timestamp | any;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'posted';
  lines: any[];
  clientId?: string;
  transactionId?: string;
  linkedReceiptId?: string;
  reconciliationStatus?: 'reconciled' | 'unreconciled';
}

export interface Employee extends BaseEntity {
  employeeNumber: string;
  fullName: string;
  civilId: string;
  mobile: string;
  department: string;
  jobTitle: string;
  hireDate: Timestamp | any;
  contractType: string;
  basicSalary: number;
  housingAllowance?: number;
  transportAllowance?: number;
  status: 'active' | 'on-leave' | 'terminated';
  residencyExpiry?: Timestamp | any;
  passportExpiry?: Timestamp | any;
  drivingLicenseExpiry?: Timestamp | any;
  healthCardExpiry?: Timestamp | any;
  annualLeaveUsed?: number;
  annualLeaveAccrued?: number;
  carriedLeaveDays?: number;
  terminationDate?: Timestamp | any;
  terminationReason?: string;
  workStartTime?: string | null;
  workEndTime?: string | null;
  lastLeaveResetDate?: Timestamp | any;
}

export interface Account extends BaseEntity {
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  level: number;
  parentCode: string | null;
  isPayable: boolean;
  statement: 'Balance Sheet' | 'Income Statement';
  balanceType: 'Debit' | 'Credit';
  employeeId?: string | null;
}

export interface Item extends BaseEntity {
  name: string;
  sku: string;
  categoryId: string;
  costPrice: number;
  sellingPrice: number;
  unitOfMeasure: string;
  inventoryTracked?: boolean;
  expiryTracked?: boolean;
  warrantyYears?: number;
  isSubsidyEligible?: boolean;
}

export interface Warehouse extends BaseEntity {
  name: string;
  location?: string;
  isDefault: boolean;
  projectId?: string | null;
}

export interface Vendor extends BaseEntity {
  name: string;
  phone: string;
  contactPerson?: string;
  email?: string;
  address?: string;
}

export interface PurchaseOrder extends BaseEntity {
  poNumber: string;
  orderDate: Timestamp | any;
  vendorId: string;
  vendorName: string;
  totalAmount: number;
  status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled';
  rfqId?: string;
  projectId?: string | null;
  items: any[];
  paymentTerms?: string;
  notes?: string;
  isBypassed?: boolean;
}

export interface FieldVisit extends BaseEntity {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  scheduledDate: Timestamp | any;
  plannedStageId?: string;
  plannedStageName: string;
  phaseEndDate?: Timestamp | any | null;
  status: 'planned' | 'confirmed' | 'cancelled';
  engineerId: string | null;
  engineerName: string;
  teamIds?: string[];
  teamNames?: string[];
  subcontractorId?: string | null;
  subcontractorName?: string | null;
  details?: string;
  confirmationData?: any;
  transactionId?: string;
  transactionType?: string;
}

export interface WorkStage extends BaseEntity {
  name: string;
  order?: number;
  stageType?: 'sequential' | 'parallel';
  trackingType?: 'none' | 'duration' | 'occurrence';
  expectedDurationDays?: number | null;
  maxOccurrences?: number | null;
  allowedRoles?: string[];
  enableModificationTracking?: boolean;
}

export interface Department extends BaseEntity {
  name: string;
  order?: number;
  activityTypes?: string[];
}

export interface Job extends BaseEntity {
  name: string;
  order?: number;
  parentId?: string;
}

export interface Governorate extends BaseEntity {
  name: string;
  order?: number;
}

export interface Area extends BaseEntity {
  name: string;
  order?: number;
  parentId?: string;
}

export interface TransactionType extends BaseEntity {
  name: string;
  order?: number;
  activityType?: string;
  departmentIds?: string[];
}

export interface Holiday extends BaseEntity {
  name: string;
  date: Timestamp | any;
}

export interface Notification extends BaseEntity {
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  link?: string;
}

export interface ClientTransaction extends BaseEntity {
    transactionNumber: string;
    clientId: string;
    transactionType: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
    assignedEngineerId?: string | null;
    transactionTypeId?: string | null;
    departmentId?: string | null;
    stages?: any[];
    contract?: any;
    boqId?: string;
    projectId?: string;
}

export interface AttendanceRecord {
  date: Timestamp | any;
  employeeId: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
  auditStatus: 'pending' | 'verified' | 'waived';
  manualDeductionDays?: number;
  anomalyDescription?: string;
  allPunches?: string[];
}

export interface MonthlyAttendance extends BaseEntity {
  employeeId: string;
  year: number;
  month: number;
  records: AttendanceRecord[];
  summary: {
    presentDays: number;
    absentDays: number;
    lateDays: number;
  };
}

export interface AuditLog extends BaseEntity {
    changeType: string;
    field: string;
    oldValue: any;
    newValue: any;
    effectiveDate: Timestamp | any;
    changedBy: string;
    notes?: string;
}

export interface WorkTeam extends BaseEntity {
    name: string;
}

export interface ConstructionType extends BaseEntity {
    name: string;
}

export interface ContractTemplate extends BaseEntity {
    title: string;
    description?: string;
    templateType: 'Consulting' | 'Execution';
    workNature?: 'labor_only' | 'with_materials';
    constructionTypeId?: string | null;
    transactionTypes?: string[];
    termsAndConditions?: any[];
    financials?: {
        type: 'fixed' | 'percentage';
        totalAmount?: number;
        milestones: any[];
    };
}

export interface Subcontractor extends BaseEntity {
    name: string;
    type: string;
    specialization?: string;
    contactPerson?: string;
    phone: string;
    mobile?: string;
    email?: string;
    address?: string;
    bankAccount?: {
        bankName: string;
        accountNumber: string;
        iban: string;
    };
    isActive: boolean;
    performanceRating?: number;
    blacklisted?: boolean;
    blacklistedReason?: string;
}

export interface SubcontractorCertificate extends BaseEntity {
    certificateNumber: string;
    subcontractorId: string;
    subcontractorName: string;
    projectId: string;
    projectName: string;
    date: Timestamp | any;
    amount: number;
    description: string;
    status: 'draft' | 'approved' | 'cancelled';
    journalEntryId?: string;
}

export interface RecurringObligation extends BaseEntity {
    title: string;
    type: 'rent' | 'installment' | 'vendor_debt' | 'daily_labor';
    amount: number;
    frequency: 'weekly' | 'monthly';
    dueDate: Timestamp | any;
    lastGeneratedDate?: Timestamp | any;
    debitAccountId: string;
    debitAccountName?: string;
    creditAccountId: string;
    creditAccountName?: string;
    status: 'active' | 'paused';
}

export interface UserProductivityItem extends BaseEntity {
  userId: string;
  entryType: 'task' | 'bookmark';
  title: string;
  actionType?: 'review' | 'decision' | 'design' | 'redesign' | 'meeting' | 'general';
  status?: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  startDate?: Timestamp | any;
  dueDate?: Timestamp | any;
  completedAt?: Timestamp | any;
  sourceModule: string;
  sourceId: string;
  sourceSubId?: string;
  sourceUrl?: string;
  viewCounter?: number;
  lastViewedAt?: Timestamp | any;
}
