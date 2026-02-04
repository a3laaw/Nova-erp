
'use client';
import { Timestamp } from 'firebase/firestore';

/**
 * Safely converts a Firestore Timestamp, a Date object, or a valid date string 
 * into a "yyyy-MM-dd" string format, suitable for HTML date inputs.
 * Returns an empty string for any invalid or nullish input.
 * This is for READING data FROM Firestore/other sources for DISPLAY.
 * @param dateValue The date to convert (Timestamp, Date, string, null, or undefined).
 * @returns A string in "yyyy-MM-dd" format or an empty string.
 */
export function fromFirestoreDate(dateValue: any): string {
  if (!dateValue) {
    return '';
  }

  try {
    let date: Date;

    // Handle Firestore Timestamp
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      date = dateValue.toDate();
    } 
    // Handle existing Date object
    else if (dateValue instanceof Date) {
      date = dateValue;
    } 
    // Handle string or number
    else {
      date = new Date(dateValue);
    }

    // Check for invalid date
    if (isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    // getMonth() is 0-indexed, so we add 1
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;

  } catch (error) {
    console.error("Failed to format date from value:", dateValue, error);
    return '';
  }
}

/**
 * Safely converts a string, Date object, or Timestamp-like object into a valid JavaScript Date object.
 * This function is non-recursive and designed to be safe from stack overflows.
 * Returns null if the input is empty, null, or results in an invalid date.
 * @param dateInput The date value from any source.
 * @returns A Date object or null.
 */
export function toFirestoreDate(dateInput: any): Date | null {
  if (!dateInput) {
    return null;
  }

  try {
    // Handle existing Date object
    if (dateInput instanceof Date) {
      return isNaN(dateInput.getTime()) ? null : dateInput;
    }

    // Handle Firestore Timestamp
    if (dateInput.toDate && typeof dateInput.toDate === 'function') {
      const d = dateInput.toDate();
      return isNaN(d.getTime()) ? null : d;
    }

    // Handle serialized Firestore Timestamp object (e.g., from cache or JSON.stringify)
    if (typeof dateInput === 'object' && dateInput !== null && 'seconds' in dateInput && 'nanoseconds' in dateInput) {
      const d = new Date(dateInput.seconds * 1000 + dateInput.nanoseconds / 1000000);
      return isNaN(d.getTime()) ? null : d;
    }
    
    // Handle string formats
    if (typeof dateInput === 'string') {
      let d: Date;
      // Prefer creating date from ISO string to avoid timezone issues.
      // Add T00:00:00 for "yyyy-MM-dd" to ensure it's parsed as local time start of day.
      const sanitizedInput = /^\d{4}-\d{2}-\d{2}$/.test(dateInput) ? `${dateInput}T00:00:00` : dateInput;
      d = new Date(sanitizedInput);
      return isNaN(d.getTime()) ? null : d;
    }
    
    // Handle number (milliseconds from epoch)
    if (typeof dateInput === 'number') {
        const d = new Date(dateInput);
        return isNaN(d.getTime()) ? null : d;
    }
  } catch (error) {
    console.error("Error converting value to Date:", dateInput, error);
    return null;
  }

  // If the type is unknown or invalid, return null.
  return null;
}
