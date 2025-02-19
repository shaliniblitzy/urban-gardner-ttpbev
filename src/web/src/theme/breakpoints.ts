/**
 * Breakpoints and media queries configuration for responsive design
 * Implements responsive behavior for small (<375px), medium (376-768px), and large (>768px) screens
 * @version 1.0.0
 */

/**
 * Breakpoint values in pixels for different screen sizes
 */
export const breakpoints = {
  small: 375,
  medium: 768,
  large: 1024,
} as const;

/**
 * Creates a CSS media query string based on min and max width constraints
 * @param minWidth - Minimum width in pixels
 * @param maxWidth - Optional maximum width in pixels
 * @returns Formatted CSS media query string
 */
const createMediaQuery = (minWidth: number, maxWidth?: number): string => {
  // Validate input parameters
  if (minWidth < 0) {
    throw new Error('Minimum width must be a positive number');
  }
  if (maxWidth !== undefined && maxWidth <= minWidth) {
    throw new Error('Maximum width must be greater than minimum width');
  }

  // Generate appropriate media query based on provided parameters
  if (maxWidth === undefined) {
    return `@media screen and (min-width: ${minWidth}px)`;
  }
  return `@media screen and (min-width: ${minWidth}px) and (max-width: ${maxWidth - 0.02}px)`;
};

/**
 * Pre-formatted media query strings for different screen sizes
 * Used for implementing responsive styling in components
 */
export const mediaQueries = {
  // Min-width queries for progressive enhancement
  small: createMediaQuery(breakpoints.small),
  medium: createMediaQuery(breakpoints.medium),
  large: createMediaQuery(breakpoints.large),

  // Range queries for targeting specific breakpoint ranges
  smallOnly: createMediaQuery(0, breakpoints.small),
  mediumOnly: createMediaQuery(breakpoints.small, breakpoints.medium),
  largeOnly: createMediaQuery(breakpoints.medium, breakpoints.large),
} as const;

/**
 * Type definitions for breakpoint values and media queries
 * Ensures type safety when using breakpoints and media queries throughout the application
 */
export type Breakpoint = keyof typeof breakpoints;
export type MediaQuery = keyof typeof mediaQueries;

/**
 * Example usage:
 * import { mediaQueries } from './theme/breakpoints';
 * 
 * const ResponsiveComponent = styled.div`
 *   ${mediaQueries.small} {
 *     // Styles for small screens
 *   }
 *   ${mediaQueries.medium} {
 *     // Styles for medium screens
 *   }
 *   ${mediaQueries.large} {
 *     // Styles for large screens
 *   }
 * `;
 */