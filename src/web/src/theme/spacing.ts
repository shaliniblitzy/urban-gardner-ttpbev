/**
 * Spacing system configuration for the garden planner web application
 * Provides consistent, responsive spacing values across all components
 * @version 1.0.0
 */

import { breakpoints } from './breakpoints';

/**
 * Base spacing unit in pixels
 * All spacing values are calculated as multiples of this base unit
 */
const BASE_SPACING = 8;

/**
 * Spacing scale multipliers
 * Defines the relative size of each spacing variant
 */
const SPACING_SCALE = {
  xxsmall: 0.25, // 2px
  xsmall: 0.5,   // 4px
  small: 1,      // 8px
  medium: 2,     // 16px
  large: 3,      // 24px
  xlarge: 4,     // 32px
  xxlarge: 5,    // 40px
} as const;

type SpacingSize = keyof typeof SPACING_SCALE;

/**
 * Options for responsive spacing calculations
 */
interface ResponsiveSpacingOptions {
  /** Screen-specific modifiers for spacing values */
  responsive?: {
    small?: number;
    medium?: number;
    large?: number;
  };
  /** Whether to apply RTL layout adjustments */
  rtl?: boolean;
}

/**
 * Cache for memoized spacing calculations
 */
const spacingCache = new Map<string, string>();

/**
 * Calculates responsive spacing values that adapt to different screen sizes
 * @param size - Spacing scale identifier
 * @param options - Configuration options for responsive and RTL adjustments
 * @returns CSS spacing value with px unit
 */
export const getResponsiveSpacing = (
  size: SpacingSize,
  options: ResponsiveSpacingOptions = {}
): string => {
  // Generate cache key
  const cacheKey = `${size}-${JSON.stringify(options)}`;
  
  // Return cached value if available
  if (spacingCache.has(cacheKey)) {
    return spacingCache.get(cacheKey)!;
  }

  // Validate size parameter
  if (!(size in SPACING_SCALE)) {
    throw new Error(`Invalid spacing size: ${size}`);
  }

  // Get base multiplier from scale
  const baseMultiplier = SPACING_SCALE[size];
  
  // Calculate base spacing value
  let spacingValue = baseMultiplier * BASE_SPACING;

  // Apply screen-specific modifiers if provided
  if (options.responsive) {
    const screenWidth = window.innerWidth;
    
    if (screenWidth >= breakpoints.large && options.responsive.large) {
      spacingValue *= options.responsive.large;
    } else if (screenWidth >= breakpoints.medium && options.responsive.medium) {
      spacingValue *= options.responsive.medium;
    } else if (options.responsive.small) {
      spacingValue *= options.responsive.small;
    }
  }

  // Apply RTL adjustments if needed
  if (options.rtl) {
    // RTL adjustments can be implemented here if needed
    // Currently maintaining the same spacing for RTL
  }

  // Format final value
  const result = `${Math.round(spacingValue)}px`;
  
  // Cache the result
  spacingCache.set(cacheKey, result);
  
  return result;
};

/**
 * Generates complete spacing configuration with pre-calculated values
 */
const createSpacing = () => {
  const spacing: Record<SpacingSize, string> = {} as Record<SpacingSize, string>;

  // Calculate base spacing values
  Object.keys(SPACING_SCALE).forEach((size) => {
    spacing[size as SpacingSize] = getResponsiveSpacing(size as SpacingSize);
  });

  return spacing;
};

/**
 * Pre-calculated spacing values for common use cases
 * Use these values for consistent component spacing across the application
 */
export const spacing = createSpacing();

/**
 * Example usage:
 * import { spacing, getResponsiveSpacing } from './theme/spacing';
 * 
 * // Using pre-calculated values
 * const StyledComponent = styled.div`
 *   margin: ${spacing.medium};
 *   padding: ${spacing.small};
 * `;
 * 
 * // Using responsive values
 * const ResponsiveComponent = styled.div`
 *   margin: ${getResponsiveSpacing('medium', {
 *     responsive: {
 *       small: 0.8,
 *       medium: 1,
 *       large: 1.2
 *     }
 *   })};
 * `;
 */