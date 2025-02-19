import { messaging, getToken, Messaging, MessagePayload } from 'firebase/messaging'; // ^9.0.0
import localforage from 'localforage'; // ^1.10.0
import { 
  NotificationType, 
  NotificationPayload, 
  NotificationPreferences,
  NotificationPermissionStatus,
  NotificationDeliveryStatus
} from '../types/notification.types';
import { apiService } from './api.service';

// Constants
const NOTIFICATION_STORAGE_KEY = 'garden_notification_preferences';
const FCM_VAPID_KEY = process.env.REACT_APP_FCM_VAPID_KEY;
const DELIVERY_TIMEOUT = 1000; // 1 second as per requirements
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Service class for managing garden maintenance notifications
 * with enhanced performance monitoring and offline support
 */
class NotificationService {
  private static instance: NotificationService;
  private messagingInstance: Messaging;
  private preferences: NotificationPreferences;
  private deliveryQueue: Map<string, NotificationPayload>;
  private performanceMetrics: Map<string, number>;

  private constructor() {
    this.messagingInstance = messaging();
    this.deliveryQueue = new Map();
    this.performanceMetrics = new Map();
    this.preferences = {
      enabled: false,
      reminderTime: '09:00',
      pushEnabled: false,
      emailEnabled: false,
      enabledTypes: [],
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00'
    };
    this.initialize();
  }

  /**
   * Initializes the notification service with required setup
   */
  private async initialize(): Promise<void> {
    try {
      // Load cached preferences
      const cachedPrefs = await localforage.getItem<NotificationPreferences>(NOTIFICATION_STORAGE_KEY);
      if (cachedPrefs) {
        this.preferences = cachedPrefs;
      }

      // Set up offline support
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          this.messagingInstance.useServiceWorker(registration);
        });
      }

      // Set up performance monitoring
      this.setupPerformanceMonitoring();
    } catch (error) {
      console.error('Notification service initialization failed:', error);
    }
  }

  /**
   * Requests notification permission with enhanced error handling
   */
  public async requestPermission(): Promise<NotificationPermissionStatus> {
    try {
      if (!this.isSupported()) {
        throw new Error('Notifications not supported in this browser');
      }

      const startTime = performance.now();
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        const token = await getToken(this.messagingInstance, {
          vapidKey: FCM_VAPID_KEY
        });
        
        // Update preferences and sync with backend
        this.preferences.pushEnabled = true;
        await this.updatePreferences(this.preferences);
        
        // Register token with backend
        await apiService.post('/notifications/token', { token });
      }

      this.logPerformanceMetric('permission_request', performance.now() - startTime);
      return permission as NotificationPermissionStatus;
    } catch (error) {
      console.error('Permission request failed:', error);
      throw error;
    }
  }

  /**
   * Creates and delivers a maintenance notification with delivery guarantees
   */
  public async createMaintenanceNotification(
    title: string,
    body: string,
    data: Record<string, string>,
    priority: 'high' | 'default' | 'low' = 'default'
  ): Promise<NotificationDeliveryStatus> {
    const notificationId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    try {
      // Check if notifications are enabled and not in quiet hours
      if (!this.isEnabled() || this.isInQuietHours()) {
        throw new Error('Notifications disabled or in quiet hours');
      }

      const payload: NotificationPayload = {
        title,
        body,
        type: NotificationType.MAINTENANCE_REMINDER,
        data,
        priority,
        actions: [
          { action: 'complete', title: 'Mark Complete' },
          { action: 'postpone', title: 'Postpone' }
        ],
        timestamp: Date.now(),
        ttl: 86400 // 24 hours
      };

      // Attempt immediate delivery
      const deliveryResult = await this.deliverNotification(payload, notificationId);
      const duration = performance.now() - startTime;

      // Log performance metrics
      this.logPerformanceMetric('notification_delivery', duration);

      return {
        id: notificationId,
        timestamp: new Date().toISOString(),
        success: deliveryResult,
        latency: duration,
        error: deliveryResult ? undefined : 'Delivery failed'
      };
    } catch (error) {
      // Queue for retry if delivery fails
      this.queueForRetry(notificationId, {
        title,
        body,
        type: NotificationType.MAINTENANCE_REMINDER,
        data,
        priority
      });

      return {
        id: notificationId,
        timestamp: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Updates user notification preferences with validation
   */
  public async updatePreferences(newPreferences: NotificationPreferences): Promise<void> {
    try {
      // Validate preferences
      this.validatePreferences(newPreferences);

      // Update local preferences
      this.preferences = newPreferences;

      // Persist to local storage
      await localforage.setItem(NOTIFICATION_STORAGE_KEY, newPreferences);

      // Sync with backend
      await apiService.put('/notifications/preferences', newPreferences);

      // Update Firebase messaging configuration if needed
      if (newPreferences.pushEnabled) {
        await this.updateMessagingConfiguration(newPreferences);
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  }

  /**
   * Retrieves current notification preferences
   */
  public getPreferences(): NotificationPreferences {
    return { ...this.preferences };
  }

  /**
   * Delivers a notification with timeout and retry support
   */
  private async deliverNotification(
    payload: NotificationPayload,
    id: string
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false);
      }, DELIVERY_TIMEOUT);

      this.messagingInstance.send(payload as MessagePayload)
        .then(() => {
          clearTimeout(timeoutId);
          resolve(true);
        })
        .catch(() => {
          clearTimeout(timeoutId);
          resolve(false);
        });
    });
  }

  /**
   * Queues failed notifications for retry
   */
  private queueForRetry(id: string, payload: NotificationPayload): void {
    this.deliveryQueue.set(id, payload);
    this.processRetryQueue();
  }

  /**
   * Processes queued notifications for retry
   */
  private async processRetryQueue(): Promise<void> {
    for (const [id, payload] of this.deliveryQueue) {
      let retryCount = 0;
      while (retryCount < MAX_RETRY_ATTEMPTS) {
        const success = await this.deliverNotification(payload, id);
        if (success) {
          this.deliveryQueue.delete(id);
          break;
        }
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      }
    }
  }

  /**
   * Validates notification preferences
   */
  private validatePreferences(prefs: NotificationPreferences): void {
    if (typeof prefs.enabled !== 'boolean') {
      throw new Error('Invalid enabled preference');
    }
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(prefs.reminderTime)) {
      throw new Error('Invalid reminder time format');
    }
    if (prefs.quietHoursStart && prefs.quietHoursEnd) {
      if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(prefs.quietHoursStart) ||
          !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(prefs.quietHoursEnd)) {
        throw new Error('Invalid quiet hours format');
      }
    }
  }

  /**
   * Checks if current time is within quiet hours
   */
  private isInQuietHours(): boolean {
    if (!this.preferences.quietHoursStart || !this.preferences.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const start = this.timeToMinutes(this.preferences.quietHoursStart);
    const end = this.timeToMinutes(this.preferences.quietHoursEnd);

    return current >= start || current <= end;
  }

  /**
   * Converts time string to minutes
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Checks if notifications are supported and enabled
   */
  private isSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  /**
   * Checks if notifications are enabled
   */
  private isEnabled(): boolean {
    return this.preferences.enabled && Notification.permission === 'granted';
  }

  /**
   * Sets up performance monitoring
   */
  private setupPerformanceMonitoring(): void {
    setInterval(() => {
      const metrics = Object.fromEntries(this.performanceMetrics);
      apiService.post('/notifications/metrics', metrics);
      this.performanceMetrics.clear();
    }, 60000);
  }

  /**
   * Logs performance metrics
   */
  private logPerformanceMetric(metric: string, duration: number): void {
    this.performanceMetrics.set(metric, duration);
  }

  /**
   * Updates Firebase messaging configuration
   */
  private async updateMessagingConfiguration(prefs: NotificationPreferences): Promise<void> {
    // Implementation specific to Firebase Messaging configuration
  }

  /**
   * Gets singleton instance
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();