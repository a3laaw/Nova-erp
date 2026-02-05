
'use client';

import { Timestamp } from 'firebase/firestore';

/**
 * Safely converts various date-like inputs into a valid JavaScript Date object.
 * This function is non-recursive and designed to be robust against different data types.
 *
 * @param value - The value to convert. Can be a Date object, a Firestore Timestamp
 * (or an object with seconds/nanoseconds), a valid date string (like ISO), or a number (milliseconds).
 * @returns A valid Date object or `null` if the input is invalid or cannot be parsed.
 */
export function toFirestoreDate(value: any): Date | null {
    try {
        if (!value) return null;
        if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
        // Check for Firestore Timestamp
        if (value && typeof value.toDate === 'function') return value.toDate();
        // Check for serialized Timestamp { seconds, nanoseconds }
        if (typeof value === 'object' && 'seconds' in value) return new Date(value.seconds * 1000);
        // Check for String
        if (typeof value === 'string') {
            const d = new Date(value);
            return isNaN(d.getTime()) ? null : d;
        }
        if (typeof value === 'number') {
            const d = new Date(value);
            if (isNaN(d.getTime())) return null;
            return d;
        }
        return null;
    } catch {
        return null;
    }
}


/**
 * Safely formats a date-like value into a "yyyy-MM-dd" string for HTML date inputs.
 * Uses the robust `toFirestoreDate` function internally.
 * @param dateValue - The date value to format.
 * @returns A string in "yyyy-MM-dd" format, or an empty string if invalid.
 */
export function fromFirestoreDate(dateValue: any): string {
  const date = toFirestoreDate(dateValue);
  if (!date) {
    return '';
  }
  
  try {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Failed to format date from value:", dateValue, error);
    return '';
  }
}
