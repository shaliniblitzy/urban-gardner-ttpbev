import { 
  getMessaging, 
  onMessage, 
  isSupported 
} from 'firebase/messaging'; // @version ^9.0.0

import { 
  NotificationType, 
  NotificationPayload, 
  NotificationPermissionStatus,
  NotificationAction
} from '../types/notification.types';

// Cache keys for storing notification preferences
const PERMISSION_CACHE_KEY = 'notification_permission';
const SUPPORT_CACHE_KEY = 'notification_support';

/**
 * Interface for browser notification support status
 */
interface NotificationSupportStatus {
  hasNotificationAPI: boolean;
  hasServiceWorker: boolean;
  hasPushAPI: boolean;
  hasFCMSupport: boolean;
  hasActionSupport: boolean;
  hasInteractionSupport: boolean;
}

/**
 * Interface for notification action configuration
 */
interface ActionOptions {
  trackInteraction?: boolean;
  highContrast?: boolean;
  keyboard?: boolean;
}

/**
 * Requests and manages browser notification permissions with caching and retry logic
 * @returns Promise resolving to the current notification permission status
 */
export const requestNotificationPermission = async (): Promise<NotificationPermissionStatus> => {
  try {
    // Check cached permission first
    const cachedPermission = localStorage.getItem(PERMISSION_CACHE_KEY) as NotificationPermissionStatus;
    if (cachedPermission === 'granted') {
      return cachedPermission;
    }

    // Validate browser support
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported in this browser');
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    // Cache the new permission status
    localStorage.setItem(PERMISSION_CACHE_KEY, permission);

    // Initialize FCM if permission granted
    if (permission === 'granted') {
      const messaging = getMessaging();
      onMessage(messaging, (payload) => {
        console.log('Received foreground message:', payload);
      });
    }

    return permission as NotificationPermissionStatus;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

/**
 * Formats notification messages with rich text support and localization
 * @param type NotificationType for the notification
 * @param data Key-value pairs for notification content
 * @param locale Localization options
 * @returns Formatted NotificationPayload
 */
export const formatNotificationMessage = (
  type: NotificationType,
  data: Record<string, string>,
  locale: { language: string; timezone: string }
): NotificationPayload => {
  // Validate required data
  if (!data || !type) {
    throw new Error('Missing required notification data');
  }

  // Sanitize input data
  const sanitizedData = Object.entries(data).reduce((acc, [key, value]) => ({
    ...acc,
    [key]: value.replace(/[<>]/g, '') // Basic XSS prevention
  }), {});

  // Format based on notification type
  const payload: NotificationPayload = {
    type,
    title: '',
    body: '',
    data: sanitizedData,
    priority: 'default',
    ttl: 3600 // 1 hour default TTL
  };

  switch (type) {
    case NotificationType.MAINTENANCE_REMINDER:
      payload.title = `🌱 Garden Maintenance Required`;
      payload.body = `Time to ${data.task} in ${data.zone}`;
      payload.priority = 'high';
      break;
    case NotificationType.WATERING_SCHEDULE:
      payload.title = `💧 Watering Reminder`;
      payload.body = `Your ${data.plants} need watering`;
      break;
    case NotificationType.FERTILIZER_REMINDER:
      payload.title = `🌿 Fertilizer Application Due`;
      payload.body = `Time to fertilize your ${data.plants}`;
      break;
    default:
      payload.title = `Garden Planner Update`;
      payload.body = `New task available`;
  }

  // Add timestamp in user's timezone
  payload.scheduledTime = new Date().toLocaleString(locale.language, {
    timeZone: locale.timezone
  });

  return payload;
};

/**
 * Comprehensive browser feature detection for notification support
 * @returns Promise resolving to detailed notification support status
 */
export const checkNotificationSupport = async (): Promise<NotificationSupportStatus> => {
  const supportStatus: NotificationSupportStatus = {
    hasNotificationAPI: 'Notification' in window,
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushAPI: 'PushManager' in window,
    hasFCMSupport: false,
    hasActionSupport: false,
    hasInteractionSupport: false
  };

  try {
    // Check FCM support
    supportStatus.hasFCMSupport = await isSupported();

    // Check notification action support
    if (supportStatus.hasNotificationAPI) {
      const testNotification = new Notification('test', {
        actions: [{ action: 'test', title: 'Test' }]
      });
      supportStatus.hasActionSupport = 'actions' in testNotification;
      testNotification.close();
    }

    // Check interaction support
    supportStatus.hasInteractionSupport = 'getNotifications' in navigator;

    // Cache support status
    localStorage.setItem(SUPPORT_CACHE_KEY, JSON.stringify(supportStatus));

    return supportStatus;
  } catch (error) {
    console.error('Error checking notification support:', error);
    return supportStatus;
  }
};

/**
 * Creates rich, accessible notification actions with tracking
 * @param type NotificationType determining available actions
 * @param options Configuration for action behavior
 * @returns Array of enhanced notification actions
 */
export const createNotificationActions = (
  type: NotificationType,
  options: ActionOptions = {}
): NotificationAction[] => {
  const actions: NotificationAction[] = [];
  const { trackInteraction = true, highContrast = false } = options;

  // Base action properties
  const baseAction: Partial<NotificationAction> = {
    icon: highContrast ? '/icons/high-contrast/' : '/icons/default/'
  };

  switch (type) {
    case NotificationType.MAINTENANCE_REMINDER:
      actions.push(
        {
          ...baseAction,
          action: 'complete',
          title: 'Mark Complete',
          icon: `${baseAction.icon}checkmark.png`
        },
        {
          ...baseAction,
          action: 'postpone',
          title: 'Postpone',
          icon: `${baseAction.icon}clock.png`
        }
      );
      break;

    case NotificationType.WATERING_SCHEDULE:
    case NotificationType.FERTILIZER_REMINDER:
      actions.push(
        {
          ...baseAction,
          action: 'done',
          title: 'Done',
          icon: `${baseAction.icon}checkmark.png`
        },
        {
          ...baseAction,
          action: 'remind',
          title: 'Remind Later',
          icon: `${baseAction.icon}bell.png`
        }
      );
      break;

    default:
      actions.push({
        ...baseAction,
        action: 'view',
        title: 'View Details',
        icon: `${baseAction.icon}info.png`
      });
  }

  // Add tracking data if enabled
  if (trackInteraction) {
    actions.forEach(action => {
      action.action = `${action.action}?track=true&timestamp=${Date.now()}`;
    });
  }

  return actions;
};