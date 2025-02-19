// @react-navigation/native version: ^6.0.0
import { NavigationProp, RouteProp } from '@react-navigation/native';

/**
 * Defines the possible sunlight conditions for garden zones
 */
export type SunlightCondition = {
  type: 'full' | 'partial' | 'shade';
};

/**
 * Interface defining vegetable requirements for garden planning
 */
export interface VegetableRequirement {
  type: string;
  quantity: number;
}

/**
 * Root navigation stack parameter list defining all routes and their parameters
 */
export interface RootStackParamList {
  /** Home dashboard screen - no parameters required */
  Home: undefined;

  /** Garden setup screen with optional initial values */
  GardenSetup: {
    area?: number;
    sunlight?: SunlightCondition;
    vegetableRequirements?: VegetableRequirement[];
  };

  /** Garden layout view screen */
  LayoutView: {
    gardenId: string;
    optimizationId?: string;
    isEditing?: boolean;
  };

  /** Maintenance schedule view screen */
  ScheduleView: {
    gardenId: string;
    date?: string;
    filterType?: 'all' | 'pending' | 'completed';
  };

  /** Task details screen */
  TaskDetails: {
    taskId: string;
    gardenId: string;
  };

  /** Settings screen with optional section focus */
  Settings: {
    section?: 'notifications' | 'profile' | 'preferences';
  };

  /** User profile screen - no parameters required */
  Profile: undefined;
}

/**
 * Type definition for navigation props used in screen components
 * Provides type-safe navigation methods and parameters
 */
export type NavigationProps = {
  navigation: NavigationProp<RootStackParamList>;
};

/**
 * Type definition for route props used to access navigation parameters
 * Ensures type safety when accessing route parameters in components
 */
export type RouteProps<T extends keyof RootStackParamList> = {
  route: RouteProp<RootStackParamList, T>;
};

/**
 * Helper type for combined navigation and route props
 * Useful for components that need both navigation and route parameters
 */
export type ScreenProps<T extends keyof RootStackParamList> = 
  NavigationProps & RouteProps<T>;