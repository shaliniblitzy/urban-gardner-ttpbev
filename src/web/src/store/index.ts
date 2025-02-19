/**
 * @fileoverview Root Redux store configuration with performance monitoring and security
 * @version 1.0.0
 */

import { 
    configureStore, 
    combineReducers, 
    createListenerMiddleware,
    isRejectedWithValue,
    Middleware
} from '@reduxjs/toolkit'; // ^1.9.0
import { 
    persistStore, 
    persistReducer,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PERSIST,
    PURGE,
    REGISTER
} from 'redux-persist'; // ^6.0.0
import { encryptTransform } from 'redux-persist-transform-encrypt'; // ^3.0.0
import storage from 'redux-persist/lib/storage';

// Import reducers
import gardenReducer from './garden/reducer';
import scheduleReducer from './schedule/reducer';
import notificationReducer from './notification/reducer';
import plantReducer from './plant/reducer';

// Performance monitoring constants
const PERFORMANCE_THRESHOLD = 3000; // 3 seconds as per requirements
const MONITORING_ENABLED = process.env.NODE_ENV === 'development';

/**
 * Create listener middleware for side effects and monitoring
 */
const listenerMiddleware = createListenerMiddleware();

/**
 * Custom error tracking middleware
 */
const errorTrackingMiddleware: Middleware = () => (next) => (action) => {
    try {
        return next(action);
    } catch (err) {
        console.error('Action error:', {
            action: action.type,
            error: err,
            timestamp: new Date().toISOString()
        });
        throw err;
    }
};

/**
 * Performance monitoring middleware
 */
const performanceMiddleware: Middleware = () => (next) => (action) => {
    if (!MONITORING_ENABLED) return next(action);

    const start = performance.now();
    const result = next(action);
    const duration = performance.now() - start;

    if (duration > PERFORMANCE_THRESHOLD) {
        console.warn(`Action ${action.type} took ${duration.toFixed(2)}ms to process`);
    }

    return result;
};

// Combine all reducers
const rootReducer = combineReducers({
    garden: gardenReducer,
    schedule: scheduleReducer,
    notification: notificationReducer,
    plant: plantReducer
});

// Configure encryption transform for sensitive data
const encryptionTransform = encryptTransform({
    secretKey: process.env.REACT_APP_ENCRYPTION_KEY || 'default-dev-key',
    onError: (error) => {
        console.error('Encryption error:', error);
    }
});

// Configure persistence
const persistConfig = {
    key: 'root',
    storage,
    transforms: [encryptionTransform],
    whitelist: ['garden', 'schedule', 'notification', 'plant'],
    blacklist: ['_persist'],
    timeout: 0
};

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

/**
 * Configure and create the Redux store
 */
export const configureAppStore = () => {
    const store = configureStore({
        reducer: persistedReducer,
        middleware: (getDefaultMiddleware) => 
            getDefaultMiddleware({
                serializableCheck: {
                    ignoredActions: [
                        FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER
                    ]
                }
            })
            .prepend(listenerMiddleware.middleware)
            .concat(errorTrackingMiddleware)
            .concat(performanceMiddleware),
        devTools: process.env.NODE_ENV !== 'production'
    });

    // Add performance monitoring listeners
    if (MONITORING_ENABLED) {
        listenerMiddleware.startListening({
            predicate: (action, currentState, previousState) => {
                const stateChanged = currentState !== previousState;
                return stateChanged;
            },
            effect: (action, listenerApi) => {
                const duration = performance.now() - listenerApi.getOriginalState().lastUpdate;
                if (duration > PERFORMANCE_THRESHOLD) {
                    console.warn(`State update for ${action.type} exceeded threshold: ${duration.toFixed(2)}ms`);
                }
            }
        });

        // Add error tracking listener
        listenerMiddleware.startListening({
            matcher: isRejectedWithValue,
            effect: (action, listenerApi) => {
                console.error('Action rejected:', {
                    type: action.type,
                    payload: action.payload,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }

    return store;
};

// Create store instance
export const store = configureAppStore();

// Create persistor
export const persistor = persistStore(store);

// Export root state type
export type RootState = ReturnType<typeof rootReducer>;

// Export dispatch type
export type AppDispatch = typeof store.dispatch;

// Export store type
export type AppStore = ReturnType<typeof configureAppStore>;

export default store;