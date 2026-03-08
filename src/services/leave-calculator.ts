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
 * حساب رصيد الإجازات السنوية:
 * الموظف يكتسب 30 يوماً في السنة (أي 2.5 يوم عن كل شهر عمل فعلي).
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
 * محرك مكافأة نهاية الخدمة (Gratuity Engine) - قانون العمل الكويتي رقم 6 لسنة 2010
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

    // تحديد تاريخ انتهاء الخدمة بناءً على نوع الإنذار
    let effectiveEndDate = noticeStartDate;
    let noticeIndemnity = 0;

    if (noticeType === 'worked') {
        // الموظف داوم فترة الإنذار (3 أشهر) - تُضاف للخدمة
        effectiveEndDate = addMonths(noticeStartDate, 3);
    } else if (noticeType === 'indemnity') {
        // دفع بدل إنذار نقدي - الخدمة تنتهي الآن ولكن يُضاف راتب 3 أشهر
        effectiveEndDate = noticeStartDate;
        noticeIndemnity = salary * 3;
    }

    // حساب المدة بالسنوات
    const totalDays = differenceInDays(effectiveEndDate, hireDate);
    const years = totalDays / 365.25; 
    
    let rawGratuity = 0;

    // المادة 51: حساب المكافأة الأساسية
    if (years <= 5) {
        rawGratuity = years * 15 * dailyWage;
    } else {
        const firstFiveYearsGratuity = 5 * 15 * dailyWage;
        const remainingYears = years - 5;
        rawGratuity = firstFiveYearsGratuity + (remainingYears * salary);
    }

    // الحد الأقصى للمكافأة هو راتب 18 شهراً
    const maxGratuity = 1.5 * 12 * salary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalGratuity = rawGratuity;
    let lawNotice = `بناءً على خدمة مدتها ${years.toFixed(2)} سنة.`;

    // المادة 53: في حالة الاستقالة
    if (employee.terminationReason === 'resignation') {
        if (years < 3) {
            finalGratuity = 0;
            lawNotice = "المادة 53: لا يستحق الموظف مكافأة لخدمة أقل من 3 سنوات في حالة الاستقالة.";
        } else if (years < 5) {
            finalGratuity = rawGratuity * 0.5;
            lawNotice = "المادة 53: يستحق نصف المكافأة لخدمة بين 3 و 5 سنوات في حالة الاستقالة.";
        } else if (years < 10) {
            finalGratuity = rawGratuity * (2/3);
            lawNotice = "المادة 53: يستحق ثلثي المكافأة لخدمة بين 5 و 10 سنوات في حالة الاستقالة.";
        } else {
            lawNotice = "المادة 53: يستحق المكافأة كاملة لخدمة تزيد عن 10 سنوات.";
        }
    } else {
        if (years < 1) {
            finalGratuity = 0;
            lawNotice = "المادة 51: يشترط إتمام سنة واحدة لاستحقاق المكافأة في حالة إنهاء الخدمات.";
        } else {
            lawNotice = "المادة 51: يستحق الموظف المكافأة كاملة في حالة إنهاء الخدمات من طرف الشركة.";
        }
    }

    const leaveBalance = calculateAnnualLeaveBalance(employee, effectiveEndDate);
    const leaveBalancePay = leaveBalance * dailyWage;

    return { 
        gratuity: finalGratuity, 
        leaveBalancePay, 
        noticeIndemnity,
        total: finalGratuity + leaveBalancePay + noticeIndemnity, 
        notice: lawNotice,
        yearsOfService: years,
        lastSalary: salary,
        leaveBalance,
        dailyWage,
    };
};
