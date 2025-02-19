import { createReducer } from '@reduxjs/toolkit';
import {
  NotificationActionTypes,
  NotificationState,
  NotificationAction,
  NotificationDeliveryMetrics
} from './types';

/**
 * Initial state for notification management
 * Includes delivery metrics tracking and error handling
 */
const initialState: NotificationState = {
  token: null,
  permission: 'default',
  preferences: {
    enabled: true,
    reminderTime: '09:00',
    pushEnabled: true,
    emailEnabled: false,
    enabledTypes: [],
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00'
  },
  scheduledNotifications: [],
  deliveryMetrics: {
    averageLatency: 0,
    successRate: 100,
    totalDelivered: 0,
    totalFailed: 0,
    lastUpdated: new Date().toISOString()
  },
  error: null
};

/**
 * Updates delivery metrics based on new notification events
 * Maintains running averages and success rates
 */
const updateMetrics = (
  currentMetrics: NotificationDeliveryMetrics,
  latency: number,
  success: boolean
): NotificationDeliveryMetrics => {
  const totalAttempts = currentMetrics.totalDelivered + currentMetrics.totalFailed;
  const newTotalDelivered = success ? currentMetrics.totalDelivered + 1 : currentMetrics.totalDelivered;
  const newTotalFailed = success ? currentMetrics.totalFailed : currentMetrics.totalFailed + 1;
  
  return {
    averageLatency: (currentMetrics.averageLatency * totalAttempts + latency) / (totalAttempts + 1),
    successRate: (newTotalDelivered / (newTotalDelivered + newTotalFailed)) * 100,
    totalDelivered: newTotalDelivered,
    totalFailed: newTotalFailed,
    lastUpdated: new Date().toISOString()
  };
};

/**
 * Redux reducer for notification state management
 * Handles all notification-related actions with performance tracking
 */
const notificationReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(NotificationActionTypes.SET_NOTIFICATION_TOKEN, (state, action) => {
      state.token = action.payload;
      state.error = null;
    })
    
    .addCase(NotificationActionTypes.UPDATE_NOTIFICATION_PERMISSION, (state, action) => {
      state.permission = action.payload;
      state.error = null;
    })
    
    .addCase(NotificationActionTypes.UPDATE_NOTIFICATION_PREFERENCES, (state, action) => {
      state.preferences = {
        ...state.preferences,
        ...action.payload
      };
      state.error = null;
    })
    
    .addCase(NotificationActionTypes.SCHEDULE_NOTIFICATION, (state, action) => {
      // Check for duplicate notifications
      const isDuplicate = state.scheduledNotifications.some(
        notification => notification.title === action.payload.title &&
                       notification.scheduledTime === action.payload.scheduledTime
      );
      
      if (!isDuplicate) {
        state.scheduledNotifications.push(action.payload);
        
        // Update metrics for scheduling
        const schedulingLatency = action.meta?.latency || 0;
        state.deliveryMetrics = updateMetrics(
          state.deliveryMetrics,
          schedulingLatency,
          true
        );
      }
      state.error = null;
    })
    
    .addCase(NotificationActionTypes.CLEAR_NOTIFICATION, (state, action) => {
      state.scheduledNotifications = state.scheduledNotifications.filter(
        notification => notification.title !== action.payload
      );
      state.error = null;
    })
    
    .addCase(NotificationActionTypes.UPDATE_DELIVERY_METRICS, (state, action) => {
      const { latency, success } = action.payload;
      state.deliveryMetrics = updateMetrics(
        state.deliveryMetrics,
        latency,
        success
      );
    })
    
    .addCase(NotificationActionTypes.SET_NOTIFICATION_ERROR, (state, action) => {
      state.error = {
        code: action.payload.code,
        message: action.payload.message,
        timestamp: new Date().toISOString()
      };
      
      // Update metrics for failed delivery if applicable
      if (action.payload.code.startsWith('DELIVERY_')) {
        state.deliveryMetrics = updateMetrics(
          state.deliveryMetrics,
          0,
          false
        );
      }
    });
});

export default notificationReducer;