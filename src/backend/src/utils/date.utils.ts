import moment from 'moment'; // ^2.29.0

// Global constants
const DATE_FORMAT = 'YYYY-MM-DD';

const ERRORS = {
    INVALID_DATE: 'Invalid date provided',
    INVALID_RANGE: 'Invalid date range',
    INVALID_INTERVAL: 'Invalid interval days'
} as const;

/**
 * Custom error class for date-related errors
 */
class DateUtilError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DateUtilError';
    }
}

/**
 * Validates if the provided value is a valid Date object
 * @param date - Value to validate
 * @throws {DateUtilError} If date is invalid
 */
const validateDate = (date: Date): void => {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        throw new DateUtilError(ERRORS.INVALID_DATE);
    }
};

/**
 * Calculates the next schedule date based on the last completion date and interval
 * @param lastCompletionDate - Date of last task completion
 * @param intervalDays - Number of days between schedules
 * @returns Next scheduled date
 * @throws {DateUtilError} If inputs are invalid
 */
export const calculateNextScheduleDate = (lastCompletionDate: Date, intervalDays: number): Date => {
    try {
        validateDate(lastCompletionDate);

        if (!Number.isInteger(intervalDays) || intervalDays <= 0) {
            throw new DateUtilError(ERRORS.INVALID_INTERVAL);
        }

        const nextDate = moment(lastCompletionDate)
            .add(intervalDays, 'days')
            .toDate();

        return nextDate;
    } catch (error) {
        if (error instanceof DateUtilError) {
            throw error;
        }
        throw new DateUtilError(ERRORS.INVALID_DATE);
    }
};

/**
 * Checks if a date falls within a specified date range
 * @param date - Date to check
 * @param startDate - Start of date range
 * @param endDate - End of date range
 * @returns Boolean indicating if date is within range
 * @throws {DateUtilError} If any date is invalid or range is invalid
 */
export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
    try {
        validateDate(date);
        validateDate(startDate);
        validateDate(endDate);

        if (moment(endDate).isBefore(startDate)) {
            throw new DateUtilError(ERRORS.INVALID_RANGE);
        }

        const normalizedDate = moment(date).startOf('day');
        const normalizedStart = moment(startDate).startOf('day');
        const normalizedEnd = moment(endDate).startOf('day');

        return normalizedDate.isBetween(normalizedStart, normalizedEnd, 'day', '[]');
    } catch (error) {
        if (error instanceof DateUtilError) {
            throw error;
        }
        throw new DateUtilError(ERRORS.INVALID_DATE);
    }
};

/**
 * Formats a date according to the application's standard format (YYYY-MM-DD)
 * @param date - Date to format
 * @returns Formatted date string
 * @throws {DateUtilError} If date is invalid
 */
export const formatScheduleDate = (date: Date): string => {
    try {
        validateDate(date);
        return moment(date).format(DATE_FORMAT);
    } catch (error) {
        if (error instanceof DateUtilError) {
            throw error;
        }
        throw new DateUtilError(ERRORS.INVALID_DATE);
    }
};

/**
 * Calculates the absolute difference between two dates in days
 * @param date1 - First date
 * @param date2 - Second date
 * @returns Number of days between dates
 * @throws {DateUtilError} If either date is invalid
 */
export const calculateDateDifference = (date1: Date, date2: Date): number => {
    try {
        validateDate(date1);
        validateDate(date2);

        const diff = Math.abs(
            moment(date1).startOf('day')
                .diff(moment(date2).startOf('day'), 'days')
        );

        return diff;
    } catch (error) {
        if (error instanceof DateUtilError) {
            throw error;
        }
        throw new DateUtilError(ERRORS.INVALID_DATE);
    }
};

/**
 * Returns the start of day (midnight) for a given date
 * @param date - Date to normalize
 * @returns Date object set to start of day
 * @throws {DateUtilError} If date is invalid
 */
export const getStartOfDay = (date: Date): Date => {
    try {
        validateDate(date);
        return moment(date).startOf('day').toDate();
    } catch (error) {
        if (error instanceof DateUtilError) {
            throw error;
        }
        throw new DateUtilError(ERRORS.INVALID_DATE);
    }
};