/**
 * @fileoverview Date utility functions for garden maintenance scheduling
 * Provides optimized date manipulation and formatting functions with comprehensive error handling
 * @version 1.0.0
 */

import { format, addDays, differenceInDays, startOfDay } from 'date-fns';
import { Schedule } from '../types/schedule.types';

/**
 * Error messages for date operations
 */
const DATE_ERROR_MESSAGES = {
    INVALID_DATE: 'Invalid date provided',
    INVALID_INTERVAL: 'Interval days must be a positive number',
    INVALID_RANGE: 'Invalid date range: start date must be before end date',
    FALLBACK_FORMAT: 'Invalid Date'
} as const;

/**
 * Standard date format for the application
 */
const STANDARD_DATE_FORMAT = 'MMM dd, yyyy';

/**
 * Validates if the provided value is a valid Date object
 * @param date - Value to validate as Date
 * @returns True if valid Date object
 */
const isValidDate = (date: Date): boolean => {
    return date instanceof Date && !isNaN(date.getTime());
};

/**
 * Calculates the next schedule date based on last completion and interval
 * @param lastCompletionDate - Date of last task completion
 * @param intervalDays - Number of days between tasks
 * @throws Error if invalid date or interval provided
 * @returns Next scheduled date normalized to start of day
 */
export const calculateNextScheduleDate = (lastCompletionDate: Date, intervalDays: number): Date => {
    if (!isValidDate(lastCompletionDate)) {
        throw new Error(DATE_ERROR_MESSAGES.INVALID_DATE);
    }

    if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
        throw new Error(DATE_ERROR_MESSAGES.INVALID_INTERVAL);
    }

    const normalizedDate = startOfDay(lastCompletionDate);
    return startOfDay(addDays(normalizedDate, intervalDays));
};

/**
 * Checks if a date falls within a specified date range
 * @param date - Date to check
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @throws Error if invalid dates provided or invalid range
 * @returns True if date is within range
 */
export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
    if (!isValidDate(date) || !isValidDate(startDate) || !isValidDate(endDate)) {
        throw new Error(DATE_ERROR_MESSAGES.INVALID_DATE);
    }

    const normalizedDate = startOfDay(date);
    const normalizedStart = startOfDay(startDate);
    const normalizedEnd = startOfDay(endDate);

    if (normalizedStart > normalizedEnd) {
        throw new Error(DATE_ERROR_MESSAGES.INVALID_RANGE);
    }

    return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
};

/**
 * Formats a date according to the application's standard format
 * @param date - Date to format
 * @returns Formatted date string or fallback for invalid dates
 */
export const formatScheduleDate = (date: Date): string => {
    if (!isValidDate(date)) {
        return DATE_ERROR_MESSAGES.FALLBACK_FORMAT;
    }

    try {
        return format(startOfDay(date), STANDARD_DATE_FORMAT);
    } catch {
        return DATE_ERROR_MESSAGES.FALLBACK_FORMAT;
    }
};

/**
 * Calculates the absolute difference between two dates in days
 * @param date1 - First date
 * @param date2 - Second date
 * @throws Error if invalid dates provided
 * @returns Absolute number of days between dates
 */
export const calculateDateDifference = (date1: Date, date2: Date): number => {
    if (!isValidDate(date1) || !isValidDate(date2)) {
        throw new Error(DATE_ERROR_MESSAGES.INVALID_DATE);
    }

    const normalizedDate1 = startOfDay(date1);
    const normalizedDate2 = startOfDay(date2);

    return Math.abs(differenceInDays(normalizedDate1, normalizedDate2));
};

/**
 * Returns the start of day for a given date
 * @param date - Date to normalize
 * @throws Error if invalid date provided
 * @returns Date object set to start of day
 */
export const getStartOfDay = (date: Date): Date => {
    if (!isValidDate(date)) {
        throw new Error(DATE_ERROR_MESSAGES.INVALID_DATE);
    }

    return startOfDay(date);
};