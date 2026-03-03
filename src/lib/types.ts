
/**
 * @fileOverview القاموس البرمجي الشامل لنظام Nova ERP المطور.
 */

import { Timestamp } from 'firebase/firestore';

export interface BaseEntity {
  id?: string;
  companyId?: string;           
  createdAt: Timestamp | any;
  createdBy: string;
  updatedAt?: Timestamp | any;
}

export type ProjectCategory = 'Private (Subsidized)' | 'Private (Non-Subsidized)' | 'Commercial' | 'Government';
export type AreaRange = '100-199' | '200-299' | '300-400';

export interface SubsidyQuota {
    itemId: string;
    itemName: string;
    allocatedAmount: number; 
    allocatedQuantity: number; 
    receivedQuantity: number;
    consumedQuantity: number;
    unitPrice: number; 
}

export interface TechnicalSpecifications {
    totalArea: number;
    basementType: 'none' | 'full' | 'half' | 'vault';
    floorsCount: number;
    roofExtension: 'none' | 'quarter' | 'half';
    workNature?: 'labor_only' | 'with_materials'; 
    
    // مواصفات الصحي التفصيلية (تم التحديث لدعم الأعداد)
    bathroomsCount?: number;
    kitchensCount?: number;
    laundryRoomsCount?: number;
    sanitaryMaterialsIncluded?: boolean;
    
    // أعداد أنواع التمديد
    suspendedExtensionCount?: number;
    ordinaryExtensionCount?: number;
    
    // أعداد أنواع المراحيض
    suspendedToiletCount?: number;
    ordinaryToiletCount?: number;
    
    // أعداد أنواع الشاور
    hiddenShowerCount?: number;
    ordinaryShowerCount?: number;

    // مواصفات الكهرباء
    electricalPointsCount?: number;
    planReferenceNumber?: string;
}

export interface ConstructionProject extends BaseEntity, TechnicalSpecifications {
    projectId: string;          
    projectName: string;
    clientId: string;
    clientName?: string;
    projectCategory: ProjectCategory;
    projectType?: string;
    
    siteAddress: {
        governorate: string;
        area: string;
        block?: string;
        street?: string;
        houseNumber?: string;
    };

    subsidyAreaRange?: AreaRange;
    subsidyRequestId?: string;
    subsidyExpiryDate?: Timestamp | any;
    
    startDate: Timestamp | any;
    status: 'مخطط' | 'قيد التنفيذ' | 'مكتمل' | 'معلق' | 'ملغى';
    mainEngineerId: string;
    mainEngineerName?: string;
    progressPercentage: number;
    boqId?: string;             
    linkedTransactionId?: string; 
    subsidyQuotas?: SubsidyQuota[];
}

export interface Quotation extends BaseEntity, TechnicalSpecifications {
    quotationNumber: string;
    quotationSequence: number;
    quotationYear: number;
    clientId: string;
    clientName: string;
    subject: string;
    date: Timestamp | any;
    validUntil: Timestamp | any;
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
    items: {
        id: string;
        description: string;
        quantity: number;
        unitPrice: number;
        total: number;
        condition?: string;
        percentage?: number;
    }[];
    totalAmount: number;
    financialsType: 'fixed' | 'percentage';
    notes?: string;
    templateId?: string;
    templateDescription?: string;
    scopeOfWork?: any[];
    termsAndConditions?: any[];
    openClauses?: any[];
    projectId?: string | null;
    transactionId?: string | null;
}

export interface ContractClause {
    id: string;
    name: string;
    amount: number;
    status: 'غير مستحقة' | 'مستحقة' | 'مدفوعة';
    condition?: string; 
    percentage?: number;
}

export interface ClientTransaction extends BaseEntity {
    transactionNumber: string;
    clientId: string;
    transactionType: string;
    description?: string;
    status: 'new' | 'in-progress' | 'completed' | 'submitted' | 'on-hold';
    assignedEngineerId?: string | null;
    transactionTypeId?: string;
    stages?: any[];
    contract?: {
        clauses: ContractClause[];
        totalAmount: number;
        financialsType: 'fixed' | 'percentage';
        scopeOfWork?: any[];
        termsAndConditions?: any[];
        openClauses?: any[];
        specs?: TechnicalSpecifications; 
    };
    boqId?: string;
}

export interface Employee extends BaseEntity {
    employeeNumber: string;     
    fullName: string;           
    civilId: string;
    mobile: string;
    status: 'active' | 'terminated' | 'on-leave';
    department?: string;
    jobTitle?: string;
    basicSalary: number;
    housingAllowance?: number;
    transportAllowance?: number;
    contractPercentage?: number;
    profilePicture?: string;
    hireDate: any;
    residencyExpiry?: any;
    dob?: any;
    terminationDate?: any;
    terminationReason?: string;
}

export interface Warehouse extends BaseEntity { name: string; location?: string; isDefault?: boolean; }
export interface Item extends BaseEntity { name: string; sku: string; categoryId: string; unitOfMeasure: string; costPrice?: number; sellingPrice?: number; inventoryTracked?: boolean; isSubsidyEligible?: boolean; warrantyYears?: number; }
export interface Vendor extends BaseEntity { name: string; phone: string; contactPerson?: string; }
export interface Account extends BaseEntity { code: string; name: string; type: 'asset' | 'liability' | 'equity' | 'income' | 'expense'; level: number; parentCode: string | null; isPayable: boolean; statement: 'Balance Sheet' | 'Income Statement'; balanceType: 'Debit' | 'Credit'; }
export interface Department extends BaseEntity { name: string; order?: number; }
export interface Governorate extends BaseEntity { name: string; order?: number; }
export interface Area extends BaseEntity { name: string; order?: number; }
export interface TransactionType extends BaseEntity { name: string; order?: number; activityType?: string; departmentIds?: string[]; }
export interface Company extends BaseEntity { name: string; crNumber?: string; activityType?: string; }
