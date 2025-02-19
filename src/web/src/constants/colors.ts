/**
 * Type definition for color palette objects with string keys and string values
 * Ensures type safety and immutability for color constants
 */
export type ColorPalette = {
  readonly [K in string]: string;
};

/**
 * Core application color palette
 * Defines the main colors used throughout the application
 * Based on Material Design color system for consistency
 * @version 1.0.0
 */
export const COLORS: ColorPalette = {
  PRIMARY: '#2E7D32', // Primary green for main UI elements
  SECONDARY: '#81C784', // Light green for accents and secondary elements
  BACKGROUND: '#F5F5F5', // Light grey for backgrounds
  TEXT: '#212121', // Dark grey for text content
  ALERT: '#F44336', // Red for warnings and errors
} as const;

/**
 * Garden zone color indicators
 * Used to visually distinguish different sunlight exposure zones in the garden layout
 * Colors chosen for clear visual distinction and semantic meaning
 * @version 1.0.0
 */
export const GARDEN_ZONE_COLORS: ColorPalette = {
  FULL_SUN: '#FFB300', // Amber for full sun areas
  PARTIAL_SHADE: '#7CB342', // Light green for partial shade
  FULL_SHADE: '#546E7A', // Blue grey for full shade
} as const;

/**
 * Plant status color indicators
 * Used to represent different plant health states
 * Following traffic light color convention for intuitive understanding
 * @version 1.0.0
 */
export const PLANT_STATUS_COLORS: ColorPalette = {
  HEALTHY: '#4CAF50', // Green for healthy plants
  NEEDS_ATTENTION: '#FFC107', // Amber for plants needing attention
  CRITICAL: '#F44336', // Red for critical plant status
} as const;