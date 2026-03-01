/**
 * @fileOverview محرك الحسابات القانونية (HR Logic Engine).
 * يطبق قوانين العمل في دولة الكويت بدقة رياضية.
 */

import { differenceInDays, differenceInMonths } from 'date-fns';
import type { Employee } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

/**
 * حساب رصيد الإجازات السنوية:
 * الموظف يكتسب 30 يوماً في السنة (2.5 يوم شهرياً).
 */
export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // حساب أشهر الخدمة من تاريخ التعيين
    const months = differenceInMonths(asOfDate, hireDate);
    const accrued = (months / 12) * 30; // الرصيد المكتسب
    
    const used = employee.annualLeaveUsed || 0;
    const carried = employee.carriedLeaveDays || 0;

    // الرصيد النهائي = المكتسب + المرحل - المستخدم
    const balance = accrued + carried - used;
    return Math.floor(Math.max(0, balance));
};

/**
 * محرك مكافأة نهاية الخدمة (Gratuity Engine):
 * يطبق المادة 51 من قانون العمل الكويتي.
 */
export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return { total: 0, notice: 'تاريخ تعيين غير صالح' };

    const years = differenceInDays(asOfDate, hireDate) / 365;
    const salary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
    const dailyWage = salary / 26; // أجر اليوم القانوني

    let gratuity = 0;

    // الشرائح القانونية
    if (years <= 5) {
        gratuity = years * 15 * dailyWage; // 15 يوماً عن كل سنة في أول 5 سنوات
    } else {
        gratuity = (5 * 15 * dailyWage) + ((years - 5) * salary); // شهر كامل عن كل سنة بعد الخامسة
    }

    // سقف المكافأة: لا تتجاوز أجر 18 شهراً
    gratuity = Math.min(gratuity, 1.5 * 12 * salary);

    // معامل الاستقالة
    if (employee.terminationReason === 'resignation') {
        if (years < 3) gratuity = 0;
        else if (years < 5) gratuity *= 0.5;
        else if (years < 10) gratuity *= 0.66;
    }

    const leavePay = calculateAnnualLeaveBalance(employee, asOfDate) * dailyWage;

    return { 
        gratuity, 
        leavePay, 
        total: gratuity + leavePay,
        yearsOfService: years
    };
};
