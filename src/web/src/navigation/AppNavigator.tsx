import React, { useCallback, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/react';

// Internal imports
import GardenNavigator from './GardenNavigator';
import ScheduleNavigator from './ScheduleNavigator';
import SettingsNavigator from './SettingsNavigator';
import { RootStackParamList } from './types';

// Create type-safe bottom tab navigator
const Tab = createBottomTabNavigator<RootStackParamList>();

// Deep linking configuration
const linking = {
  prefixes: ['gardenplanner://'],
  config: {
    screens: {
      Garden: {
        screens: {
          GardenSetup: 'garden/setup',
          LayoutView: 'garden/layout/:gardenId'
        }
      },
      Schedule: {
        screens: {
          ScheduleView: 'schedule',
          TaskDetails: 'schedule/task/:taskId'
        }
      },
      Settings: {
        screens: {
          Settings: 'settings',
          NotificationSettings: 'settings/notifications',
          Profile: 'settings/profile'
        }
      }
    }
  }
};

/**
 * Main navigation container component that orchestrates the app's navigation structure
 * Implements comprehensive error handling, performance monitoring, and accessibility
 * @version 1.0.0
 */
const AppNavigator: React.FC = () => {
  // Initialize performance monitoring
  const transaction = Sentry.startTransaction({ name: 'AppNavigation' });

  // Track screen transitions for performance monitoring
  const trackScreenTransition = useCallback((routeName: string) => {
    const span = transaction.startChild({
      op: 'navigation',
      description: `Navigate to ${routeName}`
    });

    setTimeout(() => span.finish(), 0);
  }, [transaction]);

  // Clean up transaction on unmount
  useEffect(() => {
    return () => {
      transaction.finish();
    };
  }, [transaction]);

  // Error boundary fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div role="alert" style={{ padding: 20 }}>
      <h2>Navigation Error</h2>
      <pre>{error.message}</pre>
      <button 
        onClick={resetErrorBoundary}
        style={{ padding: '8px 16px', marginTop: 10 }}
      >
        Try Again
      </button>
    </div>
  );

  // Error handler for navigation errors
  const handleError = (error: Error) => {
    Sentry.captureException(error, {
      tags: {
        component: 'AppNavigator'
      }
    });
  };

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Reset navigation state if needed
      }}
    >
      <NavigationContainer
        linking={linking}
        fallback={<div>Loading...</div>}
        onStateChange={(state) => {
          // Track navigation state changes
          const currentRoute = state?.routes[state.index];
          if (currentRoute) {
            trackScreenTransition(currentRoute.name);
          }
        }}
      >
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#2E7D32',
            tabBarInactiveTintColor: '#757575',
            tabBarLabelStyle: {
              fontSize: 12,
              fontWeight: '500'
            },
            tabBarStyle: {
              borderTopWidth: 1,
              borderTopColor: '#E0E0E0',
              height: 60,
              paddingBottom: 8,
              paddingTop: 8
            }
          }}
        >
          <Tab.Screen
            name="Garden"
            component={GardenNavigator}
            options={{
              tabBarLabel: 'Garden',
              tabBarAccessibilityLabel: 'Garden tab',
              tabBarTestID: 'garden-tab'
            }}
            listeners={{
              tabPress: () => trackScreenTransition('Garden')
            }}
          />
          <Tab.Screen
            name="Schedule"
            component={ScheduleNavigator}
            options={{
              tabBarLabel: 'Schedule',
              tabBarAccessibilityLabel: 'Maintenance schedule tab',
              tabBarTestID: 'schedule-tab'
            }}
            listeners={{
              tabPress: () => trackScreenTransition('Schedule')
            }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsNavigator}
            options={{
              tabBarLabel: 'Settings',
              tabBarAccessibilityLabel: 'Settings tab',
              tabBarTestID: 'settings-tab'
            }}
            listeners={{
              tabPress: () => trackScreenTransition('Settings')
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </ErrorBoundary>
  );
};

export default AppNavigator;