import React from 'react';
import { createStackNavigator } from '@react-navigation/stack'; // ^6.0.0
import { CardStyleInterpolators } from '@react-navigation/stack';

// Import screens
import SettingsScreen from '../screens/settings/SettingsScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import ProfileScreen from '../screens/settings/ProfileScreen';

// Import types
import { RootStackParamList } from './types';

/**
 * Type-safe parameter list for settings stack navigation
 */
interface SettingsStackParamList {
  Settings: undefined;
  NotificationSettings: undefined;
  Profile: undefined;
}

// Create type-safe stack navigator
const Stack = createStackNavigator<SettingsStackParamList>();

/**
 * Screen options for consistent styling and transitions
 */
const screenOptions = {
  headerStyle: {
    backgroundColor: '#2E7D32', // Primary color from theme
    elevation: 0,
    shadowOpacity: 0,
  },
  headerTintColor: '#FFFFFF',
  headerTitleStyle: {
    fontWeight: 'bold',
  },
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
};

/**
 * Settings navigation stack component with screen preloading
 * and accessibility support
 * @returns JSX.Element Settings navigation stack
 */
const SettingsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={screenOptions}
      screenListeners={{
        focus: (e) => {
          // Announce screen change to screen readers
          const routeName = e.target?.split('-')[0];
          const announcement = `${routeName} screen`;
          if (routeName) {
            const ariaLive = document.createElement('div');
            ariaLive.setAttribute('aria-live', 'polite');
            ariaLive.textContent = announcement;
            document.body.appendChild(ariaLive);
            setTimeout(() => document.body.removeChild(ariaLive), 1000);
          }
        },
      }}
    >
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerLeft: () => null, // Hide back button on main settings screen
        }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{
          title: 'Notification Settings',
          headerBackAccessibilityLabel: 'Go back to settings',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile Settings',
          headerBackAccessibilityLabel: 'Go back to settings',
        }}
      />
    </Stack.Navigator>
  );
};

export default SettingsNavigator;