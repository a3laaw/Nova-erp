
import type { Account } from '@/lib/types';

export const defaultChartOfAccounts: Omit<Account, 'id'>[] = [
  // Assets
  { code: '1', name: 'الأصول', type: 'asset', level: 0, parentCode: null, isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '11', name: 'الأصول المتداولة', type: 'asset', level: 1, parentCode: '1', isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '1101', name: 'النقد وما في حكمه', type: 'asset', level: 2, parentCode: '11', isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '110101', name: 'الصندوق', type: 'asset', level: 3, parentCode: '1101', isPayable: true, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '110102', name: 'البنك', type: 'asset', level: 3, parentCode: '1101', isPayable: true, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '1102', name: 'العملاء', type: 'asset', level: 2, parentCode: '11', isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '1103', name: 'حسابات مدينة أخرى', type: 'asset', level: 2, parentCode: '11', isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '110301', name: 'مصروفات مدفوعة مقدماً', type: 'asset', level: 3, parentCode: '1103', isPayable: true, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '110302', name: 'سلف الموظفين', type: 'asset', level: 3, parentCode: '1103', isPayable: true, statement: 'Balance Sheet', balanceType: 'Debit' },
  
  { code: '12', name: 'الأصول غير المتداولة', type: 'asset', level: 1, parentCode: '1', isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '1201', name: 'الأصول الثابتة', type: 'asset', level: 2, parentCode: '12', isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '120101', name: 'أراضي', type: 'asset', level: 3, parentCode: '1201', isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' },
  { code: '120102', name: 'مباني وإنشاءات', type: 'asset', level: 3, parentCode: '1201', isPayable: false, statement: 'Balance Sheet', balanceType: 'Debit' },
  
  // Liabilities
  { code: '2', name: 'الالتزامات', type: 'liability', level: 0, parentCode: null, isPayable: false, statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '21', name: 'الالتزامات المتداولة', type: 'liability', level: 1, parentCode: '2', isPayable: false, statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '2101', name: 'الموردون', type: 'liability', level: 2, parentCode: '21', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '2102', name: 'حسابات دائنة أخرى', type: 'liability', level: 2, parentCode: '21', isPayable: false, statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '210201', name: 'رواتب وأجور مستحقة', type: 'liability', level: 3, parentCode: '2102', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '210202', name: 'مصروفات مستحقة', type: 'liability', level: 3, parentCode: '2102', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' },

  // Equity
  { code: '3', name: 'حقوق الملكية', type: 'equity', level: 0, parentCode: null, isPayable: false, statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '31', name: 'رأس المال', type: 'equity', level: 1, parentCode: '3', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '32', name: 'الأرباح المبقاة والخسائر المرحلة', type: 'equity', level: 1, parentCode: '3', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' },
  { code: '33', name: 'جاري الشركاء', type: 'equity', level: 1, parentCode: '3', isPayable: true, statement: 'Balance Sheet', balanceType: 'Credit' },

  // Income
  { code: '4', name: 'الإيرادات', type: 'income', level: 0, parentCode: null, isPayable: false, statement: 'Income Statement', balanceType: 'Credit' },
  { code: '41', name: 'إيرادات النشاط الرئيسي', type: 'income', level: 1, parentCode: '4', isPayable: false, statement: 'Income Statement', balanceType: 'Credit' },
  { code: '4101', name: 'إيرادات استشارات هندسية', type: 'income', level: 2, parentCode: '41', isPayable: true, statement: 'Income Statement', balanceType: 'Credit' },

  // Expenses
  { code: '5', name: 'التكاليف والمصروفات', type: 'expense', level: 0, parentCode: null, isPayable: false, statement: 'Income Statement', balanceType: 'Debit' },
  { code: '51', name: 'تكلفة الإيرادات', type: 'expense', level: 1, parentCode: '5', isPayable: false, statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5101', name: 'رسوم تراخيص حكومية', type: 'expense', level: 2, parentCode: '51', isPayable: true, statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5102', name: 'تكاليف المقاولين من الباطن', type: 'expense', level: 2, parentCode: '51', isPayable: true, statement: 'Income Statement', balanceType: 'Debit' },
  { code: '52', name: 'المصاريف العمومية والإدارية', type: 'expense', level: 1, parentCode: '5', isPayable: false, statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5201', name: 'مصروف الرواتب والأجور', type: 'expense', level: 2, parentCode: '52', isPayable: true, statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5202', name: 'مصاريف تسويق ومبيعات', type: 'expense', level: 2, parentCode: '52', isPayable: true, statement: 'Income Statement', balanceType: 'Debit' },
  { code: '5203', name: 'مصاريف إيجار المكتب', type: 'expense', level: 2, parentCode: '52', isPayable: true, statement: 'Income Statement', balanceType: 'Debit' },
];

    
