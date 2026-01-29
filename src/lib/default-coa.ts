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

const getLevelFromCode = (code: string): number => {
    const len = String(code).length;
    if (len === 1) return 0;
    if (len <= 3) return 1;
    if (len <= 5) return 2;
    return 3;
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
const rawData: Omit<Account, 'id' | 'type' | 'level' | 'statement' | 'balanceType'>[] = [
  { code: '1', name: 'الأصول', parentCode: null, isPayable: false },
  { code: '11', name: 'أصول متداولة', parentCode: '1', isPayable: false },
  { code: '1101', name: 'النقد ومايعادله', parentCode: '11', isPayable: false, description: 'النقدية وما في حكمها (في الخزينة والعهد)' },
  { code: '110101', name: 'النقدية في الخزينة', parentCode: '1101', isPayable: true, description: 'النقدية في الخزينة' },
  { code: '110102', name: 'العهد النقدية', parentCode: '1101', isPayable: true, description: 'العهد النقدية للموظفين بشكل مؤقت أو دائم لدفع مصروفات المنشأة' },
  { code: '1102', name: 'النقدية في البنك', parentCode: '11', isPayable: false, description: 'النقدية في البنوك' },
  { code: '110201', name: 'حساب البنك الجاري', parentCode: '1102', isPayable: true, description: 'حساب البنك الجاري' },
  { code: '1103', name: 'المدينون', parentCode: '11', isPayable: true, description: 'مبالغ مستحقة على حساب العملاء (بالأجل)' },
  { code: '1104', name: 'مصروفات مقدمة', parentCode: '11', isPayable: false, description: 'مصروف مدفوع مقدماً مثل التأمين وسلف الموظفين وإيجار المكتب' },
  { code: '110401', name: 'تأمين طبي مقدم', parentCode: '1104', isPayable: true, description: 'تأمين طبي مدفوع مقدماً يتم إطفاء مايخص السنة المالية إلى مصروف' },
  { code: '1105', name: 'سلف الموظفين', parentCode: '11', isPayable: true },
  { code: '12', name: 'أصول غير متداولة', parentCode: '1', isPayable: false },
  { code: '121', name: 'الأصول الثابتة', parentCode: '12', isPayable: false },
  { code: '12101', name: 'الأصول الثابتة - المباني', parentCode: '121', isPayable: true },
  { code: '12102', name: 'الأصول الثابتة - المعدات', parentCode: '121', isPayable: true },
  { code: '12103', name: 'الأصول الثابتة - الأجهزة المكتبية والطابعات', parentCode: '121', isPayable: true },
  { code: '12104', name: 'الأصول الثابتة - الأثاث والتجهيزات', parentCode: '121', isPayable: true },
  { code: '12105', name: 'الأصول الثابتة - السيارات', parentCode: '121', isPayable: true },
  { code: '12106', name: 'الأصول الثابتة - الآلات', parentCode: '121', isPayable: true },
  { code: '12107', name: 'الأصول الثابتة - أخرى', parentCode: '121', isPayable: true },
  { code: '122', name: 'إهلاك الأصول الثابتة المتراكم', parentCode: '12', isPayable: false },
  { code: '12201', name: 'إهلاك متراكم المباني', parentCode: '122', isPayable: true },
  { code: '12202', name: 'إهلاك متراكم المعدات', parentCode: '122', isPayable: true },
  { code: '12203', name: 'إهلاك متراكم أجهزة مكتبية وطابعات', parentCode: '122', isPayable: true },
  { code: '12204', name: 'إهلاك متراكم الأثاث والتجهيزات', parentCode: '122', isPayable: true },
  { code: '12205', name: 'إهلاك متراكم السيارات', parentCode: '122', isPayable: true },
  { code: '12206', name: 'إهلاك متراكم الآلات', parentCode: '122', isPayable: true },
  { code: '12207', name: 'إهلاك متراكم أخرى', parentCode: '122', isPayable: true },
  { code: '2', name: 'الخصوم', parentCode: null, isPayable: false },
  { code: '21', name: 'الخصوم المتداولة', parentCode: '2', isPayable: false },
  { code: '2101', name: 'الموردون', parentCode: '21', isPayable: true },
  { code: '2102', name: 'أوراق الدفع', parentCode: '21', isPayable: true },
  { code: '2103', name: 'إيرادات مقدمة', parentCode: '21', isPayable: true },
  { code: '2104', name: 'مصروفات مستحقة', parentCode: '21', isPayable: false },
  { code: '210401', name: 'رواتب مستحقة', parentCode: '2104', isPayable: true },
  { code: '210402', name: 'إيجار مستحق', parentCode: '2104', isPayable: true },
  { code: '2105', name: 'تأمينات اجتماعية مستحقة', parentCode: '21', isPayable: true },
  { code: '2106', name: 'مخصص مكافأة نهاية الخدمة', parentCode: '21', isPayable: true },
  { code: '2107', name: 'ضريبة القيمة المضافة', parentCode: '21', isPayable: true },
  { code: '22', name: 'الخصوم غير المتداولة', parentCode: '2', isPayable: false },
  { code: '2201', name: 'قروض طويلة الأجل', parentCode: '22', isPayable: true },
  { code: '3', name: 'حقوق الملكية', parentCode: null, isPayable: false },
  { code: '31', name: 'رأس المال', parentCode: '3', isPayable: false },
  { code: '3101', name: 'رأس مال المالك', parentCode: '31', isPayable: true },
  { code: '32', name: 'جاري الشركاء', parentCode: '3', isPayable: true },
  { code: '33', name: 'أرباح مبقاة / خسائر مدورة', parentCode: '3', isPayable: true },
  { code: '34', name: 'أرباح أو خسائر العام', parentCode: '3', isPayable: true },
  { code: '4', name: 'الإيرادات', parentCode: null, isPayable: false },
  { code: '41', name: 'إيرادات النشاط الرئيسي', parentCode: '4', isPayable: false },
  { code: '4101', name: 'إيرادات استشارات هندسية', parentCode: '41', isPayable: true },
  { code: '4102', name: 'إيرادات تصميم داخلي', parentCode: '41', isPayable: true },
  { code: '4103', name: 'إيرادات إشراف على التنفيذ', parentCode: '41', isPayable: true },
  { code: '42', name: 'إيرادات أخرى', parentCode: '4', isPayable: false },
  { code: '4201', name: 'إيرادات متنوعة', parentCode: '42', isPayable: true },
  { code: '5', name: 'المصروفات', parentCode: null, isPayable: false },
  { code: '51', name: 'تكلفة الإيرادات', parentCode: '5', isPayable: false },
  { code: '5101', name: 'تكلفة مباشرة للمشاريع', parentCode: '51', isPayable: true },
  { code: '5102', name: 'رواتب المهندسين والفنيين', parentCode: '51', isPayable: true },
  { code: '52', name: 'المصاريف العمومية والإدارية', parentCode: '5', isPayable: false },
  { code: '5201', name: 'رواتب وأجور الموظفين الإداريين', parentCode: '52', isPayable: true },
  { code: '5202', name: 'إيجار المكتب', parentCode: '52', isPayable: true },
  { code: '5203', name: 'كهرباء ومياه وهاتف', parentCode: '52', isPayable: true },
  { code: '5204', name: 'صيانة ونظافة', parentCode: '52', isPayable: true },
  { code: '5205', name: 'أدوات مكتبية ومطبوعات', parentCode: '52', isPayable: true },
  { code: '5206', name: 'اشتراكات وخدمات برمجية', parentCode: '52', isPayable: true },
  { code: '5207', name: 'استشارات قانونية ومالية', parentCode: '52', isPayable: true },
  { code: '5208', name: 'مصاريف بنكية', parentCode: '52', isPayable: true },
  { code: '5209', name: 'تأمينات', parentCode: '52', isPayable: true },
  { code: '5210', name: 'انتقالات ومواصلات', parentCode: '52', isPayable: true },
  { code: '5211', name: 'ضيافة وبوفيه', parentCode: '52', isPayable: true },
  { code: '5212', name: 'مصروفات حكومية', parentCode: '52', isPayable: true },
  { code: '5213', name: 'مصروفات بريد واتصالات', parentCode: '52', isPayable: true },
  { code: '5214', name: 'تأمين طبي', parentCode: '52', isPayable: true },
  { code: '5215', name: 'اشتراكات التأمينات الاجتماعية', parentCode: '52', isPayable: true },
  { code: '5216', name: 'رسوم تجديد الرخص والإقامات', parentCode: '52', isPayable: true },
  { code: '5217', name: 'غرامات ومخالفات', parentCode: '52', isPayable: true },
  { code: '5218', name: 'صيانة سيارات الشركة', parentCode: '52', isPayable: true },
  { code: '5219', name: 'وقود وزيوت سيارات', parentCode: '52', isPayable: true },
  { code: '5220', name: 'مصروفات إعلانية', parentCode: '52', isPayable: true },
  { code: '5221', name: 'مصروفات عمومية أخرى', parentCode: '52', isPayable: true },
  { code: '53', name: 'مصروفات الإهلاك', parentCode: '5', isPayable: false },
  { code: '5301', name: 'مصروف إهلاك السيارات', parentCode: '53', isPayable: true },
  { code: '5302', name: 'مصروف إهلاك الأجهزة والمعدات', parentCode: '53', isPayable: true },
  { code: '5303', name: 'مصروف إهلاك الأثاث', parentCode: '53', isPayable: true },
];

export const defaultChartOfAccounts: Omit<Account, 'id'>[] = rawData.map(account => ({
    ...account,
    type: getTypeFromCode(account.code),
    level: getLevelFromCode(account.code),
    statement: getStatementType(account.code),
    balanceType: getBalanceType(account.code),
}));
