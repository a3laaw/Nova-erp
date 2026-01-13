
import { Timestamp } from 'firebase/firestore';

/**
 * Converts a Firestore Timestamp, a Date object, or an ISO string to a "yyyy-MM-dd" string format suitable for HTML date inputs.
 * Returns an empty string if the input is null, undefined, or invalid.
 * @param date - The date to convert (Timestamp, Date, string, null, or undefined).
 * @returns A string in "yyyy-MM-dd" format or an empty string.
 */
export function fromFirestoreDate(date: any): string {
  if (!date) {
    return '';
  }

  try {
    let d: Date;
    // Handle Firestore Timestamp
    if (date.toDate && typeof date.toDate === 'function') {
      d = date.toDate();
    } else {
      // Handle ISO string or existing Date object
      d = new Date(date);
    }

    // Check if the date is valid
    if (isNaN(d.getTime())) {
      return '';
    }

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;

  } catch (e) {
    console.error("Failed to format date from Firestore:", date, e);
    return '';
  }
}

/**
 * Converts a "yyyy-MM-dd" string from an HTML input to a JavaScript Date object.
 * Returns null if the input string is empty, null, or invalid.
 * @param dateString - The date string in "yyyy-MM-dd" format.
 * @returns A Date object or null.
 */
export function toFirestoreDate(dateString: string | null | undefined | Date | Timestamp): Date | null {
  // If it's already a Date or Timestamp, handle it
  if (dateString instanceof Date) {
    return isNaN(dateString.getTime()) ? null : dateString;
  }
  if (dateString instanceof Timestamp) {
    return dateString.toDate();
  }
  
  if (!dateString) {
    return null;
  }

  try {
    // Add time component to avoid timezone issues where the date might be interpreted as the previous day
    const d = new Date(`${dateString}T00:00:00`); 
    
    if (isNaN(d.getTime())) {
      return null;
    }
    return d;
  } catch (e) {
    console.error("Failed to convert date string to Firestore date:", dateString, e);
    return null;
  }
}
