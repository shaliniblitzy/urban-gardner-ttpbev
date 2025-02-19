import { COLORS, GARDEN_ZONE_COLORS, PLANT_STATUS_COLORS } from '../constants/colors';

/**
 * Interface defining the structure of color variants for UI states
 * @version 1.0.0
 */
interface ColorVariants {
  readonly base: string;
  readonly light: string;
  readonly dark: string;
}

/**
 * Interface defining the structure of the theme color palette
 * @version 1.0.0
 */
interface ThemeColors {
  readonly primary: ColorVariants;
  readonly secondary: ColorVariants;
  readonly background: string;
  readonly text: string;
  readonly alert: ColorVariants;
}

/**
 * Interface defining garden-specific color configurations
 * @version 1.0.0
 */
interface GardenColors {
  readonly zones: {
    readonly fullSun: string;
    readonly partialShade: string;
    readonly fullShade: string;
  };
  readonly plantStatus: {
    readonly healthy: string;
    readonly needsAttention: string;
    readonly critical: string;
  };
}

/**
 * Creates light and dark variants of a base color for different UI states
 * Memoized for performance optimization
 * @param baseColor - The base color in hex format
 * @returns Object containing base, light and dark variants
 */
const createColorVariants = (baseColor: string): ColorVariants => {
  // Convert hex to RGB for manipulation
  const hex = baseColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Create light variant (increase lightness by 10%)
  const lightVariant = `#${Math.min(255, Math.floor(r * 1.1)).toString(16).padStart(2, '0')}${
    Math.min(255, Math.floor(g * 1.1)).toString(16).padStart(2, '0')}${
    Math.min(255, Math.floor(b * 1.1)).toString(16).padStart(2, '0')}`;

  // Create dark variant (decrease lightness by 10%)
  const darkVariant = `#${Math.floor(r * 0.9).toString(16).padStart(2, '0')}${
    Math.floor(g * 0.9).toString(16).padStart(2, '0')}${
    Math.floor(b * 0.9).toString(16).padStart(2, '0')}`;

  return {
    base: baseColor,
    light: lightVariant,
    dark: darkVariant,
  };
};

/**
 * Theme configuration object containing color palette and garden-specific colors
 * @version 1.0.0
 */
export const theme = {
  palette: {
    primary: createColorVariants(COLORS.PRIMARY),
    secondary: createColorVariants(COLORS.SECONDARY),
    background: COLORS.BACKGROUND,
    text: COLORS.TEXT,
    alert: createColorVariants(COLORS.ALERT),
  } as ThemeColors,

  garden: {
    zones: {
      fullSun: GARDEN_ZONE_COLORS.FULL_SUN,
      partialShade: GARDEN_ZONE_COLORS.PARTIAL_SHADE,
      fullShade: GARDEN_ZONE_COLORS.FULL_SHADE,
    },
    plantStatus: {
      healthy: PLANT_STATUS_COLORS.HEALTHY,
      needsAttention: PLANT_STATUS_COLORS.NEEDS_ATTENTION,
      critical: PLANT_STATUS_COLORS.CRITICAL,
    },
  } as GardenColors,
};