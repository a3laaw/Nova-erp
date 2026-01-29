
import type { Account } from './types';

// Utility to derive the main account type from its code
const getTypeFromCode = (code: string): Account['type'] => {
    if (code.startsWith('1')) return 'asset';
    if (code.startsWith('2')) return 'liability';
    if (code.startsWith('3')) return 'equity';
    if (code.startsWith('4')) return 'income';
    if (code.startsWith('5')) return 'expense';
    return 'asset'; // Default fallback
};

// Raw data inspired by the user's Excel file, with corrections and structure
const rawData: Omit<Account, 'id' | 'type' | 'level'>[] = [
  // الأصول
  { code: '1', name: 'الأصول', description: '', parentCode: null, isPayable: false },
  { code: '11', name: 'أصول متداولة', description: '', parentCode: '1', isPayable: false },
  { code: '1101', name: 'النقد ومايعادله', description: 'النقدية وما في حكمها (في الخزينة والعهد)', parentCode: '11', isPayable: false },
  { code: '110101', name: 'النقدية في الخزينة', description: 'النقدية في الخزينة', parentCode: '1101', isPayable: true },
  { code: '110102', name: 'العهد النقدية', description: 'العهد النقدية للموظفين بشكل مؤقت أو دائم لدفع مصروفات المنشأة', parentCode: '1101', isPayable: true },
  { code: '1102', name: 'النقدية في البنك', description: 'النقدية في البنوك', parentCode: '11', isPayable: false },
  { code: '110201', name: 'حساب البنك الجاري - اسم البنك', description: 'حساب البنك الجاري - اسم البنك', parentCode: '1102', isPayable: true },
  { code: '1103', name: 'المدينون', description: 'مبالغ مستحقة على حساب العملاء (بالأجل)', parentCode: '11', isPayable: false },
  { code: '1104', name: 'مصروفات مقدمة', description: 'مصروف مدفوع مقدماً مثل التأمين وسلف الموظفين وإيجار المكتب', parentCode: '11', isPayable: false },
  { code: '110401', name: 'تأمين طبي مقدم', description: 'تأمين طبي مدفوع مقدماً يتم إطفاء مايخص السنة المالية إلى مصروف', parentCode: '1104', isPayable: false },
  { code: '12', name: 'أصول غير متداولة', description: '', parentCode: '1', isPayable: false }, // Corrected code from 11 to 12
  { code: '121', name: 'الأصول الثابتة', description: '', parentCode: '12', isPayable: false }, // Adjusted code for hierarchy
  { code: '1211', name: 'الأصول الثابتة - المباني', description: 'الأصول الثابتة - المباني', parentCode: '121', isPayable: false },
  { code: '1212', name: 'الأصول الثابتة - المعدات', description: 'الأصول الثابتة - المعدات', parentCode: '121', isPayable: false },
  { code: '1213', name: 'الأصول الثابتة - الأجهزة المكتبية والطابعات', description: 'الأصول الثابتة - الأجهزة المكتبية والطابعات', parentCode: '121', isPayable: false },
  { code: '1214', name: 'الأصول الثابتة - الأثاث والتجهيزات', description: 'الأصول الثابتة - الأثاث والتجهيزات', parentCode: '121', isPayable: false },
  { code: '1215', name: 'الأصول الثابتة - السيارات', description: 'الأصول الثابتة - السيارات', parentCode: '121', isPayable: false },
  { code: '1216', name: 'الأصول الثابتة - الآلات', description: 'الأصول الثابتة - الآلات', parentCode: '121', isPayable: false },
  { code: '1217', name: 'الأصول الثابتة - أخرى', description: 'الأصول الثابتة - أخرى', parentCode: '121', isPayable: false },
  { code: '122', name: 'إهلاك الأصول الثابتة المتراكم', description: 'إهلاك الأصول الثابتة المتراكم', parentCode: '12', isPayable: false }, // Adjusted code for hierarchy
  { code: '1221', name: 'إهلاك متراكم المباني', description: 'إهلاك متراكم المباني', parentCode: '122', isPayable: false },
  { code: '1222', name: 'إهلاك متراكم المعدات', description: 'إهلاك متراكم المعدات', parentCode: '122', isPayable: false },
  { code: '1223', name: 'إهلاك متراكم أجهزة مكتبية وطابعات', description: 'إهلاك متراكم أجهزة مكتبية وطابعات', parentCode: '122', isPayable: false },
  { code: '1224', name: 'إهلاك متراكم الأثاث والتجهيزات', description: 'إهلاك متراكم الأثاث والتجهيزات', parentCode: '122', isPayable: false },
  { code: '1225', name: 'إهلاك متراكم السيارات', description: 'إهلاك متراكم السيارات', parentCode: '122', isPayable: false },
  { code: '1226', name: 'إهلاك متراكم الآلات', description: 'إهلاك متراكم الآلات', parentCode: '122', isPayable: false },
  { code: '1227', name: 'إهلاك متراكم أخرى', description: 'إهلاك متراكم أخرى', parentCode: '122', isPayable: false },

  // الخصوم
  { code: '2', name: 'الخصوم', description: '', parentCode: null, isPayable: false }, // Corrected code and name
  { code: '21', name: 'الخصوم المتداولة', description: '', parentCode: '2', isPayable: false },
  { code: '2101', name: 'الدائنون', description: 'المبالغ المستحقة للدائنين مثل الموردين ومقدمي الخدمات', parentCode: '21', isPayable: false },
  { code: '2102', name: 'إيرادات مقدمة', description: 'إيراد مستلم مقدم من العملاء مقابل خدمات لم تقدم بعد', parentCode: '21', isPayable: false },
  { code: '2103', name: 'مصروفات مستحقة', description: 'مصاريف استحقت ولم تدفع بعد مثل الرواتب', parentCode: '21', isPayable: false },
  { code: '2104', name: 'ضرائب مستحقة', description: 'ضرائب مستحقة للحكومة مثل ضريبة القيمة المضافة', parentCode: '21', isPayable: false },
  { code: '210401', name: 'ضريبة القيمة المضافة المستحقة', description: 'ضريبة القيمة المضافة المستحقة', parentCode: '2104', isPayable: true },
  { code: '22', name: 'الخصوم غير المتداولة', description: '', parentCode: '2', isPayable: false },
  { code: '2201', name: 'قروض طويلة الأجل', description: 'قروض تستحق بعد أكثر من سنة مالية', parentCode: '22', isPayable: false },
  
  // حقوق الملكية
  { code: '3', name: 'حقوق الملكية', description: '', parentCode: null, isPayable: false },
  { code: '31', name: 'رأس المال', description: 'رأس المال المستثمر في المنشأة', parentCode: '3', isPayable: false },
  { code: '3101', name: 'رأس مال المالك', description: 'رأس مال المالك', parentCode: '31', isPayable: true },
  { code: '32', name: 'الأرباح المحتجزة', description: 'الأرباح المرحلة من السنوات السابقة', parentCode: '3', isPayable: false },
  { code: '33', name: 'أرباح وخسائر العام', description: 'صافي ربح أو خسارة الفترة الحالية', parentCode: '3', isPayable: false },
  
  // الإيرادات
  { code: '4', name: 'الإيرادات', description: '', parentCode: null, isPayable: false },
  { code: '41', name: 'إيرادات النشاط الرئيسي', description: '', parentCode: '4', isPayable: false },
  { code: '4101', name: 'إيرادات استشارات هندسية', description: 'إيرادات من الخدمات الهندسية والاستشارية', parentCode: '41', isPayable: true },
  { code: '42', name: 'إيرادات أخرى', description: '', parentCode: '4', isPayable: false },
  { code: '4201', name: 'إيرادات متنوعة', description: 'إيرادات من مصادر غير رئيسية', parentCode: '42', isPayable: true },

  // المصروفات
  { code: '5', name: 'المصروفات', description: '', parentCode: null, isPayable: false },
  { code: '51', name: 'تكلفة الإيرادات', description: 'تكاليف مباشرة مرتبطة بتحقيق الإيراد', parentCode: '5', isPayable: false },
  { code: '52', name: 'المصاريف التشغيلية', description: 'المصاريف المتعلقة بتشغيل النشاط', parentCode: '5', isPayable: false },
  { code: '5201', name: 'رواتب وأجور', description: 'رواتب وأجور الموظفين', parentCode: '52', isPayable: true },
  { code: '5202', name: 'إيجارات', description: 'إيجارات المكاتب والمرافق', parentCode: '52', isPayable: true },
  { code: '5203', name: 'كهرباء ومياه', description: 'مصاريف فواتير الكهرباء والمياه', parentCode: '52', isPayable: true },
  { code: '5204', name: 'صيانة وإصلاحات', description: 'مصاريف صيانة وإصلاح الأصول', parentCode: '52', isPayable: true },
  { code: '5205', name: 'مصاريف تسويق ودعاية', description: 'مصاريف الحملات الإعلانية والتسويقية', parentCode: '52', isPayable: true },
  { code: '5206', name: 'رسوم حكومية وتراخيص', description: 'رسوم تجديد الرخص والخدمات الحكومية', parentCode: '52', isPayable: true },
  { code: '5207', name: 'مصاريف سفر وانتقالات', description: 'تكاليف السفر والانتقالات لموظفي الشركة', parentCode: '52', isPayable: true },
  { code: '5208', name: 'اشتراكات وخدمات برمجية', description: 'تكاليف البرامج والخدمات التقنية', parentCode: '52', isPayable: true },
  { code: '5209', name: 'مصاريف استضافة وضيافة', description: 'مصاريف متعلقة بالضيافة واستقبال العملاء', parentCode: '52', isPayable: true },
  { code: '5210', name: 'أدوات مكتبية ومطبوعات', description: 'تكاليف الأدوات المكتبية والقرطاسية', parentCode: '52', isPayable: true },
  { code: '5211', name: 'مصروفات متنوعة', description: 'أي مصروفات تشغيلية أخرى غير مصنفة', parentCode: '52', isPayable: true },
  { code: '53', name: 'مصاريف إهلاك', description: 'مصروف إهلاك الأصول الثابتة للفترة', parentCode: '5', isPayable: false },
  { code: '5301', name: 'مصروف إهلاك المباني', description: 'مصروف إهلاك المباني', parentCode: '53', isPayable: false },
  { code: '5302', name: 'مصروف إهلاك المعدات', description: 'مصروف إهلاك المعدات', parentCode: '53', isPayable: false },
  { code: '5303', name: 'مصروف إهلاك الأجهزة المكتبية', description: 'مصروف إهلاك الأجهزة المكتبية', parentCode: '53', isPayable: false },
  { code: '5304', name: 'مصروف إهلاك الأثاث', description: 'مصروف إهلاك الأثاث', parentCode: '53', isPayable: false },
  { code: '5305', name: 'مصروف إهلاك السيارات', description: 'مصروف إهلاك السيارات', parentCode: '53', isPayable: false },
  { code: '5306', name: 'مصروف إهلاك الآلات', description: 'مصروف إهلاك الآلات', parentCode: '53', isPayable: false },
];

const getLevelFromCode = (code: string): number => {
    if (code.length === 1) return 0;
    if (code.length === 2) return 1;
    if (code.length <= 4) return 2;
    return 3; // Or more levels if needed
};

export const defaultChartOfAccounts: Omit<Account, 'id'>[] = rawData.map(account => ({
    ...account,
    type: getTypeFromCode(account.code),
    level: getLevelFromCode(account.code),
}));
