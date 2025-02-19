/**
 * @fileoverview TypeScript type definitions for garden zone management
 * @version 1.0.0
 * 
 * Defines types and interfaces for garden zones, including:
 * - Sunlight conditions
 * - Zone dimensions and positioning
 * - Plant placement and spacing
 * - Zone optimization results
 */

/**
 * Enum representing possible sunlight conditions for garden zones
 * Used for determining plant compatibility and optimal placement
 */
export enum SunlightCondition {
    FULL_SUN = 'FULL_SUN',           // 6+ hours direct sunlight
    PARTIAL_SHADE = 'PARTIAL_SHADE',  // 3-6 hours direct sunlight
    FULL_SHADE = 'FULL_SHADE'        // <3 hours direct sunlight
}

/**
 * Interface for minimal plant reference information within zones
 * Used to track plant placement and spacing requirements
 */
export interface PlantReference {
    /** Unique identifier for the plant */
    id: string;
    /** Required spacing in square feet */
    spacing: number;
}

/**
 * Main interface for garden zone definition
 * Represents a distinct area within the garden with specific conditions
 */
export interface Zone {
    /** Unique identifier for the zone */
    id: string;
    /** Zone area in square feet */
    area: number;
    /** Sunlight condition for this zone */
    sunlightCondition: SunlightCondition;
    /** Array of plants placed in this zone */
    plants: PlantReference[];
    /** Position coordinates within the garden layout */
    position: {
        x: number;
        y: number;
    };
}

/**
 * Interface for zone creation input data
 * Contains minimal required information to create a new zone
 */
export interface ZoneInput {
    /** Zone area in square feet */
    area: number;
    /** Sunlight condition for the zone */
    sunlightCondition: SunlightCondition;
}

/**
 * Interface for optimization results of zone layout
 * Contains placement information and space utilization metrics
 */
export interface ZoneOptimizationResult {
    /** ID of the zone being optimized */
    zoneId: string;
    /** Percentage of space utilized (0-100) */
    spaceUtilization: number;
    /** Array of optimized plant placements */
    plantPlacements: Array<{
        /** ID of the placed plant */
        plantId: string;
        /** Coordinates for plant placement */
        position: {
            x: number;
            y: number;
        };
    }>;
}