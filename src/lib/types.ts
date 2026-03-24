/**
 * @fileOverview القاموس البرمجي الشامل لنظام Nova ERP المطور.
 */

import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt?: Timestamp | any; 
  createdBy?: string;          
  updatedAt?: Timestamp | any;
}

export interface Company {
  id?: string;
  name: string;
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
  createdAt: Timestamp | any;
  createdBy: string;
  logoUrl?: string;
  subscriptionPlan?: 'basic' | 'pro' | 'enterprise';
}

export type ProjectCategory = 'Private (Subsidized)' | 'Private (Non-Subsidized)' | 'Commercial' | 'Government';
export type ClientStatus = 'prospective' | 'registered' | 'active' | 'completed' | 'archived' | 'new' | 'contracted' | 'cancelled' | 'reContracted';

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

export interface Appointment extends BaseEntity {
  clientId?: string;
  clientName: string;
  clientMobile?: string;
  engineerId: string;
  engineerName?: string;
  appointmentDate: Timestamp | any;
  date?: Timestamp | any; 
  time?: string;
  duration?: number;
  type: 'architectural' | 'room' | string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  meetingRoom?: string;
  roomId?: string; 
  color?: string;
  visitCount?: number;
  workStageUpdated?: boolean;
  transactionId?: string;
  department?: string;
}

export interface Boq extends BaseEntity {
  boqNumber: string;
  name: string;
  clientId?: string | null;
  clientName?: string | null;
  transactionId?: string | null;
  projectId?: string | null;
  items?: BoqItem[];
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
  unitPrice?: number;
  sellingUnitPrice: number;
  totalPrice?: number;
  plannedQuantity?: number;
  plannedUnitPrice?: number;
  notes?: string;
  parentId?: string | null;
  level: number;
  isHeader: boolean;
  startDate?: Timestamp | any;
  endDate?: Timestamp | any;
}

export interface PaymentApplication extends BaseEntity {
  applicationNumber: string;
  projectId: string;
  date: Timestamp | any;
  clientId: string;
  clientName: string;
  projectName: string;
  items: {
    boqItemId: string;
    itemName?: string;
    description?: string;
    unit?: string;
    unitPrice?: number;
    currentQuantity: number;
    totalAmount: number;
    previousQuantity?: number;
    previousAmount?: number;
  }[];
  totalAmount: number;
  subsidizedMaterialsValue?: number;
  netDueAmount?: number;
  status: 'draft' | 'submitted' | 'approved' | 'paid' | 'cancelled';
  journalEntryId?: string;
}

export interface UserProfile {
  id?: string;
  uid?: string;
  username: string;
  email: string;
  role: 'Developer' | 'Admin' | 'HR' | 'Accountant' | 'Engineer' | 'Secretary' | 'User';
  isActive: boolean;
  employeeId?: string;
  companyId: string;
  fullName?: string;
  jobTitle?: string;
  avatarUrl?: string;
  passwordHash?: string;
  activatedAt?: Timestamp | any;
  createdAt: Timestamp | any;
  createdBy: string;
}

export interface Department extends BaseEntity { name: string; order?: number; activityTypes?: string[]; }
export interface Job extends BaseEntity { name: string; department?: string; parentId?: string; order?: number; }
export interface ConstructionProject extends BaseEntity { projectId: string; projectName: string; clientId: string; status: string; totalArea: number; progressPercentage: number; boqId?: string; linkedTransactionId?: string; }
export interface FieldVisit extends BaseEntity { projectId: string; projectName: string; scheduledDate: any; plannedStageName: string; status: string; confirmationData?: any; }
export interface SubcontractorCertificate extends BaseEntity { certificateNumber: string; subcontractorName: string; amount: number; status: string; }
export interface JournalEntry extends BaseEntity { entryNumber: string; date: any; narration: string; totalDebit: number; totalCredit: number; status: string; lines: any[]; }
export interface CashReceipt extends BaseEntity { voucherNumber: string; clientNameAr: string; amount: number; paymentMethod: string; }
export interface PaymentVoucher extends BaseEntity { voucherNumber: string; payeeName: string; amount: number; status: string; }
export interface PurchaseOrder extends BaseEntity { poNumber: string; vendorName: string; totalAmount: number; status: string; }
export interface RequestForQuotation extends BaseEntity { rfqNumber: string; status: string; }
export interface SupplierQuotation extends BaseEntity { rfqId: string; vendorId: string; date: any; }
export interface Item extends BaseEntity { name: string; sku: string; categoryId: string; }
export interface Vendor extends BaseEntity { name: string; phone: string; }
export interface Account extends BaseEntity { code: string; name: string; type: string; balanceType: string; }
export interface WorkStage extends BaseEntity { name: string; order?: number; stageType: string; }
export interface Holiday extends BaseEntity { name: string; date: any; }
export interface Notification extends BaseEntity { userId: string; title: string; body: string; isRead: boolean; link?: string; }
export interface RecurringObligation extends BaseEntity { title: string; amount: number; status: string; dueDate: any; }
export interface WorkTeam extends BaseEntity { name: string; }
export interface CompanyActivityType extends BaseEntity { name: string; }
export interface BoqReferenceItem extends BaseEntity { name: string; }
export interface Governorate extends BaseEntity { name: string; }
export interface Area extends BaseEntity { name: string; }
export interface PermissionRequest extends BaseEntity { employeeId: string; employeeName: string; status: string; }
export interface AuditLog extends BaseEntity { changeType: string; field: string; notes: string; }
export interface ItemCategory extends BaseEntity { name: string; parentCategoryId: string | null; }
export interface Warehouse extends BaseEntity { name: string; }
export interface Subcontractor { id?: string; name: string; type: string; mobile: string; isActive: boolean; blacklisted: boolean; }
export interface TechnicalSpecifications { totalArea: number; floorsCount: number; }
