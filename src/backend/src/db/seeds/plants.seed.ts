/**
 * Database seed file for plant data
 * Provides comprehensive initial data for supported plant types including growth parameters,
 * spacing requirements, companion planting relationships, and care instructions
 * @version 1.0.0
 */

import { 
    IPlant,
    IPlantCareSchedule 
} from '../../interfaces/plant.interface';

import {
    PLANT_TYPES,
    SUNLIGHT_REQUIREMENTS,
    GROWTH_STAGES,
    DEFAULT_PLANT_SPACING,
    DAYS_TO_MATURITY,
    WATERING_FREQUENCY_DAYS,
    FERTILIZING_FREQUENCY_DAYS,
    MIN_SUNLIGHT_HOURS,
    COMPANION_PLANTS
} from '../../constants/plant.constants';

/**
 * Interface for growth stage-specific care requirements
 */
interface IGrowthStageRequirements {
    stage: GROWTH_STAGES;
    wateringFrequencyDays: number;
    fertilizingFrequencyDays: number;
    careInstructions: string;
}

/**
 * Interface for companion planting relationships
 */
interface ICompanionPlanting {
    plantType: PLANT_TYPES;
    benefitDescription: string;
    minimumSpacing: number;
}

/**
 * Interface for plant metadata
 */
interface IPlantMetadata {
    lastVerified: Date;
    dataSource: string;
    version: string;
}

/**
 * Generates comprehensive plant seed data with detailed specifications
 * @returns Array of plant objects with complete growth and care requirements
 */
const generatePlantSeedData = (): IPlant[] => {
    const currentDate = new Date();
    
    const plantSeedData: IPlant[] = [
        {
            id: 'tomato-001',
            type: PLANT_TYPES.TOMATOES,
            growthStage: GROWTH_STAGES.SEEDLING,
            sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
            spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.TOMATOES],
            daysToMaturity: DAYS_TO_MATURITY[PLANT_TYPES.TOMATOES],
            plantedDate: currentDate,
            lastWateredDate: currentDate,
            lastFertilizedDate: currentDate,
            companionPlants: COMPANION_PLANTS[PLANT_TYPES.TOMATOES],
            waterRequirementMl: 500,
            expectedYieldKg: 4.5,
            growthStageRequirements: [
                {
                    stage: GROWTH_STAGES.SEEDLING,
                    wateringFrequencyDays: 1,
                    fertilizingFrequencyDays: 14,
                    careInstructions: 'Keep soil consistently moist. Provide 14-16 hours of light.'
                },
                {
                    stage: GROWTH_STAGES.GROWING,
                    wateringFrequencyDays: WATERING_FREQUENCY_DAYS[PLANT_TYPES.TOMATOES],
                    fertilizingFrequencyDays: FERTILIZING_FREQUENCY_DAYS[PLANT_TYPES.TOMATOES],
                    careInstructions: 'Stake plants when they reach 6 inches. Prune suckers weekly.'
                },
                {
                    stage: GROWTH_STAGES.MATURE,
                    wateringFrequencyDays: 4,
                    fertilizingFrequencyDays: 21,
                    careInstructions: 'Reduce watering to prevent splitting. Monitor for blight.'
                }
            ],
            companionPlantingData: [
                {
                    plantType: PLANT_TYPES.LETTUCE,
                    benefitDescription: 'Provides ground cover and reduces water evaporation',
                    minimumSpacing: 12
                }
            ],
            metadata: {
                lastVerified: new Date('2024-01-15'),
                dataSource: 'USDA Agricultural Database',
                version: '1.0.0'
            }
        },
        {
            id: 'lettuce-001',
            type: PLANT_TYPES.LETTUCE,
            growthStage: GROWTH_STAGES.SEEDLING,
            sunlightNeeds: SUNLIGHT_REQUIREMENTS.PARTIAL_SHADE,
            spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.LETTUCE],
            daysToMaturity: DAYS_TO_MATURITY[PLANT_TYPES.LETTUCE],
            plantedDate: currentDate,
            lastWateredDate: currentDate,
            lastFertilizedDate: currentDate,
            companionPlants: COMPANION_PLANTS[PLANT_TYPES.LETTUCE],
            waterRequirementMl: 300,
            expectedYieldKg: 0.5,
            growthStageRequirements: [
                {
                    stage: GROWTH_STAGES.SEEDLING,
                    wateringFrequencyDays: 1,
                    fertilizingFrequencyDays: 21,
                    careInstructions: 'Mist daily. Protect from direct afternoon sun.'
                },
                {
                    stage: GROWTH_STAGES.GROWING,
                    wateringFrequencyDays: WATERING_FREQUENCY_DAYS[PLANT_TYPES.LETTUCE],
                    fertilizingFrequencyDays: FERTILIZING_FREQUENCY_DAYS[PLANT_TYPES.LETTUCE],
                    careInstructions: 'Thin seedlings to prevent overcrowding. Monitor for slugs.'
                },
                {
                    stage: GROWTH_STAGES.MATURE,
                    wateringFrequencyDays: 2,
                    fertilizingFrequencyDays: 0,
                    careInstructions: 'Harvest outer leaves regularly. Watch for bolting.'
                }
            ],
            companionPlantingData: [
                {
                    plantType: PLANT_TYPES.CARROTS,
                    benefitDescription: 'Benefits from soil aeration provided by carrot growth',
                    minimumSpacing: 6
                }
            ],
            metadata: {
                lastVerified: new Date('2024-01-15'),
                dataSource: 'USDA Agricultural Database',
                version: '1.0.0'
            }
        },
        {
            id: 'carrot-001',
            type: PLANT_TYPES.CARROTS,
            growthStage: GROWTH_STAGES.SEEDLING,
            sunlightNeeds: SUNLIGHT_REQUIREMENTS.FULL_SUN,
            spacing: DEFAULT_PLANT_SPACING[PLANT_TYPES.CARROTS],
            daysToMaturity: DAYS_TO_MATURITY[PLANT_TYPES.CARROTS],
            plantedDate: currentDate,
            lastWateredDate: currentDate,
            lastFertilizedDate: currentDate,
            companionPlants: COMPANION_PLANTS[PLANT_TYPES.CARROTS],
            waterRequirementMl: 200,
            expectedYieldKg: 1.0,
            growthStageRequirements: [
                {
                    stage: GROWTH_STAGES.SEEDLING,
                    wateringFrequencyDays: 1,
                    fertilizingFrequencyDays: 0,
                    careInstructions: 'Keep soil surface moist until germination. Thin to 2-inch spacing.'
                },
                {
                    stage: GROWTH_STAGES.GROWING,
                    wateringFrequencyDays: WATERING_FREQUENCY_DAYS[PLANT_TYPES.CARROTS],
                    fertilizingFrequencyDays: FERTILIZING_FREQUENCY_DAYS[PLANT_TYPES.CARROTS],
                    careInstructions: 'Maintain consistent moisture. Remove competing weeds.'
                },
                {
                    stage: GROWTH_STAGES.MATURE,
                    wateringFrequencyDays: 4,
                    fertilizingFrequencyDays: 0,
                    careInstructions: 'Reduce watering before harvest. Check root development.'
                }
            ],
            companionPlantingData: [
                {
                    plantType: PLANT_TYPES.TOMATOES,
                    benefitDescription: 'Benefits from shade provided by tomato plants',
                    minimumSpacing: 18
                }
            ],
            metadata: {
                lastVerified: new Date('2024-01-15'),
                dataSource: 'USDA Agricultural Database',
                version: '1.0.0'
            }
        }
    ];

    return plantSeedData;
};

// Export the generated seed data
export const plantSeedData = generatePlantSeedData();