/**
 * @fileOverview محرك الحسابات القانونية (HR & Labor Law Engine).
 * يطبق قوانين العمل في دولة الكويت (القطاع الأهلي) بدقة رياضية.
 */

import { differenceInDays, differenceInMonths } from 'date-fns';
import type { Employee } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

/**
 * حساب رصيد الإجازات السنوية:
 * الموظف يكتسب 30 يوماً في السنة (أي 2.5 يوم عن كل شهر عمل فعلي).
 * المعادلة: (أشهر الخدمة * 2.5) + الرصيد المرحل - الرصid المستخدم.
 */
export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // حساب إجمالي أشهر الخدمة من تاريخ التعيين حتى تاريخ الحساب
    const months = differenceInMonths(asOfDate, hireDate);
    const accrued = (months / 12) * 30; // الرصيد المكتسب قانونياً
    
    const used = employee.annualLeaveUsed || 0;
    const carried = employee.carriedLeaveDays || 0;

    // الرصيد النهائي = المكتسب + المرحل من سنوات سابقة - المستخدم فعلياً
    const balance = accrued + carried - used;
    return Math.floor(Math.max(0, balance)); // تقريب للأدنى لضمان عدم تجاوز الاستحقاق
};

/**
 * محرك مكافأة نهاية الخدمة (Gratuity Engine):
 * يطبق المادة 51 من قانون العمل الكويتي رقم 6 لسنة 2010.
 * 
 * القواعد:
 * 1. أول 5 سنوات: 15 يوماً عن كل سنة.
 * 2. ما بعد 5 سنوات: شهر كامل عن كل سنة.
 * 3. سقف المكافأة: لا تتجاوز أجر 18 شهراً.
 * 4. معامل الاستقالة: 
 *    - أقل من 3 سنوات: 0%
 *    - 3 إلى 5 سنوات: 50%
 *    - 5 إلى 10 سنوات: 66%
 *    - أكثر من 10 سنوات: 100%
 */
export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return { total: 0, notice: 'تاريخ تعيين غير صالح' };

    const totalDays = differenceInDays(asOfDate, hireDate);
    const years = totalDays / 365;
    
    // الأجر الشامل (أساسي + بدلات ثابتة)
    const salary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
    const dailyWage = salary / 26; // أجر اليوم الواحد حسب العرف القانوني الكويتي

    let gratuity = 0;

    // المرحلة 1: حساب المكافأة الخام بناءً على سنوات الخدمة
    if (years <= 5) {
        gratuity = years * 15 * dailyWage;
    } else {
        const firstFiveYears = 5 * 15 * dailyWage;
        const remainingYears = years - 5;
        gratuity = firstFiveYears + (remainingYears * salary);
    }

    // المرحلة 2: تطبيق سقف الـ 18 شهراً
    const cap = 1.5 * 12 * salary;
    gratuity = Math.min(gratuity, cap);

    // المرحلة 3: تطبيق معامل الاستقالة (في حال كان الموظف هو من استقال)
    if (employee.terminationReason === 'resignation') {
        if (years < 3) gratuity = 0;
        else if (years < 5) gratuity *= 0.5;
        else if (years < 10) gratuity *= 0.666;
        // فوق 10 سنوات يستحق المكافأة كاملة
    }

    // المرحلة 4: إضافة بدل رصيد الإجازات غير المستخدم (يُصرف نقداً عند انتهاء الخدمة)
    const leaveBalance = calculateAnnualLeaveBalance(employee, asOfDate);
    const leavePay = leaveBalance * dailyWage;

    return { 
        gratuityAmount: gratuity, 
        leavePayAmount: leavePay, 
        total: gratuity + leavePay,
        yearsOfService: years,
        dailyRate: dailyWage
    };
};
