import { differenceInDays, eachDayOfInterval, format, differenceInYears, differenceInMonths } from 'date-fns';
import type { Holiday, Employee } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

const dayNameToIndex: Record<string, number> = {
  'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
  'Thursday': 4, 'Friday': 5, 'Saturday': 6
};

/**
 * حساب أيام العمل الفعلية بين تاريخين مع استبعاد العطلات الرسمية والأسبوعية.
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
  const publicHolidayDates = new Set(publicHolidays.map(h => format(toFirestoreDate(h.date)!, 'yyyy-MM-dd')));

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
 * حساب رصيد الإجازات السنوية المتبقي للموظف بناءً على تاريخ التعيين والخصومات.
 */
export const calculateAnnualLeaveBalance = (employee: Partial<Employee>, asOfDate: Date): number => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return 0;

    // الاحتساب بناءً على 30 يوم إجازة لكل سنة عمل (2.5 يوم لكل شهر)
    const totalMonthsOfService = differenceInMonths(asOfDate, hireDate);
    const totalAccrued = (totalMonthsOfService / 12) * 30;
    
    const usedLeave = employee.annualLeaveUsed || 0;
    const carriedOver = employee.carriedLeaveDays || 0;

    const balance = totalAccrued + carriedOver - usedLeave;

    return Math.floor(balance > 0 ? balance : 0);
};

/**
 * حساب مكافأة نهاية الخدمة وفقاً لقانون العمل الكويتي (المادة 51).
 */
export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) {
      return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'تاريخ التعيين غير صالح.', yearsOfService: 0, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    const yearsOfService = differenceInYears(asOfDate, hireDate);
    const lastSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);

    if (lastSalary === 0) {
        return { gratuity: 0, leaveBalancePay: 0, total: 0, notice: 'لم يتم تحديد راتب للموظف.', yearsOfService, lastSalary: 0, leaveBalance: 0, dailyWage: 0 };
    }

    let rawGratuity = 0;
    const dailyWage = lastSalary / 26; // الممارسة الشائعة في الكويت هي القسمة على 26 يوم عمل

    // معادلة المادة 51
    if (yearsOfService <= 5) {
        // أجر 15 يوماً عن كل سنة من السنوات الخمس الأولى
        rawGratuity = yearsOfService * 15 * dailyWage;
    } else {
        // أجر 15 يوماً عن أول 5 سنوات + أجر شهر كامل عن كل سنة تليها
        const firstFiveYearsGratuity = 5 * 15 * dailyWage;
        const subsequentYears = yearsOfService - 5;
        const subsequentYearsGratuity = subsequentYears * lastSalary;
        rawGratuity = firstFiveYearsGratuity + subsequentYearsGratuity;
    }

    // الحد الأقصى للمكافأة هو أجر سنة ونصف
    const maxGratuity = 1.5 * 12 * lastSalary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalGratuity = rawGratuity;
    let notice = `بناءً على ${yearsOfService.toFixed(1)} سنوات من الخدمة.`;

    // تعديلات في حال الاستقالة (قانون العمل الكويتي)
    if (employee.terminationReason === 'resignation') {
        if (yearsOfService < 3) {
            finalGratuity = 0;
            notice += " (لا يستحق مكافأة لخدمة أقل من 3 سنوات عند الاستقالة)";
        } else if (yearsOfService < 5) {
            finalGratuity = rawGratuity * 0.5;
             notice += " (يستحق نصف المكافأة لخدمة بين 3-5 سنوات عند الاستقالة)";
        } else if (yearsOfService < 10) {
            finalGratuity = rawGratuity * (2 / 3);
            notice += " (يستحق ثلثي المكافأة لخدمة بين 5-10 سنوات عند الاستقالة)";
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
        dailyWage,
    };
};
