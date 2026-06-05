
// ══════════════════════════════════════════════════════════
// 1. التعريفات الصارمة والمصفوفات (Enums & Types)
// ══════════════════════════════════════════════════════════

// تحديد المسارات الثلاثة للعقود بدقة هندسية
export enum ContractPath {
    SERVICES_ONLY = 'SERVICES_ONLY',   // المسار الأول: خدمات/تصميم فقط
    EXECUTION_ONLY = 'EXECUTION_ONLY', // المسار الثاني: تنفيذ/مقاولات فقط
    HYBRID_PATH = 'HYBRID_PATH'        // المسار الثالث: خدمات مع تنفيذ معاً
}

// تحديد النطاقات التحليلية للمحرك الخفي
export enum DomainType {
    INTELLECTUAL = 'INTELLECTUAL',   // فكري (استشارات، تراخيص، مخططات)
    FIELD_MATERIAL = 'FIELD_MATERIAL', // ميداني (مواد، عمالة، تنفيذ موقع)
    MAINTENANCE = 'MAINTENANCE'      // صيانة
}

// ══════════════════════════════════════════════════════════
// 2. واجهات الأنماط الصارمة لحماية الواجهات (Interfaces)
// ══════════════════════════════════════════════════════════

export interface Department {
    name: string;
    order: number;
}

export interface Job {
    name: string;
}

export interface ServiceType {
    name: string;
    order: number;
    domain: DomainType;
    defaultDept: string;
}

export interface TransactionType {
    name: string;
    order: number;
    contractPath: ContractPath;
    targetDepartment?: string; // اختياري لأنه يتغير ديناميكياً في المسار الهجين
    allowedServiceTypes: string[];
}

export interface Governorate {
    name: string;
    order: number;
}

export interface Area {
    name: string;
}

// ══════════════════════════════════════════════════════════
// 3. البيانات الافتراضية للنظام (Default Boot Data)
// ══════════════════════════════════════════════════════════

export const defaultDepartments: Department[] = [
    { name: 'الشؤون الإدارية', order: 0 },
    { name: 'الشؤون المالية', order: 1 },
    { name: 'الهندسة والتصميم الفكري', order: 2 },
    { name: 'إدارة المشاريع والتنفيذ', order: 3 },
    { name: 'العلاقات العامة والتسويق', order: 4 },
];

export const defaultJobs: Record<string, Job[]> = {
    'الشؤون الإدارية': [{ name: 'مدير إداري' }, { name: 'مسؤول موارد بشرية' }, { name: 'سكرتير تنفيذي' }],
    'الشؤون المالية': [{ name: 'مدير مالي' }, { name: 'محاسب' }, { name: 'أمين صندوق' }],
    'الهندسة والتصميم الفكري': [
        { name: 'مهندس تصميم إنشائي' },
        { name: 'مهندس تصميم معماري' },
        { name: 'مهندس تصميم صحي وكهرباء' }
    ],
    'إدارة المشاريع والتنفيذ': [
        { name: 'مهندس موقع مدني' },
        { name: 'مهندس موقع صحي' },
        { name: 'مهندس موقع كهرباء' },
        { name: 'مراقب ميداني' }
    ],
    'العلاقات العامة والتسويق': [{ name: 'مسؤول علاقات عامة' }, { name: 'أخصائي تسويق' }],
};

// محرك مسارات العقود الذكي المعتمد على الـ Enums الصارمة
export const defaultTransactionTypes: TransactionType[] = [
    {
        name: 'عقد خدمات فقط (استشاري وتصميم)',
        order: 0,
        contractPath: ContractPath.SERVICES_ONLY,
        targetDepartment: 'الهندسة والتصميم الفكري',
        allowedServiceTypes: ['خدمات استشارية']
    },
    {
        name: 'عقد تنفيذ فقط (مقاولات وبناء)',
        order: 1,
        contractPath: ContractPath.EXECUTION_ONLY,
        targetDepartment: 'إدارة المشاريع والتنفيذ',
        allowedServiceTypes: ['خدمات تنفيذية']
    },
    {
        name: 'عقد هجين (خدمات مع تنفيذ)',
        order: 2,
        contractPath: ContractPath.HYBRID_PATH,
        allowedServiceTypes: ['خدمات استشارية', 'خدمات تنفيذية']
    }
];

// أنواع الخدمات وعلاقتها الصارمة بالنطاق التحليلي في الخلفية
export const defaultServiceTypes: ServiceType[] = [
    {
        name: 'خدمات استشارية',
        order: 0,
        domain: DomainType.INTELLECTUAL,
        defaultDept: 'الهندسة والتصميم الفكري'
    },
    {
        name: 'خدمات تنفيذية',
        order: 1,
        domain: DomainType.FIELD_MATERIAL,
        defaultDept: 'إدارة المشاريع والتنفيذ'
    },
    {
        name: 'خدمات صيانة',
        order: 2,
        domain: DomainType.MAINTENANCE,
        defaultDept: 'إدارة المشاريع والتنفيذ'
    },
];

// المحافظات والمناطق الكويتية مجهزة بأنماط قوية تمنع التداخل
export const defaultGovernorates: Governorate[] = [
    { name: 'العاصمة', order: 0 }, { name: 'حولي', order: 1 }, { name: 'الأحمدي', order: 2 },
    { name: 'الجهراء', order: 3 }, { name: 'مبارك الكبير', order: 4 }, { name: 'الفروانية', order: 5 }
];

export const defaultAreas: Record<string, Area[]> = {
    'العاصمة': [{ name: 'شرق' }, { name: 'الدسمة' }, { name: 'بنيد القار' }],
    'حولي': [{ name: 'حولي' }, { name: 'السالمية' }, { name: 'الشعب' }],
    'الأحمدي': [{ name: 'الأحمدي' }, { name: 'الفنطاس' }, { name: 'المهبولة' }],
    'الجهراء': [{ name: 'الجهراء القديمة' }, { name: 'النسيم' }, { name: 'تيماء' }],
    'مبارك الكبير': [{ name: 'مبارك الكبير' }, { name: 'صباح السالم' }, { name: 'العدان' }],
    'الفروانية': [{ name: 'الفروانية' }, { name: 'خيطان' }, { name: 'الأندلس' }],
};