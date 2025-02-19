import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT, LINE_HEIGHT } from '../constants/fonts';

/**
 * Typography theme configuration for the garden planner web application.
 * Defines consistent text styles for different elements using predefined
 * font families, sizes, weights, and line heights.
 * 
 * @version 1.0.0
 */
export const typography = {
  /**
   * H1 - Primary heading style
   * Used for main page titles and major section headers
   */
  h1: {
    fontFamily: FONT_FAMILY.primary,
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: LINE_HEIGHT.tight,
  },

  /**
   * H2 - Secondary heading style
   * Used for section headings and important content blocks
   */
  h2: {
    fontFamily: FONT_FAMILY.primary,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    lineHeight: LINE_HEIGHT.tight,
  },

  /**
   * H3 - Tertiary heading style
   * Used for subsection headings and feature titles
   */
  h3: {
    fontFamily: FONT_FAMILY.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: LINE_HEIGHT.normal,
  },

  /**
   * Body1 - Primary body text style
   * Used for main content and descriptions
   */
  body1: {
    fontFamily: FONT_FAMILY.secondary,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.regular,
    lineHeight: LINE_HEIGHT.normal,
  },

  /**
   * Body2 - Secondary body text style
   * Used for supporting content and less prominent text
   */
  body2: {
    fontFamily: FONT_FAMILY.secondary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.regular,
    lineHeight: LINE_HEIGHT.normal,
  },

  /**
   * Caption - Small text style
   * Used for labels, hints, and supplementary information
   */
  caption: {
    fontFamily: FONT_FAMILY.secondary,
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.regular,
    lineHeight: LINE_HEIGHT.normal,
  },

  /**
   * Button - Interactive element text style
   * Used for buttons, links, and other clickable elements
   */
  button: {
    fontFamily: FONT_FAMILY.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    lineHeight: LINE_HEIGHT.tight,
  },
} as const;

export default typography;