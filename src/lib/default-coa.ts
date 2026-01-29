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


// This is the full, corrected chart of accounts based on the user's request.
const rawData: Omit<Account, 'id' | 'type' | 'statement' | 'balanceType'>[] = [
  // --- الأصول (1) ---
  { code: '1', name: 'الأصول', parentCode: null, isPayable: false, level: 0 },
  { code: '11', name: 'الأصول المتداولة', parentCode: '1', isPayable: false, level: 1 },
  { code: '1101', name: 'النقد وما يعادله', parentCode: '11', isPayable: false, level: 2, description: 'النقدية وما في حكمها (في الخزينة والعهد)' },
  { code: '110101', name: 'النقدية في الصندوق', parentCode: '1101', isPayable: true, level: 3, description: 'النقدية في الخزينة' },
  { code: '110102', name: 'العهد النقدية', parentCode: '1101', isPayable: true, level: 3, description: 'العهد النقدية للموظفين بشكل مؤقت أو دائم لدفع مصروفات المنشأة' },
  { code: '1102', name: 'النقدية في البنك', parentCode: '11', isPayable: false, level: 2, description: 'النقدية في البنوك' },
  { code: '110201', name: 'حساب البنك الجاري - اسم البنك', parentCode: '1102', isPayable: true, level: 3, description: 'حساب البنك الجاري - اسم البنك' },
  { code: '1103', name: 'المدينون', parentCode: '11', isPayable: true, level: 2, description: 'مبالغ مستحقة على حساب العملاء (بالأجل)' },
  { code: '1104', name: 'مصروفات مدفوعة مقدماً', parentCode: '11', isPayable: false, level: 2, description: 'مصروف مدفوع مقدماً مثل التأمين وسلف الموظفين وإيجار المكتب' },
  { code: '110401', name: 'تأمين طبي مقدم', parentCode: '1104', isPayable: true, level: 3, description: 'تأمين طبي مدفوع مقدماً يتم إطفاء مايخص السنة المالية إلى مصروف' },
  
  { code: '12', name: 'الأصول غير المتداولة', parentCode: '1', isPayable: false, level: 1 },
  { code: '121', name: 'الأصول الثابتة', parentCode: '12', isPayable: false, level: 2 },
  { code: '12101', name: 'الأصول الثابتة - المباني', parentCode: '121', isPayable: true, level: 3, description: 'الأصول الثابتة - المباني' },
  { code: '12102', name: 'الأصول الثابتة - المعدات', parentCode: '121', isPayable: true, level: 3, description: 'الأصول الثابتة - المعدات' },
  { code: '12103', name: 'الأصول الثابتة - الأجهزة المكتبية والطابعات', parentCode: '121', isPayable: true, level: 3, description: 'الأصول الثابتة - الأجهزة المكتبية والطابعات' },
  { code: '12104', name: 'الأصول الثابتة - الأثاث والتجهيزات', parentCode: '121', isPayable: true, level: 3, description: 'الأصول الثابتة - الأثاث والتجهيزات' },
  { code: '12105', name: 'الأصول الثابتة - السيارات', parentCode: '121', isPayable: true, level: 3, description: 'الأصول الثابتة - السيارات' },
  { code: '12106', name: 'الأصول الثابتة - الآلات', parentCode: '121', isPayable: true, level: 3, description: 'الأصول الثابتة - الآلات' },
  { code: '12107', name: 'الأصول الثابتة - أخرى', parentCode: '121', isPayable: true, level: 3, description: 'الأصول الثابتة - أخرى' },
  { code: '122', name: 'إهلاك الأصول الثابتة المتراكم', parentCode: '12', isPayable: false, level: 2, description: 'إهلاك الأصول الثابتة المتراكم' },
  { code: '12201', name: 'إهلاك متراكم المباني', parentCode: '122', isPayable: true, level: 3, description: 'إهلاك متراكم المباني' },
  { code: '12202', name: 'إهلاك متراكم المعدات', parentCode: '122', isPayable: true, level: 3, description: 'إهلاك متراكم المعدات' },
  { code: '12203', name: 'إهلاك متراكم أجهزة مكتبية وطابعات', parentCode: '122', isPayable: true, level: 3, description: 'إهلاك متراكم أجهزة مكتبية وطابعات' },
  { code: '12204', name: 'إهلاك متراكم الأثاث والتجهيزات', parentCode: '122', isPayable: true, level: 3, description: 'إهلاك متراكم الأثاث والتجهيزات' },
  { code: '12205', name: 'إهلاك متراكم السيارات', parentCode: '122', isPayable: true, level: 3, description: 'إهلاك متراكم السيارات' },
  { code: '12206', name: 'إهلاك متراكم الآلات', parentCode: '122', isPayable: true, level: 3, description: 'إهلاك متراكم الآلات' },
  { code: '12207', name: 'إهلاك متراكم أخرى', parentCode: '122', isPayable: true, level: 3, description: 'إهلاك متراكم أخرى' },
  
  // --- الخصوم (2) ---
  { code: '2', name: 'الخصوم', parentCode: null, isPayable: false, level: 0 },
  { code: '21', name: 'الخصوم المتداولة', parentCode: '2', isPayable: false, level: 1 },
  { code: '2101', name: 'الموردون', parentCode: '21', isPayable: true, level: 2, description: 'المبالغ المستحقة للدفع للموردين' },
  { code: '2102', name: 'أوراق دفع', parentCode: '21', isPayable: true, level: 2, description: 'الشيكات المستحقة الدفع' },
  { code: '2103', name: 'إيرادات غير مكتسبة', parentCode: '21', isPayable: true, level: 2, description: 'مبالغ مستلمة من العملاء مقدماً قبل تقديم الخدمة' },
  { code: '2104', name: 'مصاريف مستحقة', parentCode: '21', isPayable: false, level: 2, description: 'مصروفات تخص الفترة المالية الحالية ولكن لم يتم سدادها بعد' },
  { code: '210401', name: 'رواتب مستحقة', parentCode: '2104', isPayable: true, level: 3, description: 'رواتب الموظفين المستحقة عن الفترة' },
  
  // --- حقوق الملكية (3) ---
  { code: '3', name: 'حقوق الملكية', parentCode: null, isPayable: false, level: 0 },
  { code: '31', name: 'رأس المال', parentCode: '3', isPayable: false, level: 1 },
  { code: '3101', name: 'رأس المال المدفوع', parentCode: '31', isPayable: true, level: 2 },
  { code: '32', name: 'جاري الشركاء', parentCode: '3', isPayable: true, level: 1, description: 'حسابات الشركاء الشخصية مع الشركة' },
  { code: '33', name: 'أرباح مبقاة / خسائر مدورة', parentCode: '3', isPayable: true, level: 1 },
  
  // --- الإيرادات (4) ---
  { code: '4', name: 'الإيرادات', parentCode: null, isPayable: false, level: 0 },
  { code: '41', name: 'إيرادات النشاط التشغيلي', parentCode: '4', isPayable: false, level: 1 },
  { code: '4101', name: 'إيرادات استشارات هندسية', parentCode: '41', isPayable: true, level: 2, description: 'إيرادات من تقديم استشارات هندسية' },
  { code: '4102', name: 'إيرادات تصميم', parentCode: '41', isPayable: true, level: 2, description: 'إيرادات من أعمال التصميم' },
  { code: '4103', name: 'إيرادات إشراف', parentCode: '41', isPayable: true, level: 2, description: 'إيرادات من الإشراف على المشاريع' },
  
  // --- المصروفات (5) ---
  { code: '5', name: 'المصروفات', parentCode: null, isPayable: false, level: 0 },
  { code: '51', name: 'تكلفة الإيرادات', parentCode: '5', isPayable: false, level: 1 },
  { code: '5101', name: 'رواتب المهندسين والفنيين', parentCode: '51', isPayable: true, level: 2, description: 'رواتب الفريق الهندسي والفني المباشر على المشاريع' },
  { code: '5102', name: 'تكاليف استشاريين من الباطن', parentCode: '51', isPayable: true, level: 2, description: 'تكاليف الاستعانة باستشاريين خارجيين للمشاريع' },
  { code: '5103', name: 'مواد مباشرة للمشاريع', parentCode: '51', isPayable: true, level: 2, description: 'تكاليف المواد المستخدمة مباشرة في المشاريع' },
  
  { code: '52', name: 'مصاريف عمومية وإدارية', parentCode: '5', isPayable: false, level: 1 },
  { code: '5201', name: 'رواتب وأجور الموظفين', parentCode: '52', isPayable: true, level: 2, description: 'رواتب موظفي الإدارة والمحاسبة والموارد البشرية' },
  { code: '5202', name: 'مصاريف تسويق ومبيعات', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف متعلقة بالتسويق والإعلان' },
  { code: '5203', name: 'إيجارات', parentCode: '52', isPayable: true, level: 2, description: 'مصروف إيجار المكتب' },
  { code: '5204', name: 'فواتير كهرباء وماء واتصالات', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف الخدمات العامة للمكتب' },
  { code: '5205', name: 'تراخيص واشتراكات حكومية', parentCode: '52', isPayable: true, level: 2, description: 'رسوم التراخيص والاشتراكات الحكومية' },
  { code: '5206', name: 'مصروفات بنكية', parentCode: '52', isPayable: true, level: 2, description: 'الرسوم والمصاريف البنكية' },
  { code: '5207', name: 'صيانة وإصلاحات', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف صيانة المكتب والمعدات' },
  { code: '5208', name: 'نثريات ومصاريف متنوعة', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف صغيرة ومتفرقة' },
  { code: '5209', name: 'وقود وزيوت سيارات', parentCode: '52', isPayable: true, level: 2, description: 'مصروف وقود وزيوت سيارات الشركة' },
  { code: '5210', name: 'ضيافة وبوفيه', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف الضيافة والبوفيه للمكتب' },
  { code: '5211', name: 'أدوات مكتبية ومطبوعات', parentCode: '52', isPayable: true, level: 2, description: 'تكاليف الأدوات المكتبية والورق والأحبار' },
  { code: '5212', name: 'اشتراكات برامج وتطبيقات', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف الاشتراكات في البرامج السحابية والتطبيقات' },
  { code: '5213', name: 'رسوم التأمينات الاجتماعية', parentCode: '52', isPayable: true, level: 2, description: 'حصة الشركة في التأمينات الاجتماعية' },
  { code: '5214', name: 'صيانة سيارات الشركة', parentCode: '52', isPayable: true, level: 2, description: 'مصاريف الصيانة الدورية وإصلاح السيارات' },
  { code: '5215', name: 'مصاريف الإهلاك', parentCode: '52', isPayable: false, level: 2, description: 'إهلاك الأصول الثابتة' },
  { code: '521501', name: 'مصروف إهلاك المباني', parentCode: '5215', isPayable: true, level: 3, description: 'قسط الإهلاك السنوي للمباني' },
  { code: '521502', name: 'مصروف إهلاك المعدات', parentCode: '5215', isPayable: true, level: 3, description: 'قسط الإهلاك السنوي للمعدات' },
  { code: '521503', name: 'مصروف إهلاك الأجهزة', parentCode: '5215', isPayable: true, level: 3, description: 'قسط الإهلاك السنوي للأجهزة' },
  { code: '521504', name: 'مصروف إهلاك الأثاث', parentCode: '5215', isPayable: true, level: 3, description: 'قسط الإهلاك السنوي للأثاث' },
  { code: '521505', name: 'مصروف إهلاك السيارات', parentCode: '5215', isPayable: true, level: 3, description: 'قسط الإهلاك السنوي للسيارات' },
  { code: '521506', name: 'مصروف إهلاك الآلات', parentCode: '5215', isPayable: true, level: 3, description: 'قسط الإهلاك السنوي للآلات' },
  { code: '521507', name: 'مصروف إهلاك أخرى', parentCode: '5215', isPayable: true, level: 3, description: 'قسط الإهلاك السنوي لأصول أخرى' },
];


export const defaultChartOfAccounts: Omit<Account, 'id'>[] = rawData.map(account => ({
    ...account,
    type: getTypeFromCode(account.code),
    statement: getStatementType(account.code),
    balanceType: getBalanceType(account.code),
    description: account.description || ''
}));
