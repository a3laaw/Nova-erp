import type { ContractTemplate } from './types';

export const contractTemplates: ContractTemplate[] = [
  {
    id: 'architectural-design-contract',
    // This template is now specific to private residence architectural design
    transactionTypes: ['تصميم بلدية (سكن خاص)'], 
    title: 'اتفاقية تصميم سكن خاص',
    totalAmount: 800,
    clauses: [
      { id: 1, name: 'الدفعة الأولى: عند توقيع العقد', amount: 300, status: 'مستحقة' },
      { id: 2, name: 'الدفعة الثانية: عند الانتهاء من الأرضي', amount: 150, status: 'غير مستحقة' },
      { id: 3, name: 'الدفعة الثالثة: عند الانتهاء من الدور الأول', amount: 150, status: 'غير مستحقة' },
      { id: 4, name: 'الدفعة الرابعة: عند الانتهاء من الدور الثاني', amount: 100, status: 'غير مستحقة' },
      { id: 5, name: 'الدفعة الخامسة: عند استلام رخصة البناء', amount: 100, status: 'غير مستحقة' },
    ]
  },
  {
    id: 'supply-install-contract',
    transactionTypes: ['عقد توريد وتركيب'],
    title: 'عقد توريد وتركيب',
    totalAmount: 1500,
    clauses: [
      { id: 1, name: 'توريد و تركيب مواد صحية', amount: 500, status: 'مستحقة' },
      { id: 2, name: 'توريد و تركيب مواد كهربائية', amount: 500, status: 'غير مستحقة' },
      { id: 3, name: 'توريد و تركيب رخام', amount: 500, status: 'غير مستحقة' },
    ]
  }
];
