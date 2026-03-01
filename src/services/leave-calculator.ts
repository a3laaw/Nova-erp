import { differenceInDays, eachDayOfInterval, format, differenceInYears, differenceInMonths } from 'date-fns';
import type { Holiday, Employee } from '@/lib/types';
import { toFirestoreDate } from './date-converter';

/**
 * محرك حساب مستحقات نهاية الخدمة (Gratuity Engine):
 * يطبق المادة 51 من قانون العمل الكويتي بدقة متناهية.
 */
export const calculateGratuity = (employee: Employee, asOfDate: Date) => {
    const hireDate = toFirestoreDate(employee.hireDate);
    if (!hireDate) return { total: 0, notice: 'خطأ في تاريخ التعيين' };

    // 1. حساب مدة الخدمة بالسنوات
    const yearsOfService = differenceInDays(asOfDate, hireDate) / 365;
    
    // 2. حساب الراتب الشامل (الأساسي + البدلات)
    const lastSalary = (employee.basicSalary || 0) + (employee.housingAllowance || 0) + (employee.transportAllowance || 0);
    const dailyWage = lastSalary / 26; // أجر اليوم الواحد حسب العرف الكويتي

    let rawGratuity = 0;

    // 3. تطبيق معادلة السنوات الخمس الأولى (15 يوم عن كل سنة)
    if (yearsOfService <= 5) {
        rawGratuity = yearsOfService * 15 * dailyWage;
    } else {
        // 4. ما زاد عن 5 سنوات يحسب (شهر كامل عن كل سنة)
        const firstFiveYears = 5 * 15 * dailyWage;
        const remainingYears = yearsOfService - 5;
        rawGratuity = firstFiveYears + (remainingYears * lastSalary);
    }

    // 5. سقف المكافأة (لا تتجاوز أجر سنة ونصف)
    const maxGratuity = 1.5 * 12 * lastSalary;
    rawGratuity = Math.min(rawGratuity, maxGratuity);

    let finalAmount = rawGratuity;

    // 6. خصم الاستقالة (تعديل المستحق حسب سبب الترك)
    if (employee.terminationReason === 'resignation') {
        if (yearsOfService < 3) finalAmount = 0; // أقل من 3 سنوات: لا يستحق
        else if (yearsOfService < 5) finalAmount = rawGratuity * 0.5; // 3-5 سنوات: نصف المكافأة
        else if (yearsOfService < 10) finalAmount = rawGratuity * (2/3); // 5-10 سنوات: ثلثي المكافأة
        // أكثر من 10 سنوات: يستحقها كاملة
    }

    return {
        total: finalAmount,
        years: yearsOfService.toFixed(2),
        dailyWage: dailyWage.toFixed(3),
        notice: `تم الحساب بناءً على خدمة ${yearsOfService.toFixed(1)} سنة وراتب ${lastSalary} د.ك`
    };
};
