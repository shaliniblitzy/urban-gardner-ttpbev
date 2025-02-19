import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import GardenSetupScreen from '../screens/garden/GardenSetupScreen';
import GardenLayoutScreen from '../screens/garden/GardenLayoutScreen';
import { RootStackParamList } from './types';
import { theme } from '../theme/colors';
import { GARDEN_VALIDATION } from '../constants/garden';

// Initialize stack navigator with type safety
const Stack = createStackNavigator<RootStackParamList>();

/**
 * GardenNavigator component that manages navigation between garden-related screens
 * Implements navigation structure defined in technical specifications
 * @version 1.0.0
 */
const GardenNavigator: React.FC = () => {
  // Default screen options for consistent UI
  const defaultScreenOptions = {
    headerStyle: {
      backgroundColor: theme.palette.primary.base,
      elevation: 0,
      shadowOpacity: 0,
    },
    headerTintColor: theme.palette.background,
    headerTitleStyle: {
      fontWeight: '600',
    },
    cardStyle: {
      backgroundColor: theme.palette.background,
    },
    gestureEnabled: true,
    animationEnabled: true,
  };

  // Screen-specific options
  const screenOptions = {
    GardenSetup: {
      title: 'Garden Setup',
      gestureEnabled: false, // Disable back gesture for initial setup
      headerLeft: () => null, // Remove back button
    },
    LayoutView: {
      title: 'Garden Layout',
      headerBackTitleVisible: false,
    },
  };

  return (
    <Stack.Navigator
      initialRouteName="GardenSetup"
      screenOptions={defaultScreenOptions}
    >
      <Stack.Screen
        name="GardenSetup"
        component={GardenSetupScreen}
        options={{
          ...screenOptions.GardenSetup,
          headerShown: true,
        }}
        initialParams={{
          area: undefined,
          sunlight: undefined,
          zoneId: undefined,
        }}
      />

      <Stack.Screen
        name="LayoutView"
        component={GardenLayoutScreen}
        options={({ route }) => ({
          ...screenOptions.LayoutView,
          headerShown: true,
          // Enable editing mode based on route params
          title: route.params?.isEditing ? 'Edit Layout' : 'Garden Layout',
        })}
        initialParams={{
          gardenId: '',
          isEditing: false,
        }}
      />
    </Stack.Navigator>
  );
};

/**
 * Validates navigation parameters for type safety and constraints
 * @param params Navigation parameters
 * @returns boolean indicating if parameters are valid
 */
const validateNavigationParams = (params: Partial<RootStackParamList['GardenSetup']>): boolean => {
  if (params.area !== undefined) {
    if (params.area < GARDEN_VALIDATION.AREA_LIMITS.MIN || 
        params.area > GARDEN_VALIDATION.AREA_LIMITS.MAX) {
      return false;
    }
  }

  if (params.sunlight !== undefined) {
    if (!Object.values(params.sunlight).includes(params.sunlight)) {
      return false;
    }
  }

  return true;
};

export default GardenNavigator;