/**
 * Navigation constants for the Garden Planner application
 * Defines routes, screen titles and navigation options used throughout the app
 * @version 1.0.0
 */

/**
 * Route name constants used for navigation throughout the application
 */
export const ROUTES = {
  HOME: 'Home',
  GARDEN_SETUP: 'GardenSetup',
  LAYOUT_VIEW: 'LayoutView',
  SCHEDULE_VIEW: 'ScheduleView',
  SETTINGS: 'Settings',
} as const;

/**
 * Display titles for each screen in the navigation stack
 * These are shown in the navigation header and for accessibility
 */
export const SCREEN_TITLES = {
  HOME: 'Garden Dashboard',
  GARDEN_SETUP: 'Garden Setup',
  LAYOUT_VIEW: 'Garden Layout',
  SCHEDULE_VIEW: 'Care Schedule',
  SETTINGS: 'Settings',
} as const;

/**
 * Default navigation options used across the application's navigation stacks
 * Configures common navigation behaviors and animations
 */
export const NAVIGATION_OPTIONS = {
  headerShown: true,
  animation: 'slide_from_right',
  gestureEnabled: true,
} as const;

// Type definitions for strict type checking
export type RouteNames = typeof ROUTES[keyof typeof ROUTES];
export type ScreenTitles = typeof SCREEN_TITLES[keyof typeof SCREEN_TITLES];