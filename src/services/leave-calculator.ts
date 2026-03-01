import { differenceInDays, differenceInMonths, differenceInYears } from 'date-fns';
import type { Employee } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

/**
 * @fileOverview عقل حسابات الموارد البشرية (HR Logic Engine).
 * يحتوي على المعادلات القانونية والرياضية الدقيقة وفقاً لقانون العمل الكويتي.
 */

/**
 * دالة حساب رصيد الإجازات السنوية:
 * الرصيد المعتمد هو 30 يوماً في السنة (2.5 يوم لكل شهر عمل).
 */
export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // حساب إجمالي أشهر الخدمة
    const totalMonthsOfService = differenceInMonths(asOfDate, hireDate);
    
    // الموظف يكتسب 2.5 يوم عن كل شهر
    const totalAccrued = (totalMonthsOfService / 12) * 30;
    
    const usedLeave = employee.annualLeaveUsed || 0;
    const carriedOver = employee.carriedLeaveDays || 0;

    // المعادلة: المكتسب + المرحل - المستخدم
    const balance = totalAccrued + carriedOver - usedLeave;

    return Math.floor(balance > 0 ? balance : 0);
};

/**
 * محرك مكافأة نهاية الخدمة (Gratuity Engine):
 * يطبق المادة 51 من قانون العمل الكويتي للقطاع الأهلي بدقة.
 */
export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return { total: 0, notice: 'تاريخ التعيين غير صالح' };

    const yearsOfService = differenceInDays(asOfDate, hireDate) / 365;
    const lastSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
    const dailyWage = lastSalary / 26; // أجر اليوم الواحد حسب العرف المحاسبي الكويتي

    let rawGratuity = 0;

    // تطبيق شرائح سنوات الخدمة
    if (yearsOfService <= 5) {
        // الـ 5 سنوات الأولى: أجر 15 يوماً عن كل سنة
        rawGratuity = yearsOfService * 15 * dailyWage;
    } else {
        // ما زاد عن 5 سنوات: أجر 15 يوماً للخمس الأولى + أجر شهر كامل لكل سنة بعدها
        const firstFiveYearsGratuity = 5 * 15 * dailyWage;
        const subsequentYears = yearsOfService - 5;
        rawGratuity = firstFiveYearsGratuity + (subsequentYears * lastSalary);
    }

    // سقف المكافأة القانوني: لا تتجاوز أجر سنة ونصف (18 شهراً)
    const maxGratuity = 1.5 * 12 * lastSalary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalGratuity = rawGratuity;
    let notice = `بناءً على ${yearsOfService.toFixed(1)} سنة خدمة.`;

    // تعديل المستحق في حال الاستقالة (معامل الاستحقاق)
    if (employee.terminationReason === 'resignation') {
        if (yearsOfService < 3) {
            finalGratuity = 0;
            notice += " (الاستقالة قبل 3 سنوات: لا يستحق مكافأة)";
        } else if (yearsOfService < 5) {
            finalGratuity = rawGratuity * 0.5;
            notice += " (الاستقالة بين 3-5 سنوات: يستحق النصف)";
        } else if (yearsOfService < 10) {
            finalGratuity = rawGratuity * (2/3);
            notice += " (الاستقالة بين 5-10 سنوات: يستحق الثلثين)";
        }
    }

    const leaveBalance = calculateAnnualLeaveBalance(employee, asOfDate);
    const leaveBalancePay = leaveBalance * dailyWage;

    return { 
        gratuity: finalGratuity, 
        leaveBalancePay, 
        total: finalGratuity + leaveBalancePay, 
        notice,
        yearsOfService,
        lastSalary,
        leaveBalance,
        dailyWage
    };
};
