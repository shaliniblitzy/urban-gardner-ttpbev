import { useState, useEffect, useCallback, useRef } from 'react'; // ^18.0.0
import { debounce } from 'lodash'; // ^4.17.21

import { 
  NotificationType, 
  NotificationPermissionStatus, 
  NotificationPreferences,
  NotificationPayload
} from '../types/notification.types';

import { notificationService } from '../services/notification.service';
import { 
  requestNotificationPermission, 
  checkNotificationSupport,
  formatNotificationMessage
} from '../utils/notification.utils';

/**
 * Custom hook for managing notifications in the Garden Planner application
 * Provides comprehensive notification management with offline support and error handling
 */
export const useNotifications = () => {
  // State management
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermissionStatus>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    enabled: false,
    reminderTime: '09:00',
    pushEnabled: false,
    emailEnabled: false,
    enabledTypes: [],
    quietHoursStart: '22:00',
    quietHoursEnd: '06:00'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  // Refs for tracking mounted state and network status
  const isMounted = useRef(true);
  const isOnline = useRef(navigator.onLine);
  const retryQueue = useRef<Map<string, NotificationPayload>>(new Map());

  /**
   * Initialize notification system and load preferences
   */
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        setIsLoading(true);
        
        // Check browser support
        const supportStatus = await checkNotificationSupport();
        setIsSupported(supportStatus.hasNotificationAPI && supportStatus.hasFCMSupport);

        // Load current permission status
        const currentPermission = Notification.permission as NotificationPermissionStatus;
        setPermissionStatus(currentPermission);

        // Load saved preferences
        const savedPreferences = notificationService.getPreferences();
        setPreferences(savedPreferences);

      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize notifications'));
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    initializeNotifications();

    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Network status monitoring for offline support
   */
  useEffect(() => {
    const handleOnline = () => {
      isOnline.current = true;
      retryFailedNotifications();
    };

    const handleOffline = () => {
      isOnline.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Request notification permissions with retry logic
   */
  const requestPermission = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const permission = await requestNotificationPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        const updatedPreferences = { ...preferences, pushEnabled: true };
        await updatePreferences(updatedPreferences);
      }

      return permission;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to request permission');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [preferences]);

  /**
   * Update notification preferences with debouncing
   */
  const updatePreferences = useCallback(
    debounce(async (newPreferences: NotificationPreferences) => {
      try {
        setError(null);
        await notificationService.updatePreferences(newPreferences);
        setPreferences(newPreferences);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update preferences');
        setError(error);
        throw error;
      }
    }, 500),
    []
  );

  /**
   * Schedule a new notification with offline support
   */
  const scheduleNotification = useCallback(async (
    type: NotificationType,
    data: Record<string, string>,
    priority: 'high' | 'default' | 'low' = 'default'
  ) => {
    try {
      setError(null);

      const payload = formatNotificationMessage(
        type,
        data,
        { language: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }
      );

      if (!isOnline.current) {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        retryQueue.current.set(id, payload);
        return false;
      }

      const result = await notificationService.createMaintenanceNotification(
        payload.title,
        payload.body,
        payload.data || {},
        priority
      );

      return result.success;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to schedule notification');
      setError(error);
      throw error;
    }
  }, []);

  /**
   * Retry failed notifications when back online
   */
  const retryFailedNotifications = useCallback(async () => {
    if (!isOnline.current || retryQueue.current.size === 0) return;

    for (const [id, payload] of retryQueue.current) {
      try {
        const result = await notificationService.createMaintenanceNotification(
          payload.title,
          payload.body,
          payload.data || {},
          payload.priority
        );

        if (result.success) {
          retryQueue.current.delete(id);
        }
      } catch (error) {
        console.error(`Failed to retry notification ${id}:`, error);
      }
    }
  }, []);

  /**
   * Clear current error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    permissionStatus,
    preferences,
    isLoading,
    error,
    isSupported,
    requestPermission,
    updatePreferences,
    scheduleNotification,
    clearError,
    retryFailedNotifications
  };
};