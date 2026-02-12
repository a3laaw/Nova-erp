import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'KWD',
  }).format(amount);
}

function tafqeet(n: number, currency: { singular: string, dual: string, plural: string, accusative: string }): string {
    if (n === 0) return '';
    
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    function convert(num: number): string {
        if (num < 10) return ones[num];
        if (num < 20) return teens[num - 10];
        if (num < 100) {
            const t = Math.floor(num / 10);
            const o = num % 10;
            return (o > 0 ? ones[o] + ' و' : '') + tens[t];
        }
        if (num < 1000) {
            const h = Math.floor(num / 100);
            const rest = num % 100;
            return hundreds[h] + (rest > 0 ? ' و' + convert(rest) : '');
        }
        if (num < 1000000) {
            const th = Math.floor(num / 1000);
            const rest = num % 1000;
            let thText = '';
            if (th === 1) thText = 'ألف';
            else if (th === 2) thText = 'ألفان';
            else if (th >= 3 && th <= 10) thText = convert(th) + ' آلاف';
            else thText = convert(th) + ' ألف';
            return thText + (rest > 0 ? ' و' + convert(rest) : '');
        }
        if (num < 1000000000) {
            const m = Math.floor(num / 1000000);
            const rest = num % 1000000;
            let mText = '';
            if (m === 1) mText = 'مليون';
            else if (m === 2) mText = 'مليونان';
            else if (m >= 3 && m <= 10) mText = convert(m) + ' ملايين';
            else mText = convert(m) + ' مليون';
            return mText + (rest > 0 ? ' و' + convert(rest) : '');
        }
        const b = Math.floor(n / 1000000000);
        const rest = n % 1000000000;
         let bText = '';
        if (b === 1) bText = 'مليار';
        else if (b === 2) bText = 'ملياران';
        else if (b >= 3 && b <= 10) bText = convert(b) + ' مليارات';
        else bText = convert(b) + ' مليار';
        return bText + (rest > 0 ? ' و' + convert(rest) : '');
    }

    function getUnit(num: number) {
        const lastTwo = num % 100;
        if (num === 1) return currency.singular;
        if (num === 2) return currency.dual;
        if (lastTwo >= 3 && lastTwo <= 10) return currency.plural;
        return currency.accusative;
    }
    
    const words = convert(n);
    const unit = getUnit(n);

    return words + ' ' + unit;
}


export function numberToArabicWords(inputNumber: number | string): string {
    const num = parseFloat(String(inputNumber).replace(/,/g, ''));
    if (isNaN(num)) return '';
    if (num === 0) return 'فقط صفر دينار كويتي لا غير';

    const dinars = Math.floor(num);
    const fils = Math.round((num - dinars) * 1000);

    const dinarCurrency = { singular: 'دينار كويتي', dual: 'ديناران كويتيان', plural: 'دنانير كويتية', accusative: 'ديناراً كويتياً' };
    const filsCurrency = { singular: 'فلس', dual: 'فلسان', plural: 'فلوس', accusative: 'فلساً' };

    let result = [];
    if (dinars > 0) {
        result.push(tafqeet(dinars, dinarCurrency));
    }
    if (fils > 0) {
        result.push(tafqeet(fils, filsCurrency));
    }
    
    if (result.length === 0) return '';
    
    return 'فقط ' + result.join(' و') + ' لا غير';
}


export function cleanFirestoreData(data: any): any {
  if (Array.isArray(data)) {
    return data.map(item => cleanFirestoreData(item));
  }
  if (data && typeof data === 'object' && !(data instanceof Date) && typeof data.toDate !== 'function') {
    // This is a plain object, not a Date or Timestamp
    const cleanedData: { [key: string]: any } = {};
    for (const key in data) {
      if (data[key] !== undefined) {
        // Recurse for nested objects
        cleanedData[key] = cleanFirestoreData(data[key]);
      }
    }
    return cleanedData;
  }
  // Return primitives, Dates, Timestamps, and serverTimestamp() sentinels as is
  // `undefined` values will be skipped by the loop above.
  return data;
}
