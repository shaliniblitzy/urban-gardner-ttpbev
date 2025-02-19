/**
 * Plant Validator Module
 * Provides comprehensive validation for plant-related data including growth parameters,
 * spacing requirements, and companion planting compatibility
 * @version 1.0.0
 */

import { ValidationError } from 'class-validator'; // v0.14.0
import {
    IPlant,
    PLANT_TYPES,
    GROWTH_STAGES,
    SUNLIGHT_REQUIREMENTS,
    DEFAULT_PLANT_SPACING,
    COMPANION_PLANTS,
    MIN_SUNLIGHT_HOURS
} from '../interfaces/plant.interface';

/**
 * Validates if the plant type is supported by the system
 * @param plantType - Type of plant to validate
 * @throws ValidationError if plant type is invalid
 */
export const validatePlantType = (plantType: string): boolean => {
    if (!plantType || typeof plantType !== 'string') {
        throw new ValidationError('Plant type must be a non-empty string');
    }

    const validTypes = Object.values(PLANT_TYPES);
    if (!validTypes.includes(plantType as PLANT_TYPES)) {
        throw new ValidationError(
            `Invalid plant type. Supported types are: ${validTypes.join(', ')}`
        );
    }

    return true;
};

/**
 * Validates plant spacing requirements considering companion planting
 * @param spacing - Spacing in inches between plants
 * @param plantType - Type of plant being validated
 * @param adjacentPlants - Array of plants adjacent to the current plant
 * @throws ValidationError if spacing requirements are not met
 */
export const validatePlantSpacing = (
    spacing: number,
    plantType: PLANT_TYPES,
    adjacentPlants: IPlant[]
): boolean => {
    if (typeof spacing !== 'number' || spacing <= 0) {
        throw new ValidationError('Spacing must be a positive number');
    }

    const minSpacing = DEFAULT_PLANT_SPACING[plantType];
    if (spacing < minSpacing) {
        throw new ValidationError(
            `Minimum spacing for ${plantType} is ${minSpacing} inches`
        );
    }

    // Validate companion planting spacing
    adjacentPlants.forEach(adjacent => {
        if (!COMPANION_PLANTS[plantType].includes(adjacent.type)) {
            const minCombinedSpacing = Math.max(
                DEFAULT_PLANT_SPACING[plantType],
                DEFAULT_PLANT_SPACING[adjacent.type]
            );
            if (spacing < minCombinedSpacing) {
                throw new ValidationError(
                    `Incompatible plants ${plantType} and ${adjacent.type} require minimum spacing of ${minCombinedSpacing} inches`
                );
            }
        }
    });

    return true;
};

/**
 * Validates plant growth stage based on plant type
 * @param growthStage - Current growth stage of the plant
 * @param plantType - Type of plant being validated
 * @throws ValidationError if growth stage is invalid
 */
export const validatePlantGrowthStage = (
    growthStage: GROWTH_STAGES,
    plantType: PLANT_TYPES
): boolean => {
    if (!growthStage || typeof growthStage !== 'string') {
        throw new ValidationError('Growth stage must be a non-empty string');
    }

    const validStages = Object.values(GROWTH_STAGES);
    if (!validStages.includes(growthStage)) {
        throw new ValidationError(
            `Invalid growth stage. Supported stages are: ${validStages.join(', ')}`
        );
    }

    // Plant-specific growth stage validation
    const invalidStageMap: Partial<Record<PLANT_TYPES, GROWTH_STAGES[]>> = {
        [PLANT_TYPES.CARROTS]: [GROWTH_STAGES.HARVESTING], // Carrots are harvested once
        [PLANT_TYPES.LETTUCE]: [GROWTH_STAGES.HARVESTING]  // Lettuce is harvested once
    };

    if (invalidStageMap[plantType]?.includes(growthStage)) {
        throw new ValidationError(
            `Growth stage ${growthStage} is not valid for ${plantType}`
        );
    }

    return true;
};

/**
 * Validates plant sunlight requirements based on plant type
 * @param sunlightNeeds - Sunlight requirement level
 * @param plantType - Type of plant being validated
 * @throws ValidationError if sunlight requirements are invalid
 */
export const validatePlantSunlightNeeds = (
    sunlightNeeds: SUNLIGHT_REQUIREMENTS,
    plantType: PLANT_TYPES
): boolean => {
    if (!sunlightNeeds || typeof sunlightNeeds !== 'string') {
        throw new ValidationError('Sunlight needs must be a non-empty string');
    }

    const validRequirements = Object.values(SUNLIGHT_REQUIREMENTS);
    if (!validRequirements.includes(sunlightNeeds)) {
        throw new ValidationError(
            `Invalid sunlight requirement. Supported values are: ${validRequirements.join(', ')}`
        );
    }

    // Plant-specific sunlight validation
    const minHours = MIN_SUNLIGHT_HOURS[plantType];
    const sunlightMap: Record<SUNLIGHT_REQUIREMENTS, number> = {
        [SUNLIGHT_REQUIREMENTS.FULL_SUN]: 6,
        [SUNLIGHT_REQUIREMENTS.PARTIAL_SHADE]: 4,
        [SUNLIGHT_REQUIREMENTS.FULL_SHADE]: 2
    };

    if (sunlightMap[sunlightNeeds] < minHours) {
        throw new ValidationError(
            `${plantType} requires minimum ${minHours} hours of sunlight. ${sunlightNeeds} is insufficient`
        );
    }

    return true;
};

/**
 * Comprehensive validation of all plant properties
 * @param plant - Plant object to validate
 * @param adjacentPlants - Array of adjacent plants for companion planting validation
 * @throws ValidationError if any plant properties are invalid
 */
export const validatePlant = (
    plant: IPlant,
    adjacentPlants: IPlant[] = []
): boolean => {
    const errors: string[] = [];

    try {
        validatePlantType(plant.type);
    } catch (error) {
        errors.push(error.message);
    }

    try {
        validatePlantSpacing(plant.spacing, plant.type, adjacentPlants);
    } catch (error) {
        errors.push(error.message);
    }

    try {
        validatePlantGrowthStage(plant.growthStage, plant.type);
    } catch (error) {
        errors.push(error.message);
    }

    try {
        validatePlantSunlightNeeds(plant.sunlightNeeds, plant.type);
    } catch (error) {
        errors.push(error.message);
    }

    if (errors.length > 0) {
        throw new ValidationError(
            `Plant validation failed:\n${errors.join('\n')}`
        );
    }

    return true;
};