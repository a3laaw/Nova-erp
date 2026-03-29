
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
  passwordHash?: string;
  activatedAt?: Timestamp | any;
  // Claims
  isSuperAdmin?: boolean;
  currentCompanyId?: string;
  companyName?: string;
}

export interface Company extends BaseEntity {
  name: string;
  nameEn?: string;
  firebaseProjectId: string;
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  isActive: boolean;
  adminEmail: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  activityType?: 'general' | 'food_delivery' | 'construction' | 'consulting';
  status?: 'pending' | 'active' | 'suspended';
  // --- Licensing & Subscription ---
  subscriptionType: 'trial' | 'premium';
  trialEndDate?: Timestamp | any;
  maxUsersLimit: number;
  currentUsersCount?: number;
}

export interface CompanyRequest extends BaseEntity {
    companyName: string;
    activity: string;
    contactName: string;
    email: string;
    phone: string;
    adminPassword?: string;
    message?: string;
    status: 'pending' | 'approved' | 'rejected';
}

export interface GlobalUserIndex {
    email: string;
    companyId: string;
    role: string;
}

export interface AuthenticatedUser extends UserProfile {
    id: string;
}

export type ClientStatus = 'prospective' | 'registered' | 'active' | 'completed' | 'archived' | 'contracted' | 'reContracted';

export interface Client extends BaseEntity {
  fileId: string;
  fileNumber: number;
  fileYear: number;
  nameAr: string;
  nameEn?: string;
  civilId?: string;
  phone?: string;
  mobile: string;
  email?: string;
  address?: {
      governorate: string;
      area: string;
      block?: string;
      street?: string;
      houseNumber?: string;
  };
  status: ClientStatus;
  assignedEngineer?: string;
  assignedEngineerName?: string;
  notes?: string;
  isActive?: boolean;
  transactionCounter?: number;
}

export interface Appointment extends BaseEntity {
  clientId?: string;
  clientName: string;
  clientMobile?: string;
  engineerId: string;
  engineerName?: string;
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
  totalArea?: number;
  floorsCount?: number;
  basementType?: string;
  roofExtension?: string;
  workNature?: string;
  subsidyQuotas?: any[];
}

export interface Boq extends BaseEntity {
  boqNumber: string;
  name: string;
  clientId?: string | null;
  clientName?: string | null;
  transactionId?: string | null;
  projectId?: string | null;
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
  startDate?: Timestamp | any;
  endDate?: Timestamp | any;
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
  reconciliationInfo?: any;
}

export interface PaymentApplication extends BaseEntity {
  applicationNumber: string;
  projectId: string;
  date: Timestamp | any;
  clientId: string;
  clientName: string;
  projectName: string;
  items: any[];
  totalAmount: number;
  subsidizedMaterialsValue?: number;
  netDueAmount?: number;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled';
  journalEntryId?: string;
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
  workStartTime?: string | null;
  workEndTime?: string | null;
  annualLeaveUsed?: number;
  annualLeaveAccrued?: number;
  carriedLeaveDays?: number;
  terminationDate?: Timestamp | any;
  terminationReason?: string;
  iban?: string;
  bankName?: string;
  accountNumber?: string;
  dailyRate?: number;
  contractPercentage?: number;
  pieceRateMode?: 'salary_with_target' | 'per_piece';
  targetDescription?: number;
  pieceRate?: number;
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
  reorderLevel?: number;
  inventoryTracked?: boolean;
  expiryTracked?: boolean;
  warrantyYears?: number;
  isSubsidyEligible?: boolean;
}

export interface ItemCategory extends BaseEntity {
  name: string;
  parentCategoryId: string | null;
  order?: number;
  boqReferenceItemIds?: string[];
}

export interface Warehouse extends BaseEntity {
  name: string;
  location?: string;
  isDefault: boolean;
  projectId?: string | null;
  companyId?: string | null;
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
  projectId?: string | null;
  items: any[];
  totalAmount: number;
  status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled';
  rfqId?: string;
  isBypassed?: boolean;
  discountAmount?: number;
  deliveryFees?: number;
  paymentTerms?: string;
}

export interface RequestForQuotation extends BaseEntity {
  rfqNumber: string;
  date: Timestamp | any;
  vendorIds: string[];
  items: any[];
  status: 'draft' | 'sent' | 'closed' | 'cancelled';
  projectId?: string | null;
  awardedPoIds?: string[];
  awardedItems?: any;
  prospectiveVendors?: any[];
}

export interface SupplierQuotation extends BaseEntity {
  rfqId: string;
  vendorId: string;
  date: Timestamp | any;
  items: any[];
  deliveryTimeDays?: number;
  paymentTerms?: string;
  discountAmount?: number;
  deliveryFees?: number;
  quotationReference?: string;
}

export interface FieldVisit extends BaseEntity {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName: string;
  scheduledDate: Timestamp | any;
  plannedStageId: string;
  plannedStageName: string;
  status: 'planned' | 'confirmed' | 'cancelled';
  engineerId: string | null;
  engineerName: string;
  teamIds?: string[];
  teamNames?: string[];
  subcontractorId?: string | null;
  subcontractorName?: string | null;
  phaseEndDate?: any;
  confirmationData?: any;
  details?: string;
}

export interface WorkStage extends BaseEntity {
  name: string;
  order?: number;
  stageType: 'sequential' | 'parallel';
  trackingType: 'duration' | 'occurrence' | 'none';
  expectedDurationDays?: number | null;
  maxOccurrences?: number | null;
  allowedRoles?: string[];
}

export interface Department extends BaseEntity {
  name: string;
  order?: number;
  activityTypes?: string[];
}

export interface Job extends BaseEntity {
  name: string;
  order?: number;
}

export interface Governorate extends BaseEntity {
  name: string;
  order?: number;
}

export interface Area extends BaseEntity {
  name: string;
  order?: number;
}

export interface TransactionType extends BaseEntity {
  name: string;
  order?: number;
  activityType: string;
  departmentIds?: string[];
}

export interface Holiday extends BaseEntity {
  name: string;
  date: Timestamp | any;
}

export interface WorkTeam extends BaseEntity {
  name: string;
}

export interface CompanyActivityType extends BaseEntity {
  name: string;
}

export interface BoqReferenceItem extends BaseEntity {
  name: string;
  parentBoqReferenceItemId?: string | null;
}

export interface SubcontractorType extends BaseEntity {
  name: string;
}

export interface SubcontractorSpecialization extends BaseEntity {
  name: string;
}

export interface Notification extends BaseEntity {
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  link?: string;
}

export interface ContractTemplate extends BaseEntity {
  title: string;
  description?: string;
  templateType: 'Consulting' | 'Execution';
  workNature: 'labor_only' | 'with_materials';
  constructionTypeId?: string | null;
  transactionTypes?: string[];
  financials: {
      type: 'fixed' | 'percentage';
      totalAmount: number;
      milestones: { id: string; name: string; value: number; condition: string; }[];
  };
  scopeOfWork?: any[];
  termsAndConditions?: any[];
  openClauses?: any[];
}

export interface AttendanceRecord {
  date: Timestamp | any;
  employeeId: string;
  status: 'present' | 'absent' | 'late' | 'half_day';
  checkIn1: string | null;
  checkOut1: string | null;
  allPunches?: string[];
  anomalyDescription?: string;
  manualDeductionDays?: number;
  auditStatus: 'pending' | 'verified' | 'waived';
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

export interface PermissionRequest extends BaseEntity {
  employeeId: string;
  employeeName: string;
  type: 'late_arrival' | 'early_departure';
  date: Timestamp | any;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Payslip extends BaseEntity {
  employeeId: string;
  employeeName: string;
  year: number;
  month: number;
  type: 'Monthly' | 'Leave';
  earnings: {
    basicSalary: number;
    housingAllowance: number;
    transportAllowance: number;
    commission: number;
  };
  deductions: {
    absenceDeduction: number;
    lateDeduction: number;
    otherDeductions: number;
  };
  netSalary: number;
  status: 'draft' | 'processed' | 'paid';
}

export interface RecurringObligation extends BaseEntity {
  title: string;
  amount: number;
  type: 'rent' | 'installment' | 'vendor_debt' | 'daily_labor';
  frequency: 'weekly' | 'monthly';
  dueDate: Timestamp | any;
  debitAccountId: string;
  debitAccountName?: string;
  creditAccountId: string;
  creditAccountName?: string;
  status: 'active' | 'paused' | string;
}

export interface SubcontractorCertificate extends BaseEntity {
  certificateNumber: string;
  subcontractorId: string;
  subcontractorName: string;
  projectId: string;
  projectName: string;
  amount: number;
  date: Timestamp | any;
  status: 'draft' | 'approved' | 'cancelled';
  journalEntryId?: string;
}

export interface AuditLog extends BaseEntity {
  changeType: 'SalaryChange' | 'JobChange' | 'ResidencyUpdate' | 'DataUpdate';
  field: string;
  oldValue: any;
  newValue: any;
  notes?: string;
  effectiveDate: Timestamp | any;
  changedBy: string;
}

export interface CashReceipt extends BaseEntity {
    voucherNumber: string;
    voucherSequence: number;
    voucherYear: number;
    clientId?: string;
    clientNameAr: string;
    projectId?: string;
    projectNameAr?: string;
    amount: number;
    amountInWords: string;
    receiptDate: Timestamp | any;
    paymentMethod: string;
    description: string;
    reference?: string;
    journalEntryId?: string;
    commissionAmount?: number;
    isBypassed?: boolean;
}

export interface PaymentVoucher extends BaseEntity {
    voucherNumber: string;
    voucherSequence: number;
    voucherYear: number;
    payeeName: string;
    payeeType: string;
    amount: number;
    amountInWords: string;
    paymentDate: Timestamp | any;
    paymentMethod: string;
    description: string;
    reference?: string;
    debitAccountId: string;
    debitAccountName: string;
    creditAccountId: string;
    creditAccountName: string;
    status: 'draft' | 'paid' | 'cancelled';
    journalEntryId?: string;
    employeeId?: string;
    renewalExpiryDate?: any;
}

export interface MultilingualString {
    ar: string;
    en: string;
}

export interface ClientTransaction extends BaseEntity {
    transactionNumber: string;
    clientId: string;
    transactionType: string;
    description?: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
    assignedEngineerId?: string | null;
    transactionTypeId?: string;
    departmentId?: string;
    stages?: any[];
    contract?: any;
    boqId?: string;
    projectId?: string;
}

export interface TransactionAssignment extends BaseEntity {
    transactionId: string;
    clientId: string;
    departmentId: string;
    departmentName: string;
    engineerId: string;
    notes?: string;
    status: string;
}

export interface TechnicalSpecifications {
    totalArea: number;
    floorsCount: number;
    hasBasement: boolean;
    basementType: 'none' | 'full' | 'half' | 'vault';
    roofExtension: 'none' | 'quarter' | 'half';
    workNature: 'labor_only' | 'with_materials';
    bathroomsCount?: number;
    kitchensCount?: number;
    laundryRoomsCount?: number;
    electricalPointsCount?: number;
    planReferenceNumber?: string;
    sanitaryExtensionType?: 'ordinary' | 'suspended';
    toiletType?: 'ordinary' | 'suspended';
    showerType?: 'ordinary' | 'hidden';
    sanitaryMaterialsIncluded?: boolean;
    suspendedExtensionCount?: number;
    ordinaryExtensionCount?: number;
    suspendedToiletCount?: number;
    ordinaryToiletCount?: number;
    hiddenShowerCount?: number;
    ordinaryShowerCount?: number;
}

export interface GoodsReceiptNote extends BaseEntity {
    grnNumber: string;
    purchaseOrderId?: string;
    projectId?: string;
    warehouseId: string;
    date: Timestamp | any;
    itemsReceived: any[];
    totalValue: number;
    isSubsidy?: boolean;
    possession?: string;
    vendorName?: string;
    journalEntryId?: string;
    isBypassed?: boolean;
}

export interface InventoryItem extends BaseEntity {
    name: MultilingualString;
    quantity: number;
    unit: MultilingualString;
    lowStockThreshold: number;
    supplier: MultilingualString;
}

export interface ConstructionType extends BaseEntity {
    name: string;
}

export interface ConstructionWorkStage extends BaseEntity {
    name: string;
    order: number;
}

export interface LetterOfCredit extends BaseEntity {
    lcNumber: string;
    issuingBank: string;
    vendorId: string;
    vendorName: string;
    amount: number;
    currency: string;
    expiryDate: Timestamp | any;
    notes?: string;
    status: 'open' | 'closed' | 'expired';
}
