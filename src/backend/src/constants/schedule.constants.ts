import { TaskType } from '../interfaces/schedule.interface';

/**
 * Default configuration values for schedule management
 */
export const SCHEDULE_DEFAULTS = {
    DEFAULT_REMINDER_TIME: '09:00',      // Default time for daily reminders
    DEFAULT_REMINDER_INTERVAL: 24,        // Default interval between reminders in hours
    MAX_REMINDERS: 3,                    // Maximum number of reminders per task
    NOTIFICATION_ENABLED: true           // Default notification state
} as const;

/**
 * Interval hours between recurring tasks for each task type
 * Values represent hours between task occurrences
 */
export const TASK_INTERVALS = {
    [TaskType.WATERING]: 24,        // Daily watering
    [TaskType.FERTILIZING]: 168,    // Weekly fertilizing (7 days * 24 hours)
    [TaskType.PRUNING]: 336,        // Bi-weekly pruning (14 days * 24 hours)
    [TaskType.HARVESTING]: 168,     // Weekly harvesting
    [TaskType.PEST_CONTROL]: 168    // Weekly pest control
} as const;

/**
 * Priority levels for different task types
 * Higher number indicates higher priority
 * 1: Low priority
 * 2: Medium priority
 * 3: High priority
 */
export const TASK_PRIORITIES = {
    [TaskType.WATERING]: 1,         // Regular maintenance
    [TaskType.FERTILIZING]: 2,      // Important for growth
    [TaskType.PRUNING]: 3,          // Critical for plant health
    [TaskType.HARVESTING]: 1,       // Flexible timing
    [TaskType.PEST_CONTROL]: 2      // Important for protection
} as const;

/**
 * System limits for schedule generation and management
 * These values are used to prevent system overload and ensure optimal performance
 */
export const SCHEDULE_LIMITS = {
    MAX_TASKS_PER_DAY: 10,         // Maximum number of tasks that can be scheduled per day
    MIN_TASK_INTERVAL: 30,         // Minimum minutes between tasks
    MAX_SCHEDULE_DAYS: 90,         // Maximum days to schedule in advance
    MAX_CONCURRENT_TASKS: 3        // Maximum number of tasks that can run simultaneously
} as const;

/**
 * Error messages for schedule-related operations
 * Standardized error messages for consistent error handling
 */
export const SCHEDULE_ERRORS = {
    INVALID_DATE: 'Invalid schedule date provided',
    INVALID_TASK_TYPE: 'Invalid task type specified',
    SCHEDULE_FULL: 'Maximum tasks per day exceeded',
    INVALID_INTERVAL: 'Invalid task interval specified',
    INVALID_GARDEN_ID: 'Invalid garden ID provided'
} as const;