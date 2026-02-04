
'use client';

import { Timestamp } from 'firebase/firestore';

/**
 * Safely converts various date-like inputs into a valid JavaScript Date object.
 * This function is non-recursive and designed to be robust against different data types.
 *
 * @param dateInput - The value to convert. Can be a Date object, a Firestore Timestamp
 * (or an object with seconds/nanoseconds), a valid date string (like ISO), or a number (milliseconds).
 * @returns A valid Date object or `null` if the input is invalid or cannot be parsed.
 */
export function toFirestoreDate(dateInput: any): Date | null {
  // Return null for any falsy input (null, undefined, 0, '', false)
  if (!dateInput) {
    return null;
  }

  try {
    // 1. Handle existing JS Date objects
    if (dateInput instanceof Date) {
      if (isNaN(dateInput.getTime())) return null; // Check for invalid Date
      return dateInput;
    }

    // 2. Handle Firestore Timestamp objects with a toDate method
    if (typeof dateInput.toDate === 'function') {
        const d = dateInput.toDate();
        if (isNaN(d.getTime())) return null;
        return d;
    }

    // 3. Handle object literals { seconds, nanoseconds } from serialized Timestamps
    if (
      typeof dateInput === 'object' &&
      dateInput !== null &&
      'seconds' in dateInput &&
      'nanoseconds' in dateInput &&
      typeof dateInput.seconds === 'number' &&
      typeof dateInput.nanoseconds === 'number'
    ) {
      const d = new Timestamp(dateInput.seconds, dateInput.nanoseconds).toDate();
      if (isNaN(d.getTime())) return null;
      return d;
    }

    // 4. Handle string inputs (ISO strings, "yyyy-MM-dd", etc.)
    if (typeof dateInput === 'string') {
      const sanitizedInput = /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
        ? `${dateInput}T00:00:00`
        : dateInput;
      const d = new Date(sanitizedInput);
      if (isNaN(d.getTime())) return null;
      return d;
    }

    // 5. Handle number (milliseconds from epoch)
    if (typeof dateInput === 'number') {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return null;
      return d;
    }
  } catch (error) {
    console.error("Error converting value to Date:", dateInput, error);
    return null; // Fail safely
  }

  // If the input type is unknown or unhandled, return null.
  return null;
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
