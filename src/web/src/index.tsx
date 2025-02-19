import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/react';

import App from './App';
import { store, persistor } from './store';
import { Loading } from './components/common/Loading';
import { theme } from './theme';

// Initialize Sentry for error tracking
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

// Performance monitoring constants
const PERFORMANCE_THRESHOLD = 3000; // 3 seconds as per requirements
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Error fallback component with retry capability
 */
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div
    role="alert"
    style={{
      padding: '20px',
      margin: '20px',
      backgroundColor: theme.palette.alert.light,
      borderRadius: '4px',
      color: theme.palette.alert.base
    }}
  >
    <h2>Application Error</h2>
    <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
    <button
      onClick={resetErrorBoundary}
      style={{
        padding: '8px 16px',
        backgroundColor: theme.palette.primary.base,
        color: theme.palette.background,
        border: 'none',
        borderRadius: '4px',
        marginTop: '10px',
        cursor: 'pointer'
      }}
    >
      Try Again
    </button>
  </div>
);

/**
 * Initializes and renders the application with necessary providers
 * and performance monitoring
 */
const initializeApp = async (): Promise<void> => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Create React root with performance monitoring
  const startTime = performance.now();
  const root = createRoot(rootElement);

  // Monitor initial render performance
  if (isDevelopment) {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry) => {
        if (entry.duration > PERFORMANCE_THRESHOLD) {
          console.warn(`Slow render detected: ${entry.duration}ms`);
        }
      });
    });
    observer.observe({ entryTypes: ['measure'] });
  }

  // Render application with providers and error boundaries
  root.render(
    <StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error) => {
          Sentry.captureException(error);
          console.error('Application error:', error);
        }}
        onReset={() => {
          // Clear any error states and reload necessary data
          window.location.reload();
        }}
      >
        <Provider store={store}>
          <PersistGate 
            loading={<Loading size="large" color={theme.palette.primary.base} />} 
            persistor={persistor}
          >
            <App />
          </PersistGate>
        </Provider>
      </ErrorBoundary>
    </StrictMode>
  );

  // Log performance metrics in development
  if (isDevelopment) {
    const renderTime = performance.now() - startTime;
    console.log(`Initial render completed in ${renderTime.toFixed(2)}ms`);
  }
};

// Initialize application with error handling
initializeApp().catch((error) => {
  console.error('Failed to initialize application:', error);
  Sentry.captureException(error);
});

// Enable hot module replacement in development
if (isDevelopment && module.hot) {
  module.hot.accept('./App', () => {
    initializeApp().catch((error) => {
      console.error('Hot reload failed:', error);
      Sentry.captureException(error);
    });
  });
}