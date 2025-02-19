/**
 * @fileoverview TypeScript type definitions for garden maintenance schedules
 * Defines types and interfaces for schedule-related operations in the garden planner application
 * @version 1.0.0
 */

/**
 * Enumeration of available maintenance task types
 * Represents different categories of garden care activities
 */
export enum TaskType {
    WATERING = 'watering',
    FERTILIZING = 'fertilizing',
    PRUNING = 'pruning',
    HARVESTING = 'harvesting',
    PEST_CONTROL = 'pest_control'
}

/**
 * Interface defining the structure of a maintenance schedule
 * Represents a single scheduled maintenance task for a garden
 */
export interface Schedule {
    /** Unique identifier for the schedule */
    id: string;
    
    /** Reference to the associated garden */
    gardenId: string;
    
    /** Type of maintenance task */
    taskType: TaskType;
    
    /** When the task should be performed */
    dueDate: Date;
    
    /** Whether the task has been completed */
    completed: boolean;
    
    /** Task priority (1-5, where 1 is highest priority) */
    priority: number;
    
    /** Whether a notification has been sent for this task */
    notificationSent: boolean;
}

/**
 * Interface defining user preferences for schedule notifications and timing
 * Controls how and when users receive schedule-related notifications
 */
export interface SchedulePreferences {
    /** User's preferred time for receiving notifications (24-hour format HH:mm) */
    preferredTime: string;
    
    /** Master toggle for all notifications */
    notificationEnabled: boolean;
    
    /** Toggle for email notifications */
    emailNotifications: boolean;
    
    /** Toggle for push notifications */
    pushNotifications: boolean;
}

/**
 * Type defining filter options for schedule queries
 * Used to filter and search through maintenance schedules
 */
export type ScheduleFilter = {
    /** Filter by task type */
    taskType?: TaskType;
    
    /** Filter by completion status */
    completed?: boolean;
    
    /** Filter by start date range */
    startDate?: Date;
    
    /** Filter by end date range */
    endDate?: Date;
}