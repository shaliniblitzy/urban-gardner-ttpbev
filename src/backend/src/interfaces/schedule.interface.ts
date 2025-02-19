// mongoose version: ^6.0.0
import { Document } from 'mongoose';

/**
 * Enumeration of all possible garden maintenance task types
 */
export enum TaskType {
    WATERING = 'watering',
    FERTILIZING = 'fertilizing',
    PRUNING = 'pruning',
    HARVESTING = 'harvesting',
    PEST_CONTROL = 'pest_control',
    COMPOSTING = 'composting',
    MULCHING = 'mulching',
    WEEDING = 'weeding'
}

/**
 * Priority levels for maintenance tasks to aid in scheduling and notifications
 */
export enum TaskPriority {
    HIGH = 3,
    MEDIUM = 2,
    LOW = 1
}

/**
 * Frequency options for recurring maintenance tasks
 */
export enum TaskFrequency {
    DAILY = 'daily',
    WEEKLY = 'weekly',
    BIWEEKLY = 'biweekly',
    MONTHLY = 'monthly',
    AS_NEEDED = 'as_needed'
}

/**
 * Interface defining notification preferences for a schedule
 */
interface NotificationPreferences {
    enabled: boolean;
    advanceNotice: number;  // Time in hours before task is due
    reminderFrequency: number;  // Frequency of reminders in hours
}

/**
 * Interface defining a notification history entry
 */
interface NotificationHistoryEntry {
    sentAt: Date;
    acknowledged: boolean;
}

/**
 * Comprehensive interface defining the structure and properties of a garden maintenance schedule
 */
export interface ISchedule {
    id: string;
    gardenId: string;  // Reference to the garden this schedule belongs to
    plantId: string;   // Reference to the specific plant this task is for
    taskType: TaskType;
    frequency: TaskFrequency;
    dueDate: Date;
    completed: boolean;
    completedDate: Date | null;
    priority: TaskPriority;
    notificationPreferences: NotificationPreferences;
    notificationHistory: NotificationHistoryEntry[];
    notes: string;
    weather_dependent: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Interface combining schedule properties with Mongoose document methods for database operations
 */
export interface IScheduleDocument extends ISchedule, Document {
    // Additional Mongoose document methods are inherited from Document
}