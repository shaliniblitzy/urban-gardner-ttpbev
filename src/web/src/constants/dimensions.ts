/**
 * Standardized dimension constants for the garden planner web application.
 * Provides consistent sizing, spacing, and responsive breakpoints across the UI.
 */

/**
 * Screen size breakpoints for responsive layouts
 * - SMALL: Mobile devices (<375px)
 * - MEDIUM: Tablets (376px-768px)
 * - LARGE: Desktop (>768px)
 */
export const SCREEN_SIZES = {
    SMALL: 375,
    MEDIUM: 768,
    LARGE: 1024
} as const;

/**
 * Standard component dimensions for consistent UI sizing
 * All measurements in pixels
 */
export const COMPONENT_SIZES = {
    HEADER_HEIGHT: 64,
    FOOTER_HEIGHT: 48,
    SIDEBAR_WIDTH: 240,
    CARD_MIN_WIDTH: 280,
    BUTTON_HEIGHT: 40,
    INPUT_HEIGHT: 48
} as const;

/**
 * Garden grid visualization system dimensions
 * Defines cell sizes and zone constraints for the garden layout
 * All measurements in pixels
 */
export const GARDEN_GRID = {
    CELL_SIZE: 32,
    MIN_ZONE_WIDTH: 120,
    MAX_ZONE_WIDTH: 320,
    GRID_GAP: 8
} as const;

/**
 * Global layout dimensions for consistent page structure
 * Defines maximum widths, padding, and margins
 * All measurements in pixels
 */
export const LAYOUT = {
    MAX_CONTENT_WIDTH: 1200,
    PAGE_PADDING: 16,
    SECTION_MARGIN: 24
} as const;

// Type definitions for exported constants
export type ScreenSizes = typeof SCREEN_SIZES;
export type ComponentSizes = typeof COMPONENT_SIZES;
export type GardenGrid = typeof GARDEN_GRID;
export type Layout = typeof LAYOUT;