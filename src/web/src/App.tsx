import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { ErrorBoundary } from 'react-error-boundary';
import { usePerformanceMonitor } from '@garden/monitoring';

import AppNavigator from './navigation/AppNavigator';
import store from './store';
import { theme } from './theme';

/**
 * Root application component that sets up the core app infrastructure
 * Implements comprehensive error handling and performance monitoring
 * @version 1.0.0
 */
const App: React.FC = () => {
  // Initialize performance monitoring
  const performance = usePerformanceMonitor('App');

  // Track initial render performance
  useEffect(() => {
    performance.trackMetric('initial_render', performance.now());
  }, [performance]);

  // Error fallback component with retry mechanism
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
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

  // Error handler for root level errors
  const handleError = (error: Error) => {
    performance.trackError('root_error', error);
    console.error('Application Error:', error);
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Clear any error states and reload necessary data
        window.location.reload();
      }}
    >
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <div 
            id="app-root"
            role="application"
            aria-label="Garden Planner Application"
            style={{ 
              minHeight: '100vh',
              backgroundColor: theme.palette.background 
            }}
          >
            <AppNavigator />
          </div>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;