import { createAction } from '@reduxjs/toolkit';
import { performance } from 'firebase/performance';
import { 
  NotificationActionTypes,
  NotificationPreferences,
  NotificationPermissionStatus
} from './types';
import { notificationService } from '../../services/notification.service';

// Performance trace names
const PERF_TOKEN_VALIDATION = 'notification_token_validation';
const PERF_PERMISSION_UPDATE = 'notification_permission_update';
const PERF_PREFERENCES_UPDATE = 'notification_preferences_update';
const PERF_OFFLINE_QUEUE = 'notification_offline_queue';

/**
 * Action creator for setting and validating FCM notification token
 * Includes performance monitoring and validation
 */
export const setNotificationToken = createAction(
  NotificationActionTypes.SET_NOTIFICATION_TOKEN,
  (token: string) => {
    const trace = performance.trace(PERF_TOKEN_VALIDATION);
    trace.start();

    try {
      // Validate token format and expiration
      const isValid = notificationService.validateToken(token);
      if (!isValid) {
        throw new Error('Invalid notification token format');
      }

      trace.putAttribute('token_status', 'valid');
      trace.stop();

      return {
        payload: {
          token,
          validated: true,
          timestamp: new Date().toISOString()
        },
        meta: {
          timestamp: Date.now(),
          platform: 'web',
          version: process.env.REACT_APP_VERSION || '1.0.0'
        }
      };
    } catch (error) {
      trace.putAttribute('token_status', 'invalid');
      trace.stop();
      throw error;
    }
  }
);

/**
 * Action creator for updating notification permission status
 * Includes detailed tracking and validation
 */
export const updateNotificationPermission = createAction(
  NotificationActionTypes.UPDATE_NOTIFICATION_PERMISSION,
  (status: NotificationPermissionStatus) => {
    const trace = performance.trace(PERF_PERMISSION_UPDATE);
    trace.start();

    // Validate permission status
    if (!['granted', 'denied', 'default'].includes(status)) {
      trace.putAttribute('status', 'invalid');
      trace.stop();
      throw new Error('Invalid permission status');
    }

    trace.putAttribute('status', status);
    trace.stop();

    return {
      payload: status,
      meta: {
        timestamp: Date.now(),
        source: 'user',
        previousStatus: Notification.permission
      }
    };
  }
);

/**
 * Action creator for updating notification preferences with offline support
 * Includes validation and synchronization status
 */
export const updateNotificationPreferences = createAction(
  NotificationActionTypes.UPDATE_NOTIFICATION_PREFERENCES,
  async (preferences: NotificationPreferences) => {
    const trace = performance.trace(PERF_PREFERENCES_UPDATE);
    trace.start();

    try {
      // Check network status
      const isOnline = navigator.onLine;
      
      // Validate preferences structure
      if (!preferences.reminderTime || typeof preferences.enabled !== 'boolean') {
        throw new Error('Invalid preference format');
      }

      if (isOnline) {
        // Online update
        await notificationService.updatePreferences(preferences);
        trace.putAttribute('sync_status', 'success');
      } else {
        // Queue for offline sync
        await notificationService.queueOfflineNotification({
          type: 'PREFERENCE_UPDATE',
          data: preferences
        });
        trace.putAttribute('sync_status', 'queued');
      }

      trace.stop();

      return {
        payload: {
          ...preferences,
          syncStatus: isOnline ? 'synced' : 'pending',
          lastUpdated: new Date().toISOString()
        },
        meta: {
          lastUpdated: Date.now(),
          updatedBy: 'user',
          isOffline: !isOnline
        }
      };
    } catch (error) {
      trace.putAttribute('sync_status', 'failed');
      trace.stop();
      throw error;
    }
  }
);

/**
 * Action creator for managing offline notification queue
 * Includes retry logic and queue management
 */
export const queueOfflineNotification = createAction(
  NotificationActionTypes.QUEUE_OFFLINE_NOTIFICATION,
  (notification: { type: string; data: unknown }) => {
    const trace = performance.trace(PERF_OFFLINE_QUEUE);
    trace.start();

    const queueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    trace.putAttribute('queue_id', queueId);
    trace.stop();

    return {
      payload: {
        id: queueId,
        notification,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3
      },
      meta: {
        queuedAt: new Date().toISOString(),
        priority: 'high'
      }
    };
  }
);

/**
 * Action creator for syncing offline notification queue
 * Handles batch synchronization of queued items
 */
export const syncOfflineQueue = createAction(
  NotificationActionTypes.SYNC_OFFLINE_QUEUE,
  async () => {
    const trace = performance.trace('notification_queue_sync');
    trace.start();

    try {
      const syncResult = await notificationService.syncOfflineQueue();
      trace.putAttribute('sync_result', syncResult.success ? 'success' : 'failed');
      trace.stop();

      return {
        payload: {
          synced: syncResult.syncedCount,
          failed: syncResult.failedCount,
          timestamp: new Date().toISOString()
        },
        meta: {
          duration: syncResult.duration,
          nextSyncAttempt: syncResult.nextAttempt
        }
      };
    } catch (error) {
      trace.putAttribute('sync_result', 'error');
      trace.stop();
      throw error;
    }
  }
);