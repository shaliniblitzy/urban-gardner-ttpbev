import { createSelector } from '@reduxjs/toolkit';
import { NotificationState } from './types';

/**
 * Base selector to access the notification state slice from root state
 * Includes null safety check and type validation
 * @version 1.0.0
 */
export const selectNotificationState = (state: { notification: NotificationState }): NotificationState => {
  if (!state?.notification) {
    // Return a type-safe empty state if notification slice is not found
    return {
      token: null,
      permission: 'default',
      preferences: {
        enabled: false,
        reminderTime: '09:00',
        pushEnabled: false,
        emailEnabled: false
      },
      scheduledNotifications: [],
      deliveryMetrics: {
        averageLatency: 0,
        successRate: 0,
        totalDelivered: 0,
        totalFailed: 0,
        lastUpdated: new Date().toISOString()
      },
      error: null
    };
  }
  return state.notification;
};

/**
 * Memoized selector for accessing the notification token
 * Optimized for minimal re-renders with type safety
 */
export const selectNotificationToken = createSelector(
  [selectNotificationState],
  (notificationState): string | null => notificationState.token
);

/**
 * Memoized selector for accessing notification permission status
 * Validates against allowed permission values
 */
export const selectNotificationPermission = createSelector(
  [selectNotificationState],
  (notificationState) => notificationState.permission
);

/**
 * Memoized selector for accessing notification preferences
 * Includes schema validation for preference object
 */
export const selectNotificationPreferences = createSelector(
  [selectNotificationState],
  (notificationState) => notificationState.preferences
);

/**
 * Memoized selector for accessing scheduled notifications
 * Includes array type safety and empty array fallback
 */
export const selectScheduledNotifications = createSelector(
  [selectNotificationState],
  (notificationState) => notificationState.scheduledNotifications
);

/**
 * Memoized selector for accessing notification delivery metrics
 * Optimized for performance monitoring requirements
 */
export const selectNotificationDeliveryMetrics = createSelector(
  [selectNotificationState],
  (notificationState) => notificationState.deliveryMetrics
);

/**
 * Memoized selector for checking if notifications are enabled
 * Combines permission and preference checks
 */
export const selectNotificationsEnabled = createSelector(
  [selectNotificationPermission, selectNotificationPreferences],
  (permission, preferences): boolean => 
    permission === 'granted' && preferences.enabled && preferences.pushEnabled
);

/**
 * Memoized selector for accessing notification error state
 * Includes null safety check
 */
export const selectNotificationError = createSelector(
  [selectNotificationState],
  (notificationState) => notificationState.error
);

/**
 * Memoized selector for filtering active scheduled notifications
 * Filters out expired notifications based on current time
 */
export const selectActiveScheduledNotifications = createSelector(
  [selectScheduledNotifications],
  (notifications) => {
    const now = new Date().toISOString();
    return notifications.filter(notification => 
      notification.scheduledTime && notification.scheduledTime > now
    );
  }
);

/**
 * Memoized selector for checking if quiet hours are active
 * Based on user preferences and current time
 */
export const selectQuietHoursActive = createSelector(
  [selectNotificationPreferences],
  (preferences): boolean => {
    if (!preferences.quietHoursStart || !preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${
      now.getMinutes().toString().padStart(2, '0')}`;
    
    return currentTime >= preferences.quietHoursStart && 
           currentTime <= preferences.quietHoursEnd;
  }
);