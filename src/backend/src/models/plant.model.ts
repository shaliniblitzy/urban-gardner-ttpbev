/**
 * Plant model implementation for garden planner application
 * Handles plant entities with comprehensive growth tracking and maintenance scheduling
 * @version 1.0.0
 */

import { Schema, model, Document } from 'mongoose'; // v6.0.0
import {
    IPlant,
    IPlantCareSchedule
} from '../interfaces/plant.interface';
import {
    PLANT_TYPES,
    GROWTH_STAGES,
    SUNLIGHT_REQUIREMENTS,
    DEFAULT_PLANT_SPACING,
    DAYS_TO_MATURITY,
    WATERING_FREQUENCY_DAYS,
    FERTILIZING_FREQUENCY_DAYS,
    COMPANION_PLANTS
} from '../constants/plant.constants';

/**
 * Environmental factors affecting plant growth and maintenance
 */
interface EnvironmentalFactors {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
}

/**
 * Soil condition parameters for plant health monitoring
 */
interface SoilConditions {
    moisture: number;
    pH: number;
    nutrients: {
        nitrogen: number;
        phosphorus: number;
        potassium: number;
    };
}

/**
 * Plant health indicators for growth stage assessment
 */
interface HealthIndicators {
    leafColor: string;
    stemStrength: number;
    pestPresence: boolean;
    diseaseSymptoms: string[];
}

/**
 * Mongoose schema for Plant model
 */
const PlantSchema = new Schema<IPlant>({
    id: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: Object.values(PLANT_TYPES),
        required: true
    },
    growthStage: {
        type: String,
        enum: Object.values(GROWTH_STAGES),
        default: GROWTH_STAGES.SEEDLING
    },
    sunlightNeeds: {
        type: String,
        enum: Object.values(SUNLIGHT_REQUIREMENTS),
        required: true
    },
    spacing: {
        type: Number,
        required: true,
        validate: {
            validator: (value: number) => value > 0,
            message: 'Spacing must be a positive number'
        }
    },
    daysToMaturity: {
        type: Number,
        required: true
    },
    plantedDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    lastWateredDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    lastFertilizedDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    companionPlants: [{
        type: String,
        enum: Object.values(PLANT_TYPES)
    }],
    waterRequirementMl: {
        type: Number,
        required: true,
        min: 0
    },
    expectedYieldKg: {
        type: Number,
        required: true,
        min: 0
    },
    soilConditions: {
        moisture: Number,
        pH: Number,
        nutrients: {
            nitrogen: Number,
            phosphorus: Number,
            potassium: Number
        }
    },
    environmentalFactors: {
        temperature: Number,
        humidity: Number,
        rainfall: Number,
        windSpeed: Number
    }
}, {
    timestamps: true
});

/**
 * Calculates the next required watering date based on plant type and conditions
 * @param environmentalFactors Current environmental conditions
 * @param soilConditions Current soil conditions
 * @returns Date Next optimal watering date
 */
PlantSchema.methods.calculateNextWateringDate = function(
    environmentalFactors: EnvironmentalFactors,
    soilConditions: SoilConditions
): Date {
    const baseFrequency = WATERING_FREQUENCY_DAYS[this.type];
    let adjustedDays = baseFrequency;

    // Adjust for temperature
    if (environmentalFactors.temperature > 30) {
        adjustedDays *= 0.7; // More frequent watering in high temperatures
    } else if (environmentalFactors.temperature < 15) {
        adjustedDays *= 1.3; // Less frequent watering in cool temperatures
    }

    // Adjust for rainfall
    if (environmentalFactors.rainfall > 0) {
        adjustedDays += environmentalFactors.rainfall / 10;
    }

    // Adjust for soil moisture
    if (soilConditions.moisture < 0.3) {
        adjustedDays *= 0.8; // More frequent watering for dry soil
    } else if (soilConditions.moisture > 0.7) {
        adjustedDays *= 1.5; // Less frequent watering for wet soil
    }

    const nextWateringDate = new Date(this.lastWateredDate);
    nextWateringDate.setDate(nextWateringDate.getDate() + Math.round(adjustedDays));
    
    return nextWateringDate;
};

/**
 * Calculates the next optimal fertilizing date based on growth stage and conditions
 * @param soilConditions Current soil nutrient levels
 * @param currentStage Current growth stage of the plant
 * @returns Date Next optimal fertilizing date
 */
PlantSchema.methods.calculateNextFertilizingDate = function(
    soilConditions: SoilConditions,
    currentStage: GROWTH_STAGES
): Date {
    const baseFrequency = FERTILIZING_FREQUENCY_DAYS[this.type];
    let adjustedDays = baseFrequency;

    // Adjust based on growth stage
    switch (currentStage) {
        case GROWTH_STAGES.SEEDLING:
            adjustedDays *= 1.5; // Less frequent fertilizing for seedlings
            break;
        case GROWTH_STAGES.GROWING:
            adjustedDays *= 0.8; // More frequent fertilizing during growth
            break;
        case GROWTH_STAGES.MATURE:
            adjustedDays *= 1.2; // Moderate fertilizing for mature plants
            break;
        case GROWTH_STAGES.HARVESTING:
            adjustedDays *= 1.5; // Reduced fertilizing during harvest
            break;
    }

    // Adjust based on soil nutrient levels
    const { nitrogen, phosphorus, potassium } = soilConditions.nutrients;
    const averageNutrients = (nitrogen + phosphorus + potassium) / 3;

    if (averageNutrients < 0.3) {
        adjustedDays *= 0.7; // More frequent fertilizing for nutrient-poor soil
    } else if (averageNutrients > 0.7) {
        adjustedDays *= 1.3; // Less frequent fertilizing for nutrient-rich soil
    }

    const nextFertilizingDate = new Date(this.lastFertilizedDate);
    nextFertilizingDate.setDate(nextFertilizingDate.getDate() + Math.round(adjustedDays));

    return nextFertilizingDate;
};

/**
 * Updates plant growth stage based on elapsed time and conditions
 * @param environmentalFactors Current environmental conditions
 * @param healthIndicators Current plant health metrics
 * @returns GROWTH_STAGES Updated growth stage
 */
PlantSchema.methods.updateGrowthStage = function(
    environmentalFactors: EnvironmentalFactors,
    healthIndicators: HealthIndicators
): GROWTH_STAGES {
    const daysSincePlanting = Math.floor(
        (Date.now() - this.plantedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const maturityProgress = daysSincePlanting / DAYS_TO_MATURITY[this.type];
    let newStage = this.growthStage;

    // Determine base growth stage from maturity progress
    if (maturityProgress < 0.25) {
        newStage = GROWTH_STAGES.SEEDLING;
    } else if (maturityProgress < 0.75) {
        newStage = GROWTH_STAGES.GROWING;
    } else if (maturityProgress < 0.9) {
        newStage = GROWTH_STAGES.MATURE;
    } else {
        newStage = GROWTH_STAGES.HARVESTING;
    }

    // Adjust for environmental stress factors
    const isStressed = 
        environmentalFactors.temperature > 35 ||
        environmentalFactors.temperature < 10 ||
        environmentalFactors.humidity < 20 ||
        environmentalFactors.windSpeed > 30;

    // Adjust for plant health issues
    const hasHealthIssues = 
        healthIndicators.pestPresence ||
        healthIndicators.diseaseSymptoms.length > 0 ||
        healthIndicators.leafColor !== 'green' ||
        healthIndicators.stemStrength < 0.7;

    // Potentially delay growth stage progression under stress
    if (isStressed || hasHealthIssues) {
        if (newStage !== this.growthStage && newStage !== GROWTH_STAGES.SEEDLING) {
            newStage = this.growthStage; // Maintain current stage under stress
        }
    }

    return newStage;
};

// Create and export the Plant model
export const Plant = model<IPlant>('Plant', PlantSchema);