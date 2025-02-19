import { Action } from '@reduxjs/toolkit';
import { NotificationType, NotificationPreferences, NotificationPermissionStatus, NotificationPayload } from '../../types/notification.types';

/**
 * Enum defining all possible Redux action types for notification state management
 * @version 1.0.0
 */
export enum NotificationActionTypes {
  SET_NOTIFICATION_TOKEN = '@notification/SET_TOKEN',
  UPDATE_NOTIFICATION_PERMISSION = '@notification/UPDATE_PERMISSION',
  UPDATE_NOTIFICATION_PREFERENCES = '@notification/UPDATE_PREFERENCES',
  SCHEDULE_NOTIFICATION = '@notification/SCHEDULE',
  CLEAR_NOTIFICATION = '@notification/CLEAR'
}

/**
 * Interface for notification delivery performance metrics
 * Tracks delivery times and success rates to meet <1s SLA
 */
export interface NotificationDeliveryMetrics {
  averageLatency: number;
  successRate: number;
  totalDelivered: number;
  totalFailed: number;
  lastUpdated: string;
}

/**
 * Interface for notification-related errors
 */
export interface NotificationError {
  code: string;
  message: string;
  timestamp: string;
}

/**
 * Interface defining the shape of notification state in Redux store
 */
export interface NotificationState {
  token: string | null;
  permission: NotificationPermissionStatus;
  preferences: NotificationPreferences;
  scheduledNotifications: NotificationPayload[];
  deliveryMetrics: NotificationDeliveryMetrics;
  error: NotificationError | null;
}

/**
 * Metadata interface for FCM token actions
 */
export interface TokenMetadata {
  timestamp: string;
  platform: 'web' | 'ios' | 'android';
  version: string;
}

/**
 * Interface for notification permission metadata
 */
export interface PermissionMetadata {
  timestamp: string;
  source: 'user' | 'system';
}

/**
 * Interface for notification preferences metadata
 */
export interface PreferencesMetadata {
  lastUpdated: string;
  updatedBy: string;
}

/**
 * Interface for notification scheduling metadata
 */
export interface ScheduleMetadata {
  scheduledAt: string;
  targetDeliveryTime: string;
  priority: 'high' | 'default' | 'low';
}

/**
 * Action interface for setting notification token
 */
export interface SetNotificationTokenAction extends Action {
  type: NotificationActionTypes.SET_NOTIFICATION_TOKEN;
  payload: string;
  meta: TokenMetadata;
}

/**
 * Action interface for updating notification permission
 */
export interface UpdateNotificationPermissionAction extends Action {
  type: NotificationActionTypes.UPDATE_NOTIFICATION_PERMISSION;
  payload: NotificationPermissionStatus;
  meta: PermissionMetadata;
}

/**
 * Action interface for updating notification preferences
 */
export interface UpdateNotificationPreferencesAction extends Action {
  type: NotificationActionTypes.UPDATE_NOTIFICATION_PREFERENCES;
  payload: NotificationPreferences;
  meta: PreferencesMetadata;
}

/**
 * Action interface for scheduling notifications
 */
export interface ScheduleNotificationAction extends Action {
  type: NotificationActionTypes.SCHEDULE_NOTIFICATION;
  payload: NotificationPayload;
  meta: ScheduleMetadata;
}

/**
 * Action interface for clearing notifications
 */
export interface ClearNotificationAction extends Action {
  type: NotificationActionTypes.CLEAR_NOTIFICATION;
  payload: string;
}

/**
 * Union type of all notification actions
 * Enables type checking and exhaustive handling in reducers
 */
export type NotificationAction =
  | SetNotificationTokenAction
  | UpdateNotificationPermissionAction
  | UpdateNotificationPreferencesAction
  | ScheduleNotificationAction
  | ClearNotificationAction;

/**
 * Type guard for SetNotificationTokenAction
 */
export function isSetNotificationTokenAction(action: NotificationAction): action is SetNotificationTokenAction {
  return action.type === NotificationActionTypes.SET_NOTIFICATION_TOKEN;
}

/**
 * Type guard for UpdateNotificationPermissionAction
 */
export function isUpdateNotificationPermissionAction(action: NotificationAction): action is UpdateNotificationPermissionAction {
  return action.type === NotificationActionTypes.UPDATE_NOTIFICATION_PERMISSION;
}

/**
 * Type guard for UpdateNotificationPreferencesAction
 */
export function isUpdateNotificationPreferencesAction(action: NotificationAction): action is UpdateNotificationPreferencesAction {
  return action.type === NotificationActionTypes.UPDATE_NOTIFICATION_PREFERENCES;
}

/**
 * Type guard for ScheduleNotificationAction
 */
export function isScheduleNotificationAction(action: NotificationAction): action is ScheduleNotificationAction {
  return action.type === NotificationActionTypes.SCHEDULE_NOTIFICATION;
}

/**
 * Type guard for ClearNotificationAction
 */
export function isClearNotificationAction(action: NotificationAction): action is ClearNotificationAction {
  return action.type === NotificationActionTypes.CLEAR_NOTIFICATION;
}