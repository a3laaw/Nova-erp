import type { Account } from './types';

// Utility functions to derive properties from the account code
const getTypeFromCode = (code: string): Account['type'] => {
    if (code.startsWith('1')) return 'asset';
    if (code.startsWith('2')) return 'liability';
    if (code.startsWith('3')) return 'equity';
    if (code.startsWith('4')) return 'income';
    if (code.startsWith('5')) return 'expense';
    return 'asset'; // Default fallback
};

const getStatementType = (code: string): Account['statement'] => {
    if (code.startsWith('1') || code.startsWith('2') || code.startsWith('3')) {
        return 'Balance Sheet';
    }
    return 'Income Statement';
};

const getBalanceType = (code: string): Account['balanceType'] => {
    if (code.startsWith('1') || code.startsWith('5')) {
        return 'Debit';
    }
    return 'Credit';
};


// This raw data is corrected from the user's Excel file structure.
const rawData: Omit<Account, 'id' | 'type' | 'statement' | 'balanceType'>[] = [
  // Assets
  { code: '1', name: 'الأصول', parentCode: null, isPayable: false, level: 0 },
  { code: '11', name: 'الأصول المتداولة', parentCode: '1', isPayable: false, level: 1 },
  { code: '1101', name: 'النقد وما يعادله', parentCode: '11', isPayable: false, level: 2 },
  { code: '110101', name: 'النقدية في الصندوق', parentCode: '1101', isPayable: true, level: 3 },
  { code: '110102', name: 'العهد النقدية', parentCode: '1101', isPayable: true, level: 3 },
  { code: '1102', name: 'البنوك', parentCode: '11', isPayable: true, level: 2 },
  { code: '1103', name: 'العملاء', parentCode: '11', isPayable: true, level: 2, description: 'حسابات العملاء المدينة' },
  { code: '1104', name: 'مصروفات مدفوعة مقدماً', parentCode: '11', isPayable: false, level: 2 },
  { code: '110401', name: 'إيجار مدفوع مقدماً', parentCode: '1104', isPayable: true, level: 3 },
  { code: '110402', name: 'تأمين مدفوع مقدماً', parentCode: '1104', isPayable: true, level: 3 },
  { code: '1105', name: 'سلف الموظفين', parentCode: '11', isPayable: true, level: 2 },

  { code: '12', name: 'الأصول غير المتداولة', parentCode: '1', isPayable: false, level: 1 },
  { code: '121', name: 'الأصول الثابتة', parentCode: '12', isPayable: false, level: 2 },
  { code: '12101', name: 'الأراضي', parentCode: '121', isPayable: true, level: 3 },
  { code: '12102', name: 'المباني', parentCode: '121', isPayable: true, level: 3 },
  { code: '12103', name: 'السيارات', parentCode: '121', isPayable: true, level: 3 },
  { code: '12104', name: 'الأثاث والتجهيزات', parentCode: '121', isPayable: true, level: 3 },
  { code: '12105', name: 'الأجهزة والمعدات', parentCode: '121', isPayable: true, level: 3 },
  { code: '122', name: 'مجمع الإهلاك', parentCode: '12', isPayable: false, level: 2 },
  { code: '12201', name: 'مجمع إهلاك المباني', parentCode: '122', isPayable: true, level: 3 },
  { code: '12202', name: 'مجمع إهلاك السيارات', parentCode: '122', isPayable: true, level: 3 },
  { code: '12203', name: 'مجمع إهلاك الأثاث', parentCode: '122', isPayable: true, level: 3 },
  { code: '12204', name: 'مجمع إهلاك الأجهزة', parentCode: '122', isPayable: true, level: 3 },

  // Liabilities
  { code: '2', name: 'الخصوم', parentCode: null, isPayable: false, level: 0 },
  { code: '21', name: 'الخصوم المتداولة', parentCode: '2', isPayable: false, level: 1 },
  { code: '2101', name: 'الموردون', parentCode: '21', isPayable: true, level: 2 },
  { code: '2102', name: 'أوراق الدفع', parentCode: '21', isPayable: true, level: 2 },
  { code: '2103', name: 'إيرادات مقدمة', parentCode: '21', isPayable: true, level: 2 },
  { code: '2104', name: 'مصروفات مستحقة', parentCode: '21', isPayable: false, level: 2 },
  { code: '210401', name: 'رواتب وأجور مستحقة', parentCode: '2104', isPayable: true, level: 3 },
  { code: '210402', name: 'إيجار مستحق', parentCode: '2104', isPayable: true, level: 3 },
  { code: '2105', name: 'مخصص مكافأة نهاية الخدمة', parentCode: '21', isPayable: true, level: 2 },
  { code: '2106', name: 'ضريبة القيمة المضافة', parentCode: '21', isPayable: true, level: 2 },
  { code: '22', name: 'الخصوم غير المتداولة', parentCode: '2', isPayable: false, level: 1 },
  { code: '2201', name: 'قروض طويلة الأجل', parentCode: '22', isPayable: true, level: 2 },

  // Equity
  { code: '3', name: 'حقوق الملكية', parentCode: null, isPayable: false, level: 0 },
  { code: '31', name: 'رأس المال', parentCode: '3', isPayable: false, level: 1 },
  { code: '3101', name: 'رأس المال المدفوع', parentCode: '31', isPayable: true, level: 2 },
  { code: '32', name: 'جاري الشركاء', parentCode: '3', isPayable: true, level: 1 },
  { code: '33', name: 'الأرباح المحتجزة / الخسائر المدورة', parentCode: '3', isPayable: true, level: 1 },
  { code: '34', name: 'أرباح أو خسائر العام', parentCode: '3', isPayable: true, level: 1 },

  // Revenue
  { code: '4', name: 'الإيرادات', parentCode: null, isPayable: false, level: 0 },
  { code: '41', name: 'إيرادات النشاط الرئيسي', parentCode: '4', isPayable: false, level: 1 },
  { code: '4101', name: 'إيرادات استشارات هندسية', parentCode: '41', isPayable: true, level: 2 },
  { code: '4102', name: 'إيرادات تصميم داخلي', parentCode: '41', isPayable: true, level: 2 },
  { code: '4103', name: 'إيرادات إشراف على التنفيذ', parentCode: '41', isPayable: true, level: 2 },
  { code: '42', name: 'إيرادات أخرى', parentCode: '4', isPayable: false, level: 1 },
  { code: '4201', name: 'إيرادات متنوعة', parentCode: '42', isPayable: true, level: 2 },
  
  // Expenses
  { code: '5', name: 'المصروفات', parentCode: null, isPayable: false, level: 0 },
  { code: '51', name: 'تكلفة الإيرادات', parentCode: '5', isPayable: false, level: 1 },
  { code: '5101', name: 'تكلفة مباشرة للمشاريع', parentCode: '51', isPayable: true, level: 2 },
  { code: '5102', name: 'رواتب المهندسين والفنيين', parentCode: '51', isPayable: true, level: 2 },

  { code: '52', name: 'المصاريف العمومية والإدارية', parentCode: '5', isPayable: false, level: 1 },
  { code: '5201', name: 'رواتب وأجور الموظفين الإداريين', parentCode: '52', isPayable: true, level: 2 },
  { code: '5202', name: 'إيجار المكتب', parentCode: '52', isPayable: true, level: 2 },
  { code: '5203', name: 'كهرباء ومياه وهاتف', parentCode: '52', isPayable: true, level: 2 },
  { code: '5204', name: 'صيانة ونظافة', parentCode: '52', isPayable: true, level: 2 },
  { code: '5205', name: 'أدوات مكتبية ومطبوعات', parentCode: '52', isPayable: true, level: 2 },
  { code: '5206', name: 'اشتراكات وخدمات برمجية', parentCode: '52', isPayable: true, level: 2 },
  { code: '5207', name: 'استشارات قانونية ومالية', parentCode: '52', isPayable: true, level: 2 },
  { code: '5208', name: 'مصاريف بنكية', parentCode: '52', isPayable: true, level: 2 },
  { code: '5209', name: 'تأمينات', parentCode: '52', isPayable: true, level: 2 },
  { code: '5210', name: 'انتقالات ومواصلات', parentCode: '52', isPayable: true, level: 2 },
  { code: '5211', name: 'ضيافة وبوفيه', parentCode: '52', isPayable: true, level: 2 },
  { code: '5212', name: 'مصروفات حكومية', parentCode: '52', isPayable: true, level: 2 },
  { code: '5213', name: 'مصروفات بريد واتصالات', parentCode: '52', isPayable: true, level: 2 },
  { code: '5214', name: 'تأمين طبي', parentCode: '52', isPayable: true, level: 2 },
  { code: '5215', name: 'اشتراكات التأمينات الاجتماعية', parentCode: '52', isPayable: true, level: 2 },
  { code: '5216', name: 'رسوم تجديد الرخص والإقامات', parentCode: '52', isPayable: true, level: 2 },
  { code: '5217', name: 'غرامات ومخالفات', parentCode: '52', isPayable: true, level: 2 },
  { code: '5218', name: 'صيانة سيارات الشركة', parentCode: '52', isPayable: true, level: 2 },
  { code: '5219', name: 'وقود وزيوت سيارات', parentCode: '52', isPayable: true, level: 2 },
  { code: '5220', name: 'مصروفات إعلانية', parentCode: '52', isPayable: true, level: 2 },
  { code: '5221', name: 'مصروفات عمومية أخرى', parentCode: '52', isPayable: true, level: 2 },
  
  { code: '53', name: 'مصروفات الإهلاك', parentCode: '5', isPayable: false, level: 1 },
  { code: '5301', name: 'مصروف إهلاك السيارات', parentCode: '53', isPayable: true, level: 2 },
  { code: '5302', name: 'مصروف إهلاك الأجهزة والمعدات', parentCode: '53', isPayable: true, level: 2 },
  { code: '5303', name: 'مصروف إهلاك الأثاث', parentCode: '53', isPayable: true, level: 2 },
];


export const defaultChartOfAccounts: Omit<Account, 'id'>[] = rawData.map(account => ({
    ...account,
    type: getTypeFromCode(account.code),
    statement: getStatementType(account.code),
    balanceType: getBalanceType(account.code),
}));
