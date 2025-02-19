/**
 * Plant-related interfaces for the garden planner application
 * Provides comprehensive type definitions for plant properties, growth stages,
 * care requirements, and maintenance schedules
 * @version 1.0.0
 */

import {
    PLANT_TYPES,
    GROWTH_STAGES,
    SUNLIGHT_REQUIREMENTS
} from '../constants/plant.constants';

/**
 * Core plant interface defining all essential properties for garden planning
 * and maintenance tracking
 * @interface IPlant
 */
export interface IPlant {
    /** Unique identifier for the plant instance */
    id: string;

    /** Type of plant from supported varieties */
    type: PLANT_TYPES;

    /** Current growth stage in plant's lifecycle */
    growthStage: GROWTH_STAGES;

    /** Sunlight requirements for optimal growth */
    sunlightNeeds: SUNLIGHT_REQUIREMENTS;

    /** Required spacing in inches between plants */
    spacing: number;

    /** Expected days from planting to maturity */
    daysToMaturity: number;

    /** Date when plant was added to garden */
    plantedDate: Date;

    /** Most recent watering date */
    lastWateredDate: Date;

    /** Most recent fertilizing date */
    lastFertilizedDate: Date;

    /** Array of compatible plant types for companion planting */
    companionPlants: PLANT_TYPES[];

    /** Daily water requirement in milliliters */
    waterRequirementMl: number;

    /** Expected yield in kilograms at maturity */
    expectedYieldKg: number;
}

/**
 * Plant care schedule interface for maintenance planning and notifications
 * Tracks all recurring care tasks and important dates
 * @interface IPlantCareSchedule
 */
export interface IPlantCareSchedule {
    /** Reference to associated plant */
    plantId: string;

    /** Days between watering tasks */
    wateringFrequencyDays: number;

    /** Days between fertilizing tasks */
    fertilizingFrequencyDays: number;

    /** Minimum daily sunlight hours needed */
    minSunlightHours: number;

    /** Days between pruning tasks */
    pruningFrequencyDays: number;

    /** Number of days in optimal harvest window */
    harvestWindowDays: number;

    /** Next scheduled watering date */
    nextWateringDate: Date;

    /** Next scheduled fertilizing date */
    nextFertilizingDate: Date;

    /** Projected harvest date based on growth progress */
    expectedHarvestDate: Date;
}