
'use client';

import { Timestamp } from 'firebase/firestore';

/**
 * Converts a Firestore Timestamp, a Date object, or an ISO string to a "yyyy-MM-dd" string format suitable for HTML date inputs.
 * This function is for READING data FROM Firestore and displaying it.
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
    // Handle Firestore Timestamp specifically
    if (date.toDate && typeof date.toDate === 'function') {
      d = date.toDate();
    } else {
      // Handle ISO string, number (milliseconds), or existing Date object
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
 * Converts a string from an HTML input, a Date object, or a Timestamp to a valid JavaScript Date object.
 * This function is for PREPARING data TO BE SENT to Firestore.
 * Returns null if the input is empty, null, or invalid.
 * @param dateInput - The date value from any source (string, Date, Timestamp, null, undefined).
 * @returns A Date object or null.
 */
export function toFirestoreDate(dateInput: any): Date | null {
  if (!dateInput) {
    return null;
  }

  // If it's already a valid Date object, return it.
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  // If it's a Firestore Timestamp, convert it.
  if (dateInput.toDate && typeof dateInput.toDate === 'function') {
    const d = dateInput.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  
  // If it's a string (e.g., from an input[type=date] which is "yyyy-MM-dd")
  if (typeof dateInput === 'string') {
    try {
      // Add T00:00:00 to handle timezone properly and avoid off-by-one day errors.
      const d = new Date(`${dateInput}T00:00:00`); 
      return isNaN(d.getTime()) ? null : d;
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

  // If the type is unknown or invalid, return null.
  return null;
}
