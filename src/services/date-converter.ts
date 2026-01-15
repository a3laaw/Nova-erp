
'use client';

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
    // Handle Firestore Timestamp specifically and correctly
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
 * Converts a "yyyy-MM-dd" string from an HTML input or any other date representation to a JavaScript Date object.
 * Returns null if the input string is empty, null, or invalid.
 * @param dateInput - The date value from any source (string, Date, Timestamp, null, undefined).
 * @returns A Date object or null.
 */
export function toFirestoreDate(dateInput: any): Date | null {
  if (!dateInput) {
    return null;
  }

  // If it's already a Date object
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  // If it's a Firestore Timestamp
  if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    const d = dateInput.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  
  // If it's a string
  if (typeof dateInput === 'string') {
    try {
      // Add time component to avoid timezone issues where the date might be interpreted as the previous day
      const d = new Date(`${dateInput}T00:00:00`); 
      
      if (isNaN(d.getTime())) {
        // Try parsing without time for robustness if the first attempt fails
        const d2 = new Date(dateInput);
        return isNaN(d2.getTime()) ? null : d2;
      }
      return d;
    } catch (e) {
      console.error("Failed to convert date string to Date object:", dateInput, e);
      return null;
    }
  }

  // If it's a number (milliseconds from epoch)
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }

  // If we can't determine the type, return null
  return null;
}
