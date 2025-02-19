// @package-version firebase/messaging@9.0.0
import { MessagePayload } from 'firebase/messaging';

/**
 * Enum defining the types of notifications supported by the Garden Planner system
 */
export enum NotificationType {
  MAINTENANCE_REMINDER = 'MAINTENANCE_REMINDER',
  WATERING_SCHEDULE = 'WATERING_SCHEDULE',
  FERTILIZER_REMINDER = 'FERTILIZER_REMINDER',
  HARVEST_TIME = 'HARVEST_TIME',
  SYSTEM_ALERT = 'SYSTEM_ALERT'
}

/**
 * Type defining the possible notification permission states
 * Maps to the browser's Notification.permission values
 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'default';

/**
 * Interface defining the structure of notification action buttons
 * Used for interactive notifications with clickable actions
 */
export interface NotificationAction {
  /** Unique identifier for the action */
  action: string;
  /** Display text for the action button */
  title: string;
  /** Optional icon URL for the action button */
  icon?: string;
}

/**
 * Interface defining the structure of notification payloads
 * Extends Firebase Cloud Messaging payload type for web notifications
 */
export interface NotificationPayload extends Partial<MessagePayload> {
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Type of notification from NotificationType enum */
  type: NotificationType;
  /** Optional additional data as key-value pairs */
  data?: Record<string, string>;
  /** Optional array of interactive actions */
  actions?: NotificationAction[];
  /** Optional timestamp for scheduled notifications */
  scheduledTime?: string;
  /** Optional priority level (high, default, low) */
  priority?: 'high' | 'default' | 'low';
  /** Optional time-to-live in seconds */
  ttl?: number;
}

/**
 * Interface defining user notification preferences
 * Controls how and when notifications are delivered
 */
export interface NotificationPreferences {
  /** Master toggle for all notifications */
  enabled: boolean;
  /** Preferred time for daily reminders (24h format HH:mm) */
  reminderTime: string;
  /** Toggle for push notifications */
  pushEnabled: boolean;
  /** Toggle for email notifications */
  emailEnabled: boolean;
  /** Optional specific notification types to enable/disable */
  enabledTypes?: NotificationType[];
  /** Optional quiet hours start time (24h format HH:mm) */
  quietHoursStart?: string;
  /** Optional quiet hours end time (24h format HH:mm) */
  quietHoursEnd?: string;
}

/**
 * Type for notification delivery status
 * Used for tracking notification delivery success/failure
 */
export type NotificationDeliveryStatus = {
  /** Unique notification identifier */
  id: string;
  /** Timestamp of delivery attempt */
  timestamp: string;
  /** Delivery success status */
  success: boolean;
  /** Optional error message if delivery failed */
  error?: string;
  /** Delivery latency in milliseconds */
  latency?: number;
};

/**
 * Interface for notification templates
 * Used for consistent notification formatting
 */
export interface NotificationTemplate {
  /** Template identifier */
  templateId: string;
  /** Title template with placeholder support */
  titleTemplate: string;
  /** Body template with placeholder support */
  bodyTemplate: string;
  /** Default notification type for this template */
  defaultType: NotificationType;
  /** Optional default actions */
  defaultActions?: NotificationAction[];
}