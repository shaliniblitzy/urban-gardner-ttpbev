/**
 * @fileoverview TypeScript type definitions for plant management and tracking
 * @version 1.0.0
 * 
 * Defines comprehensive types and interfaces for:
 * - Plant types and growth stages
 * - Growth parameters and requirements
 * - Maintenance scheduling and history
 * - Health monitoring and care tasks
 */

import { SunlightCondition } from '../types/zone.types';

/**
 * Enum representing supported plant types in the garden planner
 * Based on the initial vegetable requirements from technical specifications
 */
export enum PlantType {
    TOMATOES = 'TOMATOES',
    LETTUCE = 'LETTUCE',
    CARROTS = 'CARROTS'
}

/**
 * Enum representing plant growth stages for lifecycle tracking
 * Used to determine care requirements and expected yields
 */
export enum GrowthStage {
    SEEDLING = 'SEEDLING',
    GROWING = 'GROWING',
    MATURE = 'MATURE',
    HARVESTING = 'HARVESTING'
}

/**
 * Enum representing plant health status
 * Used for monitoring and triggering maintenance alerts
 */
export enum PlantHealth {
    EXCELLENT = 'EXCELLENT',
    GOOD = 'GOOD',
    FAIR = 'FAIR',
    POOR = 'POOR'
}

/**
 * Enum representing types of maintenance activities
 * Used for scheduling and record keeping
 */
export enum MaintenanceType {
    WATERING = 'WATERING',
    FERTILIZING = 'FERTILIZING',
    PRUNING = 'PRUNING',
    PEST_CONTROL = 'PEST_CONTROL'
}

/**
 * Interface for tracking maintenance activities
 * Records history of care tasks performed
 */
export interface MaintenanceRecord {
    /** Date maintenance was performed */
    date: Date;
    /** Type of maintenance activity */
    type: MaintenanceType;
    /** Optional notes about the maintenance performed */
    notes: string;
}

/**
 * Interface for custom care tasks in maintenance schedule
 * Allows for plant-specific care requirements
 */
export interface CustomCareTask {
    /** Unique identifier for the task */
    taskId: string;
    /** Description of the care task */
    description: string;
    /** Frequency in days */
    frequency: number;
    /** Next scheduled date for the task */
    nextDueDate: Date;
}

/**
 * Interface for plant care scheduling
 * Manages recurring maintenance tasks and custom care requirements
 */
export interface PlantCareSchedule {
    /** Reference to the plant ID */
    plantId: string;
    /** Days between watering */
    wateringFrequencyDays: number;
    /** Days between fertilizing */
    fertilizingFrequencyDays: number;
    /** Minimum daily sunlight hours required */
    minSunlightHours: number;
    /** Next scheduled watering date */
    nextWateringDate: Date;
    /** Next scheduled fertilizing date */
    nextFertilizingDate: Date;
    /** Array of custom care tasks */
    customTasks: CustomCareTask[];
}

/**
 * Main interface for plant data
 * Comprehensive tracking of plant characteristics, growth, and maintenance
 */
export interface Plant {
    /** Unique identifier for the plant */
    id: string;
    /** Type of plant */
    type: PlantType;
    /** Current growth stage */
    growthStage: GrowthStage;
    /** Sunlight requirements */
    sunlightNeeds: SunlightCondition;
    /** Required spacing in square feet */
    spacing: number;
    /** Days until plant reaches maturity */
    daysToMaturity: number;
    /** Date when plant was started */
    plantedDate: Date;
    /** Date of last watering */
    lastWateredDate: Date;
    /** Date of last fertilizing */
    lastFertilizedDate: Date;
    /** Array of compatible plant types for companion planting */
    companionPlants: PlantType[];
    /** Expected yield in kilograms */
    expectedYield: number;
    /** Current health status */
    healthStatus: PlantHealth;
    /** Array of maintenance records */
    maintenanceHistory: MaintenanceRecord[];
}