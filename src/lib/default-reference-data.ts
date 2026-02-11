import type { Department, Job, Governorate, Area, TransactionType, WorkStage } from '@/lib/types';

export const defaultDepartments: Omit<Department, 'id'>[] = [
  { name: 'القسم المعماري', order: 1 },
  { name: 'القسم الإنشائي', order: 2 },
  { name: 'قسم الكهرباء', order: 3 },
  { name: 'قسم الميكانيك', order: 4 },
  { name: 'الإدارة', order: 5 },
  { name: 'المحاسبة', order: 6 },
  { name: 'الموارد البشرية', order: 7 },
  { name: 'سكرتارية', order: 8 },
];

export const defaultJobs: Record<string, Omit<Job, 'id'>[]> = {
  'القسم المعماري': [
    { name: 'مهندس معماري', order: 1 },
    { name: 'رسام معماري', order: 2 },
  ],
  'القسم الإنشائي': [
    { name: 'مهندس مدني', order: 1 },
  ],
  'الإدارة': [
      { name: 'مدير عام', order: 1 },
  ],
  'سكرتارية': [
      { name: 'سكرتير تنفيذي', order: 1 },
  ],
  'المحاسبة': [
      { name: 'محاسب', order: 1 },
      { name: 'مدير مالي', order: 2 },
  ],
  'الموارد البشرية': [
      { name: 'مسؤول موارد بشرية', order: 1 },
  ],
};

export const defaultGovernorates: Omit<Governorate, 'id'>[] = [
    { name: 'العاصمة', order: 1 },
    { name: 'حولي', order: 2 },
    { name: 'الفروانية', order: 3 },
    { name: 'الأحمدي', order: 4 },
    { name: 'الجهراء', order: 5 },
    { name: 'مبارك الكبير', order: 6 },
];

export const defaultAreas: Record<string, Omit<Area, 'id'>[]> = {
    'العاصمة': [
        { name: 'مدينة الكويت', order: 1 }, { name: 'دسمان', order: 2 }, { name: 'الشرق', order: 3 }, { name: 'الصوابر', order: 4 }, { name: 'المرقاب', order: 5 }, { name: 'القبلة', order: 6 }, { name: 'الصالحية', order: 7 }, { name: 'بنيد القار', order: 8 }, { name: 'الدعية', order: 9 }, { name: 'المنصورية', order: 10 }, { name: 'ضاحية عبدالله السالم', order: 11 }, { name: 'النزهة', order: 12 }, { name: 'الفيحاء', order: 13 }, { name: 'الشامية', order: 14 }, { name: 'الروضة', order: 15 }, { name: 'العديلية', order: 16 }, { name: 'الخالدية', order: 17 }, { name: 'كيفان', order: 18 }, { name: 'القادسية', order: 19 }, { name: 'قرطبة', order: 20 }, { name: 'السرة', order: 21 }, { name: 'اليرموك', order: 22 }, { name: 'الشويخ', order: 23 }, { name: 'غرناطة', order: 24 }, { name: 'الصليبيخات', order: 25 }, { name: 'الدوحة', order: 26 }, { name: 'النهضة', order: 27 }, { name: 'القيروان', order: 28 }, { name: 'شمال غرب الصليبيخات', order: 29 },
    ],
    'حولي': [
        { name: 'حولي', order: 1 }, { name: 'الشعب', order: 2 }, { name: 'السالمية', order: 3 }, { name: 'الرميثية', order: 4 }, { name: 'الجابرية', order: 5 }, { name: 'مشرف', order: 6 }, { name: 'بيان', order: 7 }, { name: 'البدع', order: 8 }, { name: 'النقرة', order: 9 }, { name: 'ميدان حولي', order: 10 }, { name: 'جنوب السرة', order: 11 }, { name: 'الزهراء', order: 12 }, { name: 'حطين', order: 13 }, { name: 'السلام', order: 14 }, { name: 'الشهداء', order: 15 }, { name: 'الصديق', order: 16 },
    ]
};

export const defaultTransactionTypes: (Omit<TransactionType, 'id'> & { departmentNames: string[] })[] = [
    { name: 'تصميم بلدية (سكن خاص)', departmentNames: ['القسم المعماري'], order: 1 },
    { name: 'تصميم كهرباء', departmentNames: ['قسم الكهرباء'], order: 2 },
    { name: 'تصميم إنشائي', departmentNames: ['القسم الإنشائي'], order: 3 },
    { name: 'إشراف على التنفيذ', departmentNames: ['القسم المعماري', 'القسم الإنشائي'], order: 4 },
    { name: 'تصميم واجهات', departmentNames: ['القسم المعماري'], order: 5 },
    { name: 'تصميم ديكور داخلي', departmentNames: ['القسم المعماري'], order: 6 },
];

export const defaultWorkStages: Record<string, Omit<WorkStage, 'id'>[]> = {
    'القسم المعماري': [
        { name: 'استفسارات عامة', order: 1, stageType: 'sequential', trackingType: 'none', allowedRoles: [] },
        { name: 'توقيع العقد', order: 2, stageType: 'sequential', trackingType: 'none', allowedRoles: [] },
        { name: 'تسليم المخططات الابتدائية', order: 3, stageType: 'sequential', trackingType: 'duration', expectedDurationDays: 10, allowedRoles: ['مهندس معماري'] },
        { name: 'تعديلات المالك', order: 4, stageType: 'parallel', trackingType: 'occurrence', maxOccurrences: 3, allowedDuringStages: [], enableModificationTracking: true, allowedRoles: ['مهندس معماري'] },
        { name: 'تسليم المخططات النهائية', order: 5, stageType: 'sequential', trackingType: 'duration', expectedDurationDays: 7, allowedRoles: ['مهندس معماري'] },
    ],
    'القسم الإنشائي': [
        { name: 'التصميم الإنشائي', order: 1, stageType: 'sequential', trackingType: 'duration', expectedDurationDays: 14, allowedRoles: ['مهندس مدني'] },
        { name: 'مراجعة البلدية', order: 2, stageType: 'sequential', trackingType: 'duration', expectedDurationDays: 5, allowedRoles: [] },
    ],
};
