/**
 * Garden Interfaces
 * @packageVersion 5.0
 * 
 * Defines TypeScript interfaces for garden-related data structures including garden configuration,
 * layout, zones, and optimization parameters. Supports the garden space optimization feature (F-001)
 * and related functional requirements.
 */

import { IPlant } from './plant.interface';
import { 
    GARDEN_AREA_LIMITS,
    SUNLIGHT_CONDITIONS
} from '../constants/garden.constants';

/**
 * Main garden interface defining core garden properties
 * Enforces garden area validation (F-001-RQ-001) and tracks garden zones
 * @interface IGarden
 */
export interface IGarden {
    /** Unique identifier for the garden */
    id: string;

    /** Total garden area in square feet (must be between MIN_AREA and MAX_AREA) */
    area: number;

    /** Array of garden zones with specific sunlight conditions */
    zones: IGardenZone[];

    /** Garden creation timestamp */
    createdAt: Date;

    /** Last modification timestamp */
    updatedAt: Date;
}

/**
 * Interface for garden zones with specific sunlight conditions
 * Supports sunlight condition specification (F-001-RQ-002)
 * @interface IGardenZone
 */
export interface IGardenZone {
    /** Unique identifier for the zone */
    id: string;

    /** Zone area in square feet */
    area: number;

    /** Sunlight condition for the zone */
    sunlightCondition: typeof SUNLIGHT_CONDITIONS[keyof typeof SUNLIGHT_CONDITIONS];

    /** Plants placed within this zone */
    plants: IPlant[];
}

/**
 * Interface for optimized garden layout configuration
 * Represents the output of the garden space optimization algorithm
 * @interface IGardenLayout
 */
export interface IGardenLayout {
    /** Reference to the garden this layout belongs to */
    gardenId: string;

    /** Percentage of total garden space utilized (target: 92%) */
    spaceUtilization: number;

    /** Optimized arrangement of garden zones */
    zones: IGardenZone[];

    /** Timestamp when layout was generated */
    generatedAt: Date;
}

/**
 * Interface for garden optimization algorithm parameters
 * Controls the behavior of the space optimization algorithm
 * @interface IGardenOptimizationParams
 */
export interface IGardenOptimizationParams {
    /** Target percentage for space utilization */
    targetUtilization: number;

    /** Minimum size for a garden zone in square feet */
    minZoneSize: number;

    /** Default spacing between plants in inches */
    defaultSpacing: number;

    /** Maximum number of zones to create */
    maxZoneCount: number;

    /** Whether to consider companion planting in layout */
    companionPlantingEnabled: boolean;

    /** Zone size distribution strategy */
    zoneBalancing: 'equal' | 'optimal';

    /** Whether to adjust layout based on seasonal factors */
    seasonalAdjustments: boolean;
}