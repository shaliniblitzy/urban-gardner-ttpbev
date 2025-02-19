import React, { useCallback, useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/native-stack';
import { ErrorBoundary } from 'react-error-boundary';
import * as Sentry from '@sentry/react';

// Internal imports
import ScheduleListScreen from '../screens/schedule/ScheduleListScreen';
import ScheduleDetailsScreen from '../screens/schedule/ScheduleDetailsScreen';
import { RootStackParamList } from './types';

// Create stack navigator with type safety
const Stack = createStackNavigator<RootStackParamList>();

/**
 * Type definition for schedule stack navigation parameters
 */
interface ScheduleStackParamList {
  ScheduleList: {
    gardenId: string;
    errorBoundary?: boolean;
  };
  ScheduleDetails: {
    scheduleId: string;
    gardenId: string;
    errorBoundary?: boolean;
  };
}

/**
 * Custom hook for monitoring navigation performance
 */
const useNavigationPerformance = () => {
  const transaction = Sentry.startTransaction({ name: 'ScheduleNavigation' });

  useEffect(() => {
    return () => {
      transaction.finish();
    };
  }, [transaction]);

  const trackScreenTransition = useCallback((screenName: string) => {
    const span = transaction.startChild({
      op: 'navigation',
      description: `Navigate to ${screenName}`
    });

    setTimeout(() => {
      span.finish();
    }, 0);
  }, [transaction]);

  return { trackScreenTransition };
};

/**
 * Schedule Navigator Component
 * Manages navigation between schedule-related screens with error handling
 * and performance monitoring
 */
const ScheduleNavigator: React.FC = () => {
  const { trackScreenTransition } = useNavigationPerformance();

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div role="alert">
      <p>Something went wrong in schedule navigation:</p>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try again</button>
    </div>
  );

  // Error handler for navigation errors
  const handleError = (error: Error) => {
    Sentry.captureException(error, {
      tags: {
        component: 'ScheduleNavigator'
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
      <Stack.Navigator
        initialRouteName="ScheduleView"
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: '#2E7D32', // Primary color from theme
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '600',
          },
          animation: 'slide_from_right',
          animationDuration: 200,
        }}
      >
        <Stack.Screen
          name="ScheduleView"
          component={ScheduleListScreen}
          options={{
            title: 'Maintenance Schedule',
            headerBackTitleVisible: false,
          }}
          listeners={{
            focus: () => trackScreenTransition('ScheduleList')
          }}
        />
        <Stack.Screen
          name="TaskDetails"
          component={ScheduleDetailsScreen}
          options={{
            title: 'Task Details',
            headerBackTitleVisible: false,
            presentation: 'card',
          }}
          listeners={{
            focus: () => trackScreenTransition('TaskDetails')
          }}
        />
      </Stack.Navigator>
    </ErrorBoundary>
  );
};

export default ScheduleNavigator;