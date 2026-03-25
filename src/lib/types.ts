
/**
 * @fileOverview القاموس البرمجي الشامل والسيادي لنظام Nova ERP.
 * تم ترميم كافة الأنواع المفقودة للقضاء على أخطاء TypeScript المذكورة في التحليل.
 */

import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt?: Timestamp | any; 
  createdBy?: string;          
  updatedAt?: Timestamp | any;
}

// === 1. إدارة الشركات والمنشآت (Tenants) ===
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
  };
  isActive: boolean;
  adminEmail: string;
  phone?: string;
  address?: string;
  activityType?: string;
  status: 'pending' | 'active' | 'suspended';
}

export interface GlobalUserIndex {
    email: string;
    companyId: string;
    role: string;
}

// === 2. إدارة العملاء والمعاملات ===
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
  source?: string;
  isActive?: boolean;
  transactionCounter?: number;
}

// === 3. إدارة المواعيد والتقويم ===
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
  roomId?: string; 
  color?: string;
  visitCount?: number;
  workStageUpdated?: boolean;
  transactionId?: string;
}

// === 4. إدارة المشاريع والإنشاءات (WBS/BOQ) ===
export interface ConstructionProject extends BaseEntity, TechnicalSpecifications {
  projectId: string;
  projectName: string;
  clientId: string;
  clientName?: string;
  projectCategory: 'Private (Subsidized)' | 'Private (Non-Subsidized)' | 'Commercial' | 'Government';
  status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى' | string;
  progressPercentage: number;
  boqId?: string;
  linkedTransactionId?: string;
  mainEngineerId?: string;
  startDate: Timestamp | any;
  contractValue?: number;
  subcontractorId?: string | null;
  subcontractorName?: string | null;
  subsidyQuotas?: SubsidyQuota[];
}

export interface Project extends BaseEntity {
  name: string;
  clientId: string;
  clientName: string;
  status: string;
  startDate?: any;
  endDate?: any;
  disciplines?: EngineeringDiscipline[];
  timeline?: any[];
  files?: any[];
  contracts?: any[];
  reports?: any[];
}

export interface EngineeringDiscipline {
  id: string;
  name: string;
  stages: {
    id: string;
    name: string;
    status: 'Completed' | 'In Progress' | 'Pending';
  }[];
}

export interface TechnicalSpecifications {
  totalArea: number;
  floorsCount: number;
  basementType: 'none' | 'full' | 'half' | 'vault';
  hasBasement?: boolean;
  roofExtension: 'none' | 'quarter' | 'half';
  workNature: 'labor_only' | 'with_materials';
  bathroomsCount?: number;
  kitchensCount?: number;
  laundryRoomsCount?: number;
  sanitaryMaterialsIncluded?: boolean;
  sanitaryExtensionType?: 'ordinary' | 'suspended';
  toiletType?: 'ordinary' | 'suspended';
  showerType?: 'ordinary' | 'hidden';
  electricalPointsCount?: number;
  planReferenceNumber?: string;
}

export interface SubsidyQuota {
  itemId: string;
  itemName: string;
  allocatedQuantity: number;
  receivedQuantity: number;
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
  status: 'تقديري' | 'تعاقدي' | 'منفذ' | string;
}

export interface BoqItem {
  id?: string;
  itemId?: string;
  itemNumber: string;
  description: string;
  unit?: string;
  quantity: number;
  sellingUnitPrice: number;
  notes?: string;
  parentId?: string | null;
  level: number;
  isHeader: boolean;
  startDate?: Timestamp | any;
  endDate?: Timestamp | any;
}

// === 5. المحاسبة والمالية ===
export interface PaymentApplication extends BaseEntity {
  applicationNumber: string;
  projectId: string;
  date: Timestamp | any;
  clientId: string;
  clientName: string;
  projectName: string;
  items: {
    boqItemId: string;
    description: string;
    unit: string;
    unitPrice: number;
    currentQuantity: number;
    totalAmount: number;
    previousQuantity?: number;
  }[];
  totalAmount: number;
  subsidizedMaterialsValue?: number;
  netDueAmount?: number;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled';
  journalEntryId?: string;
}

export interface JournalEntry extends BaseEntity {
  entryNumber: string;
  date: Timestamp | any;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  status: 'draft' | 'posted';
  lines: JournalLine[];
  reference?: string;
  clientId?: string;
  transactionId?: string;
  linkedReceiptId?: string;
}

export interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  notes?: string;
  auto_profit_center?: string;
  auto_resource_id?: string;
  auto_dept_id?: string;
  clientId?: string;
  transactionId?: string;
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

// === 6. الموارد البشرية (HR) ===
export interface UserProfile {
  id?: string;
  uid?: string;
  username: string;
  email: string;
  role: 'Admin' | 'HR' | 'Accountant' | 'Engineer' | 'Secretary' | 'User';
  isActive: boolean;
  employeeId?: string;
  companyId?: string;
  fullName?: string;
  jobTitle?: string;
  avatarUrl?: string;
  passwordHash?: string;
  activatedAt?: Timestamp | any;
  createdAt?: Timestamp | any;
  createdBy?: string;
}

export interface Employee extends BaseEntity {
  employeeNumber: string;
  fullName: string;
  nameEn?: string;
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
}

export interface AuditLog extends BaseEntity {
  changeType: 'SalaryChange' | 'JobChange' | 'DataUpdate' | 'ResidencyUpdate';
  field: string;
  oldValue: any;
  newValue: any;
  effectiveDate: Timestamp | any;
  changedBy: string;
  notes?: string;
}

export interface CustodyReconciliation extends BaseEntity {
  reconciliationNumber: string;
  employeeId: string;
  employeeName: string;
  date: Timestamp | any;
  items: CustodyItem[];
  totalAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  journalEntryId?: string;
}

export interface CustodyItem {
  description: string;
  amount: number;
  projectId?: string | null;
  projectName?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  category?: string;
  categoryName?: string;
  attachmentUrls?: string[];
}

// === 7. البيانات المرجعية ===
export interface Department extends BaseEntity { name: string; order?: number; activityTypes?: string[]; }
export interface Job extends BaseEntity { name: string; parentId?: string; order?: number; }
export interface Governorate extends BaseEntity { name: string; order?: number; }
export interface Area extends BaseEntity { name: string; order?: number; parentId?: string; }
export interface TransactionType extends BaseEntity { name: string; order?: number; activityType: string; departmentIds?: string[]; }
export interface WorkStage extends BaseEntity { name: string; order?: number; stageType: 'sequential' | 'parallel'; trackingType: 'duration' | 'occurrence' | 'none'; expectedDurationDays?: number | null; maxOccurrences?: number | null; allowedRoles?: string[]; enableModificationTracking?: boolean; }
export interface Holiday extends BaseEntity { name: string; date: Timestamp | any; }
export interface WorkTeam extends BaseEntity { name: string; }
export interface CompanyActivityType extends BaseEntity { name: string; }
export interface ItemCategory extends BaseEntity { name: string; parentCategoryId: string | null; boqReferenceItemIds?: string[]; order?: number; activityTypeIds?: string[]; }
export interface Item extends BaseEntity { name: string; sku: string; categoryId: string; itemType: 'product' | 'service'; inventoryTracked: boolean; unitOfMeasure: string; costPrice: number; sellingPrice: number; reorderLevel?: number; expiryTracked?: boolean; warrantyYears?: number; isSubsidyEligible?: boolean; description?: string; }
export interface Warehouse extends BaseEntity { name: string; location?: string; isDefault: boolean; projectId?: string | null; }
export interface Vendor extends BaseEntity { name: string; phone: string; contactPerson?: string; email?: string; address?: string; }
export interface Subcontractor { id?: string; name: string; type: string; mobile: string; isActive: boolean; blacklisted: boolean; contactPerson?: string; phone?: string; email?: string; address?: string; performanceRating?: number; bankAccount?: { bankName?: string; accountNumber?: string; iban?: string; }; blacklistedReason?: string; }
export interface SubcontractorCertificate extends BaseEntity { certificateNumber: string; subcontractorId: string; subcontractorName: string; projectId: string; projectName: string; amount: number; date: Timestamp | any; status: 'draft' | 'approved' | 'cancelled'; description?: string; journalEntryId?: string; }
export interface SubcontractorType extends BaseEntity { name: string; }
export interface SubcontractorSpecialization extends BaseEntity { name: string; parentId: string; }

// === 8. المعاملات والعمليات الفنية ===
export interface ClientTransaction extends BaseEntity {
  transactionNumber: string;
  clientId: string;
  transactionType: string;
  transactionTypeId?: string;
  description?: string;
  assignedEngineerId?: string | null;
  status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
  stages: TransactionStage[];
  projectId?: string;
  boqId?: string;
  contract?: ContractData;
}

export interface TransactionStage {
  stageId: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'skipped' | 'awaiting-review';
  startDate?: Timestamp | any;
  endDate?: Timestamp | any;
  expectedEndDate?: Timestamp | any;
  allowedRoles?: string[];
}

export interface ContractData {
  totalAmount: number;
  financialsType: 'fixed' | 'percentage';
  clauses: ContractClause[];
  specs?: TechnicalSpecifications;
  signatureInfo?: { clientSignature: string; signedAt: any; signedByIP: string; };
  scopeOfWork?: any[];
  termsAndConditions?: any[];
  openClauses?: any[];
}

export interface ContractClause {
  id: string;
  name: string;
  amount: number;
  percentage?: number;
  condition: string;
  status: 'غير مستحقة' | 'مستحقة' | 'مدفوعة';
}

export interface PurchaseOrder extends BaseEntity {
  poNumber: string;
  orderDate: Timestamp | any;
  vendorId: string;
  vendorName: string;
  projectId?: string | null;
  items: { internalItemId: string; itemName: string; quantity: number; unitPrice: number; total: number; }[];
  totalAmount: number;
  status: 'draft' | 'approved' | 'received' | 'partially_received' | 'cancelled';
  rfqId?: string;
  paymentTerms?: string;
  notes?: string;
  isBypassed?: boolean;
}

export interface RequestForQuotation extends BaseEntity {
  rfqNumber: string;
  date: Timestamp | any;
  vendorIds: string[];
  prospectiveVendors?: { id: string; name: string }[];
  items: { id: string; internalItemId: string; itemName: string; quantity: number; }[];
  status: 'draft' | 'sent' | 'closed' | 'cancelled';
  projectId?: string | null;
  awardedPoIds?: string[];
  awardedItems?: Record<string, string>;
}

export interface SupplierQuotation extends BaseEntity {
  rfqId: string;
  vendorId: string;
  date: Timestamp | any;
  items: { rfqItemId: string; unitPrice: number; }[];
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
  details?: string;
  confirmationData?: {
      confirmedAt: any;
      notes: string;
      location?: { latitude: number; longitude: number; accuracy: number };
      progressAchieved: number;
  };
}

export interface InventoryAdjustment extends BaseEntity {
  adjustmentNumber: string;
  date: Timestamp | any;
  type: 'damage' | 'theft' | 'opening_balance' | 'transfer' | 'material_issue' | 'purchase_return' | 'sales_return' | 'other';
  issueType?: 'project_site' | 'direct_sale';
  notes: string;
  items: { itemId: string; itemName: string; quantity: number; unitCost: number; totalCost: number; boqItemId?: string | null; warrantyEndDate?: any; }[];
  warehouseId?: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  projectId?: string;
  clientId?: string;
  clientName?: string;
  journalEntryId?: string;
  isBypassed?: boolean;
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
  lastGeneratedDate?: Timestamp | any;
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

export interface TransactionAssignment extends BaseEntity {
  transactionId: string;
  departmentId: string;
  departmentName: string;
  engineerId: string;
  engineerName?: string;
  notes?: string;
  status?: string;
}

export interface ConstructionType extends BaseEntity {
    name: string;
}

export interface SubcontractorSpecialization extends BaseEntity {
    name: string;
    parentId: string;
}

export interface WorkTeam extends BaseEntity {
    name: string;
}

export interface BoqReferenceItem extends BaseEntity {
    name: string;
    parentBoqReferenceItemId?: string | null;
}
