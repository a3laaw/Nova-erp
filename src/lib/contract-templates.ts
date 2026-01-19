import type { ContractTemplate } from './types';

export const contractTemplates: ContractTemplate[] = [
  {
    id: 'architectural-design-contract',
    // These match the types in client-transaction-form.tsx
    transactionTypes: ['تصميم بلدية (سكن خاص)', 'تصميم بلدية (تجاري)'], 
    title: 'عقد تصميم وإشراف لمشروع فيلا سكنية',
    totalAmount: 5000,
    clauses: [
      { id: 1, name: 'البند الأول: تقديم المخططات الأولية واعتمادها من المالك', amount: 1000, status: 'مدفوعة' },
      { id: 2, name: 'البند الثاني: تسليم مخططات البلدية والحصول على رخصة البناء', amount: 1500, status: 'مدفوعة' },
      { id: 3, name: 'البند الثالث: تسليم مخططات الكهرباء والماء وخدمات الدولة', amount: 1000, status: 'مستحقة' },
      { id: 4, name: 'البند الرابع: عند الانتهاء من صب سقف الدور الأول', amount: 750, status: 'غير مستحقة' },
      { id: 5, name: 'البند الخامس: عند التسليم النهائي للمشروع وإيصال التيار الكهربائي', amount: 750, status: 'غير مستحقة' },
    ]
  },
  // We can add more templates here in the future
];
