/**
 * Typography constants for the garden planner web application.
 * Implements a comprehensive typography system with consistent font families,
 * sizes, weights, and line heights for optimal readability and accessibility.
 * @version 1.0.0
 */

/**
 * Font family definitions using system font stacks for optimal performance.
 * Includes primary, secondary and fallback options to ensure consistent rendering
 * across different platforms and browsers.
 */
export const FONT_FAMILY = {
  primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  secondary: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fallback: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
} as const;

/**
 * Font size scale using rem units for consistent and accessible text sizing.
 * Scales appropriately across different screen sizes while maintaining readability.
 * Base size (md) is 1rem = 16px in most browsers.
 */
export const FONT_SIZE = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  md: '1rem',       // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  xxl: '1.5rem',    // 24px
  display: '2rem'   // 32px
} as const;

/**
 * Font weight scale for optimal text emphasis and hierarchy.
 * Uses numeric values for better cross-browser compatibility.
 * Follows standard weight naming conventions.
 */
export const FONT_WEIGHT = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800
} as const;

/**
 * Line height scale for optimal readability and vertical rhythm.
 * Uses unitless values for better inheritance and flexibility.
 * Provides options from compact to loose spacing.
 */
export const LINE_HEIGHT = {
  none: 1,        // No line spacing
  tight: 1.25,    // Compact
  snug: 1.375,    // Slightly compact
  normal: 1.5,    // Standard
  relaxed: 1.625, // Slightly loose
  loose: 2        // Very loose
} as const;