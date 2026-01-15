
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
 * Safely converts a string from an HTML input, a Date object, or a Timestamp 
 * into a valid JavaScript Date object, suitable for Firestore.
 * Returns null if the input is empty, null, or results in an invalid date.
 * This is for PREPARING data TO BE SENT to Firestore.
 * @param dateInput The date value from any source.
 * @returns A Date object or null.
 */
export function toFirestoreDate(dateInput: any): Date | null {
  if (!dateInput) {
    return null;
  }

  // Handle existing Date object
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  // Handle Firestore Timestamp
  if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    const d = dateInput.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  
  // Handle string (e.g., from <input type="date"> which is "yyyy-MM-dd")
  // or number (milliseconds from epoch)
  if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    try {
      // For strings, adding 'T00:00:00' helps prevent timezone-related off-by-one day errors
      // during local-to-UTC conversion by the Date constructor.
      const sanitizedInput = typeof dateInput === 'string' ? `${dateInput}T00:00:00` : dateInput;
      const d = new Date(sanitizedInput);
      return isNaN(d.getTime()) ? null : d;
    } catch (e) {
      console.error("Failed to convert input to Date object:", dateInput, e);
      return null;
    }
  }

  // If the type is unknown or invalid, return null.
  return null;
}

    