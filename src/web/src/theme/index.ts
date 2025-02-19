import { theme as colorTheme } from './colors';
import { typography } from './typography';
import { spacing, getResponsiveSpacing } from './spacing';
import { breakpoints, mediaQueries } from './breakpoints';

/**
 * Interface defining the complete theme structure
 * Combines all theme-related configurations into a single, strongly-typed object
 * @version 1.0.0
 */
interface Theme {
  readonly colors: typeof colorTheme;
  readonly typography: typeof typography;
  readonly spacing: typeof spacing;
  readonly breakpoints: typeof breakpoints;
  readonly mediaQueries: typeof mediaQueries;
  readonly utils: {
    getResponsiveSpacing: typeof getResponsiveSpacing;
  };
}

/**
 * Creates and memoizes the complete theme configuration
 * Combines colors, typography, spacing, and responsive utilities
 * into a single, immutable theme object
 * @returns {Theme} Complete theme configuration
 */
const createTheme = (): Theme => {
  // Validate color accessibility
  const validateColorContrast = () => {
    // Color contrast validation could be implemented here
    // This is a placeholder for future accessibility checks
    return true;
  };

  // Validate theme configuration
  if (!validateColorContrast()) {
    console.warn('Theme colors may not meet accessibility standards');
  }

  // Create immutable theme object
  return Object.freeze({
    // Color palette and garden-specific colors
    colors: colorTheme,

    // Typography configuration
    typography,

    // Spacing system
    spacing,

    // Responsive breakpoints
    breakpoints,

    // Media query helpers
    mediaQueries,

    // Utility functions
    utils: {
      getResponsiveSpacing,
    },
  });
};

/**
 * Main theme configuration object
 * Provides consistent styling system across the application
 * @example
 * import { theme } from './theme';
 * 
 * const StyledComponent = styled.div`
 *   color: ${theme.colors.palette.primary.base};
 *   font-size: ${theme.typography.body1.fontSize};
 *   margin: ${theme.spacing.medium};
 *   
 *   ${theme.mediaQueries.large} {
 *     margin: ${theme.utils.getResponsiveSpacing('large')};
 *   }
 * `;
 */
export const theme = createTheme();

/**
 * Re-export spacing utility for direct access
 * Allows using the spacing function without accessing through theme object
 */
export { getResponsiveSpacing };

/**
 * Type definitions for theme configuration
 * Enables type checking and autocompletion when using theme values
 */
export type AppTheme = typeof theme;