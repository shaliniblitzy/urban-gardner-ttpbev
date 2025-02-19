/**
 * Entry point for the Garden Planner web application
 * Bootstraps React application with Redux store, error boundaries, and performance monitoring
 * @version 1.0.0
 */

import React, { StrictMode } from 'react'; // ^18.0.0
import { createRoot } from 'react-dom/client'; // ^18.0.0
import { Provider } from 'react-redux'; // ^8.0.0
import { PersistGate } from 'redux-persist/integration/react'; // ^6.0.0
import * as Sentry from '@sentry/react'; // ^7.0.0

import App from './src/App';
import { store, persistor } from './src/store';
import { registerServiceWorker } from './utils/serviceWorker';

// Constants
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
const PERFORMANCE_THRESHOLD = 3000; // 3 seconds as per requirements

// Initialize Sentry for error tracking
if (!IS_DEVELOPMENT) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 1.0,
    integrations: [
      new Sentry.BrowserTracing({
        tracingOrigins: ['localhost', process.env.REACT_APP_API_URL],
      }),
    ],
  });
}

/**
 * Validates root element existence
 * @throws Error if root element not found
 */
const validateRootElement = () => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found. Please check your HTML file.');
  }
  return rootElement;
};

/**
 * Initializes performance monitoring
 */
const initializePerformanceMonitoring = () => {
  if (IS_DEVELOPMENT) {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > PERFORMANCE_THRESHOLD) {
          console.warn(
            `Performance warning: ${entry.name} took ${Math.round(entry.duration)}ms`
          );
        }
      });
    });

    observer.observe({ entryTypes: ['measure', 'resource'] });
  }
};

/**
 * Renders the application with error boundaries and performance monitoring
 */
const renderApp = () => {
  const rootElement = validateRootElement();
  const root = createRoot(rootElement);

  const ErrorFallback = ({ error }) => (
    <div role="alert">
      <h2>Application Error</h2>
      <pre>{error.message}</pre>
      <button onClick={() => window.location.reload()}>Reload Application</button>
    </div>
  );

  root.render(
    <StrictMode>
      <Sentry.ErrorBoundary fallback={ErrorFallback} showDialog>
        <Provider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <App />
          </PersistGate>
        </Provider>
      </Sentry.ErrorBoundary>
    </StrictMode>
  );
};

/**
 * Initializes the application with proper error handling and monitoring
 */
const initializeApp = async () => {
  try {
    // Initialize performance monitoring
    initializePerformanceMonitoring();

    // Register service worker for offline support
    if ('serviceWorker' in navigator) {
      await registerServiceWorker();
    }

    // Render application
    renderApp();

    // Log successful initialization
    if (IS_DEVELOPMENT) {
      console.log('Garden Planner initialized successfully');
    }
  } catch (error) {
    // Log initialization error
    console.error('Failed to initialize application:', error);
    
    // Report to Sentry if in production
    if (!IS_DEVELOPMENT) {
      Sentry.captureException(error);
    }

    // Display user-friendly error message
    const rootElement = validateRootElement();
    rootElement.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h2>Failed to start application</h2>
        <p>Please refresh the page or try again later.</p>
      </div>
    `;
  }
};

// Initialize application
initializeApp();

// Enable hot module replacement in development
if (IS_DEVELOPMENT && module.hot) {
  module.hot.accept('./src/App', () => {
    renderApp();
  });
}

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  if (!IS_DEVELOPMENT) {
    Sentry.captureException(event.reason);
  }
});