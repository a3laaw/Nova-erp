import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt?: Timestamp | any; 
  createdBy?: string;          
  updatedAt?: Timestamp | any;
  updatedBy?: string;           
}

// 🛡️ هيكل المواصفات العالمية للنظام (Metadata Schema)
export interface SystemConfig extends BaseEntity {
    localization: Record<string, string>;
    hrRules: {
        annualLeaveQuota: number;
        indemnityDivisor: number; // 26 or 30
        probationPeriodDays: number;
        experienceLetterTemplate: string;
    };
    financeConfig: {
        decimalPrecision: number;
        currencyCode: string;
        prefixes: {
            journalEntry: string;
            paymentVoucher: string;
            cashReceipt: string;
            purchaseOrder: string;
            rfq: string;
            grn: string;
        }
    };
    featureFlags: {
        enableWarehouse: boolean;
        enableProcurement: boolean;
        enableHR: boolean;
        budgetThresholdAlert: number; 
        residencyExpiryNoticeDays: number;
    };
}

// 🛡️ هيكل قاموس المصطلحات الشامل (Lexicon Metadata)
export interface LexiconEntry extends BaseEntity {
    key: string; // المعرف الفريد للنص في الكود
    namespace: 'actions' | 'fields' | 'alerts' | 'ui_prose';
    valueAr: string;
    valueEn: string;
    description?: string;
    module?: 'Accounting' | 'Construction' | 'HR' | 'Warehouse' | 'General';
}

// 🛡️ هيكل الشاشات الديناميكية (Dynamic UI Metadata)
export interface DynamicField extends BaseEntity {
    screenKey: string;
    module: 'Accounting' | 'Construction' | 'HR' | 'Warehouse';
    fieldNameAr: string;
    fieldNameEn: string;
    dataType: 'text' | 'number' | 'date' | 'attachment' | 'relation';
    lookupCollection?: string; // e.g., 'projects' or 'employees'
    isRequired: boolean;
    order: number;
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
  totalPoints?: number;         
  currentMood?: string;         
  currentFocus?: string;        
  activatedAt?: Timestamp | any;
  isSuperAdmin?: boolean;
  currentCompanyId?: string;
  companyName?: string;
}

export interface ClientTransaction extends BaseEntity {
    id?: string;
    transactionNumber: string;
    clientId: string;
    transactionType: string;
    subServiceId?: string | null;
    subServiceName?: string | null;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold' | 'cancelled';
    assignedEngineerId?: string | null;
    transactionTypeId?: string | null;
    stages?: any[];
    contract?: any;
}

export interface Company extends BaseEntity {
    name: string;
    adminEmail: string;
    adminUsername: string;
    status: 'active' | 'suspended' | 'trial';
    subscriptionType: 'trial' | 'premium';
    maxUsersLimit: number;
    trialEndDate?: Timestamp | any;
    firebaseConfig?: any;
}

export interface CompanyRequest extends BaseEntity {
    companyName: string;
    contactName: string;
    email: string;
    username: string;
    phone: string;
    activity: string;
    status: 'pending' | 'activated' | 'rejected';
}

export interface AuditLog extends BaseEntity {
    userId: string;
    userName: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    module: string;
    entityId: string;
    oldValue: any;
    newValue: any;
    ipAddress?: string;
}

export interface WorkTeam extends BaseEntity {
    name: string;
    members: string[];
}

export interface Employee extends BaseEntity {
    id?: string;
    fullName: string;
    employeeNumber: string;
    department: string;
    jobTitle: string;
    basicSalary: number;
    housingAllowance?: number;
    transportAllowance?: number;
    status: 'active' | 'on-leave' | 'terminated';
    hireDate: Timestamp | any;
    civilId: string;
    mobile: string;
    terminationDate?: Timestamp | any;
    terminationReason?: string;
}

export interface Account extends BaseEntity {
    code: string;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
    parentCode: string | null;
    level: number;
    isPayable: boolean;
}

export interface Appointment extends BaseEntity {
    id?: string;
    clientId?: string;
    clientName: string;
    clientMobile?: string;
    engineerId: string;
    appointmentDate: Timestamp | any;
    type: string;
    status: string;
    workStageUpdated?: boolean;
    visitCount?: number;
    color?: string;
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
