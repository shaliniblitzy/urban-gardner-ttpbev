/**
 * @fileoverview TypeScript type definitions for garden management and optimization
 * @version 1.0.0
 * 
 * Defines comprehensive types and interfaces for:
 * - Garden configuration and properties
 * - Garden zones and layouts
 * - Optimization parameters and results
 */

import { Plant } from '../types/plant.types';
import { SunlightCondition } from '../types/zone.types';

/**
 * Main interface for garden configuration
 * Represents the core garden properties and structure
 */
export interface Garden {
    /** Unique identifier for the garden */
    id: string;
    /** Total garden area in square feet (1-1000) */
    area: number;
    /** Array of zones within the garden */
    zones: GardenZone[];
    /** Garden creation timestamp */
    createdAt: Date;
    /** Last modification timestamp */
    updatedAt: Date;
}

/**
 * Interface for garden zones with specific conditions
 * Represents distinct areas within the garden
 */
export interface GardenZone {
    /** Unique identifier for the zone */
    id: string;
    /** Zone area in square feet */
    area: number;
    /** Sunlight condition for this zone */
    sunlightCondition: SunlightCondition;
    /** Array of plants placed in this zone */
    plants: Plant[];
}

/**
 * Interface for optimized garden layout configuration
 * Contains placement and utilization information
 */
export interface GardenLayout {
    /** Reference to the garden ID */
    gardenId: string;
    /** Percentage of space utilized (0-100) */
    spaceUtilization: number;
    /** Array of optimized zones */
    zones: GardenZone[];
    /** Timestamp of layout generation */
    generatedAt: Date;
}

/**
 * Interface for garden creation input data
 * Contains minimal required information to create a new garden
 */
export interface GardenInput {
    /** Total garden area in square feet (1-1000) */
    area: number;
    /** Array of initial zones without IDs */
    zones: Omit<GardenZone, 'id'>[];
}

/**
 * Interface for garden optimization algorithm parameters
 * Controls the behavior of the space optimization algorithm
 */
export interface GardenOptimizationParams {
    /** Target space utilization percentage (0-100) */
    targetUtilization: number;
    /** Minimum zone size in square feet */
    minZoneSize: number;
    /** Default plant spacing when not specified */
    defaultSpacing: number;
}