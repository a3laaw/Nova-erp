
/**
 * @fileOverview محرك الحسابات القانونية (HR & Labor Law Engine).
 * يطبق قوانين العمل في دولة الكويت (القطاع الأهلي) بدقة رياضية.
 */

import { differenceInDays, eachDayOfInterval, format, differenceInYears, differenceInMonths, addMonths } from 'date-fns';
import type { Employee, Holiday } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

/**
 * حساب أيام العمل الفعلية:
 * يستثني العطل الأسبوعية المحددة في الإعدادات والعطل الرسمية المسجلة.
 */
export function calculateWorkingDays(
  startDate: Date | undefined,
  endDate: Date | undefined,
  weeklyHolidays: string[],
  publicHolidays: Holiday[]
): { totalDays: number, workingDays: number } {
  if (!startDate || !endDate || startDate > endDate) {
    return { totalDays: 0, workingDays: 0 };
  }

  const totalDays = differenceInDays(endDate, startDate) + 1;
  const interval = { start: startDate, end: endDate };
  const allDaysInInterval = eachDayOfInterval(interval);

  const weeklyHolidayIndexes = new Set(weeklyHolidays.map(day => dayNameToIndex[day]));
  const publicHolidayDates = new Set(publicHolidays.map(h => {
      const d = toFirestoreDate(h.date);
      return d ? format(d, 'yyyy-MM-dd') : '';
  }).filter(Boolean));

  let workingDays = 0;

  for (const day of allDaysInInterval) {
    const dayIndex = day.getDay();
    const dateString = format(day, 'yyyy-MM-dd');
    
    if (!weeklyHolidayIndexes.has(dayIndex) && !publicHolidayDates.has(dateString)) {
      workingDays++;
    }
  }

  return { totalDays, workingDays };
}

/**
 * محرك تحليل شرائح الإجازة المرضية (Kuwaiti Labor Law Tiers)
 * - الأيام 1-15: 100% (أجر كامل) [e.gov.kw]
 * - الأيام 16-25: 75% [e.gov.kw]
 * - الأيام 26-35: 50% [e.gov.kw]
 * - الأيام 36-45: 25% [e.gov.kw]
 * - الأيام 46-75: 0% (بدون أجر) [e.gov.kw]
 */
export const calculateSickLeaveTiers = (totalUsedBefore: number, requestedDays: number) => {
  const tiers = [
    { start: 0, end: 15, rate: 1, label: 'بأجر كامل (100%)' },
    { start: 15, end: 25, rate: 0.75, label: 'بـ 75% من الأجر' },
    { start: 25, end: 35, rate: 0.5, label: 'بـ 50% من الأجر' },
    { start: 35, end: 45, rate: 0.25, label: 'بـ 25% من الأجر' },
    { start: 45, end: 75, rate: 0, label: 'بدون أجر (0%)' },
  ];

  const breakdown: { label: string; days: number; rate: number }[] = [];
  let remainingToDistribute = requestedDays;
  let currentUsedCounter = totalUsedBefore;

  for (const tier of tiers) {
    if (remainingToDistribute <= 0) break;
    if (currentUsedCounter >= tier.end) continue;

    const tierCapacity = tier.end - currentUsedCounter;
    const daysInThisTier = Math.min(remainingToDistribute, tierCapacity);

    if (daysInThisTier > 0) {
      breakdown.push({ label: tier.label, days: daysInThisTier, rate: tier.rate });
      remainingToDistribute -= daysInThisTier;
      currentUsedCounter += daysInThisTier;
    }
  }

  if (remainingToDistribute > 0) {
    breakdown.push({ label: 'بدون أجر (تجاوز 75 يوم)', days: remainingToDistribute, rate: 0 });
  }

  return breakdown;
};

/**
 * حساب رصيد الإجازات السنوية
 */
export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    const months = differenceInMonths(asOfDate, hireDate);
    const accrued = (months / 12) * 30;
    
    const used = employee.annualLeaveUsed || 0;
    const carried = employee.carriedLeaveDays || 0;

    const balance = accrued + carried - used;
    return Math.floor(Math.max(0, balance));
};

/**
 * محرك مكافأة نهاية الخدمة (مادة 51/53)
 */
export const calculateGratuity = (
    employee: Employee, 
    noticeStartDate: Date, 
    noticeType: 'worked' | 'indemnity' | 'waived' = 'waived'
) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return { 
        gratuity: 0, leaveBalancePay: 0, noticeIndemnity: 0, total: 0, notice: 'تاريخ تعيين غير صالح',
        yearsOfService: 0, lastSalary: 0, leaveBalance: 0, dailyWage: 0 
    };

    const salary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
    const dailyWage = salary / 26;

    if (salary === 0) {
        return { gratuity: 0, leaveBalancePay: 0, noticeIndemnity: 0, total: 0, notice: 'لم يتم تحديد راتب للموظف.', yearsOfService: 0, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    let effectiveEndDate = noticeStartDate;
    let noticeIndemnityValue = 0;

    if (noticeType === 'worked') {
        effectiveEndDate = addMonths(noticeStartDate, 3);
    } else if (noticeType === 'indemnity') {
        effectiveEndDate = noticeStartDate;
        noticeIndemnityValue = salary * 3;
    }

    const totalDays = differenceInDays(effectiveEndDate, hireDate);
    const years = totalDays / 365.25; 
    
    let rawGratuity = 0;

    if (years <= 5) {
        rawGratuity = years * 15 * dailyWage;
    } else {
        const firstFiveYearsGratuity = 5 * 15 * dailyWage;
        const remainingYears = years - 5;
        rawGratuity = firstFiveYearsGratuity + (remainingYears * salary);
    }

    const maxGratuity = 1.5 * 12 * salary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalGratuity = rawGratuity;
    let lawNotice = `بناءً على خدمة مدتها ${years.toFixed(2)} سنة.`;
    
    if (employee.terminationReason === 'misconduct') {
        finalGratuity = 0;
        lawNotice = "المادة 41: يُحرم الموظف من المكافأة نهائياً بسبب سوء سلوك جسيم.";
    } else if (employee.terminationReason === 'resignation') {
        if (years < 3) {
            finalGratuity = 0;
            lawNotice = "المادة 53: لا يستحق مكافأة لخدمة أقل من 3 سنوات في حالة الاستقالة.";
        } else if (years < 5) {
            finalGratuity = rawGratuity * 0.5;
            lawNotice = "المادة 53: يستحق نصف المكافأة لخدمة بين 3-5 سنوات.";
        } else if (years < 10) {
            finalGratuity = rawGratuity * (2/3);
            lawNotice = "المادة 53: يستحق ثلثي المكافأة لخدمة بين 5-10 سنوات.";
        }
    }

    const leaveBalance = calculateAnnualLeaveBalance(employee, effectiveEndDate);
    const leaveBalancePay = leaveBalance * dailyWage;

    return { 
        gratuity: finalGratuity, 
        leaveBalancePay, 
        noticeIndemnity: noticeIndemnityValue,
        total: finalGratuity + leaveBalancePay + noticeIndemnityValue, 
        notice: lawNotice,
        yearsOfService: years,
        lastSalary: salary,
        leaveBalance,
        dailyWage,
    };
};
