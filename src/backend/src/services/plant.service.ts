/**
 * Service class implementing comprehensive business logic for plant management
 * Handles plant lifecycle, care scheduling, and growth tracking with environmental factors
 * @version 1.0.0
 */

import { Injectable } from '@nestjs/common'; // ^8.0.0
import { Logger } from '@nestjs/common'; // ^8.0.0
import { PlantRepository } from '../repositories/plant.repository';
import { IPlant, IPlantCareSchedule } from '../interfaces/plant.interface';
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

interface EnvironmentalFactors {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
}

interface SoilConditions {
    moisture: number;
    pH: number;
    nutrients: {
        nitrogen: number;
        phosphorus: number;
        potassium: number;
    };
}

@Injectable()
export class PlantService {
    constructor(
        private readonly plantRepository: PlantRepository,
        private readonly logger: Logger
    ) {
        this.logger.setContext('PlantService');
    }

    /**
     * Creates a new plant with initial growth stage and environmental baseline
     * @param plantData Plant creation data
     * @returns Promise<IPlant> Created plant record
     */
    async createPlant(plantData: IPlant): Promise<IPlant> {
        try {
            // Validate spacing requirements
            if (plantData.spacing < DEFAULT_PLANT_SPACING[plantData.type]) {
                throw new Error(`Insufficient spacing for ${plantData.type}. Minimum: ${DEFAULT_PLANT_SPACING[plantData.type]} inches`);
            }

            // Validate companion planting compatibility
            if (plantData.companionPlants) {
                const invalidCompanions = plantData.companionPlants.filter(
                    companion => !COMPANION_PLANTS[plantData.type].includes(companion)
                );
                if (invalidCompanions.length > 0) {
                    throw new Error(`Incompatible companion plants: ${invalidCompanions.join(', ')}`);
                }
            }

            // Set initial growth parameters
            const initialPlant: IPlant = {
                ...plantData,
                growthStage: GROWTH_STAGES.SEEDLING,
                plantedDate: new Date(),
                lastWateredDate: new Date(),
                lastFertilizedDate: new Date(),
                daysToMaturity: DAYS_TO_MATURITY[plantData.type]
            };

            const createdPlant = await this.plantRepository.createPlant(initialPlant);
            this.logger.log(`Created new plant: ${createdPlant.id} of type ${createdPlant.type}`);
            return createdPlant;
        } catch (error) {
            this.logger.error(`Failed to create plant: ${error.message}`);
            throw error;
        }
    }

    /**
     * Updates plant growth stage based on environmental conditions
     * @param plantId Plant identifier
     * @param environmentalFactors Current environmental conditions
     * @returns Promise<IPlant> Updated plant record
     */
    async updateGrowthStage(
        plantId: string,
        environmentalFactors: EnvironmentalFactors
    ): Promise<IPlant> {
        try {
            const healthIndicators = await this.assessPlantHealth(plantId, environmentalFactors);
            const updatedPlant = await this.plantRepository.updatePlantGrowthStage(
                plantId,
                environmentalFactors,
                healthIndicators
            );

            if (!updatedPlant) {
                throw new Error(`Plant not found: ${plantId}`);
            }

            this.logger.log(`Updated growth stage for plant ${plantId}: ${updatedPlant.growthStage}`);
            return updatedPlant;
        } catch (error) {
            this.logger.error(`Failed to update growth stage: ${error.message}`);
            throw error;
        }
    }

    /**
     * Calculates next optimal care date with environmental adjustments
     * @param plantId Plant identifier
     * @param careType Type of care (watering/fertilizing)
     * @returns Promise<Date> Next care date
     */
    async calculateNextCareDate(
        plantId: string,
        careType: 'watering' | 'fertilizing'
    ): Promise<Date> {
        try {
            const plant = await this.plantRepository.getPlantById(plantId);
            if (!plant) {
                throw new Error(`Plant not found: ${plantId}`);
            }

            const environmentalFactors = await this.getCurrentEnvironmentalFactors(plantId);
            const soilConditions = await this.getCurrentSoilConditions(plantId);

            let nextDate: Date;
            if (careType === 'watering') {
                nextDate = plant.calculateNextWateringDate(environmentalFactors, soilConditions);
            } else {
                nextDate = plant.calculateNextFertilizingDate(soilConditions, plant.growthStage);
            }

            this.logger.log(`Calculated next ${careType} date for plant ${plantId}: ${nextDate}`);
            return nextDate;
        } catch (error) {
            this.logger.error(`Failed to calculate next care date: ${error.message}`);
            throw error;
        }
    }

    /**
     * Assesses current plant health based on environmental conditions
     * @private
     * @param plantId Plant identifier
     * @param environmentalFactors Current environmental conditions
     * @returns Plant health indicators
     */
    private async assessPlantHealth(
        plantId: string,
        environmentalFactors: EnvironmentalFactors
    ): Promise<any> {
        const plant = await this.plantRepository.getPlantById(plantId);
        if (!plant) {
            throw new Error(`Plant not found: ${plantId}`);
        }

        // Calculate stress factors
        const temperatureStress = environmentalFactors.temperature < 10 || environmentalFactors.temperature > 35;
        const humidityStress = environmentalFactors.humidity < 20;
        const windStress = environmentalFactors.windSpeed > 30;

        return {
            leafColor: this.determineLeafColor(temperatureStress, humidityStress),
            stemStrength: this.calculateStemStrength(windStress, environmentalFactors.humidity),
            pestPresence: false, // Would be determined by sensor data in a real system
            diseaseSymptoms: this.checkDiseaseSymptoms(temperatureStress, humidityStress)
        };
    }

    /**
     * Retrieves current environmental conditions for a plant
     * @private
     * @param plantId Plant identifier
     * @returns Environmental factors
     */
    private async getCurrentEnvironmentalFactors(plantId: string): Promise<EnvironmentalFactors> {
        // In a real system, this would fetch data from environmental sensors
        return {
            temperature: 25, // Default optimal temperature
            humidity: 60,    // Default optimal humidity
            rainfall: 0,     // Default no rainfall
            windSpeed: 5     // Default light breeze
        };
    }

    /**
     * Retrieves current soil conditions for a plant
     * @private
     * @param plantId Plant identifier
     * @returns Soil conditions
     */
    private async getCurrentSoilConditions(plantId: string): Promise<SoilConditions> {
        // In a real system, this would fetch data from soil sensors
        return {
            moisture: 0.6,   // Default optimal moisture
            pH: 6.5,         // Default optimal pH
            nutrients: {
                nitrogen: 0.5,    // Default moderate nitrogen
                phosphorus: 0.5,  // Default moderate phosphorus
                potassium: 0.5    // Default moderate potassium
            }
        };
    }

    private determineLeafColor(temperatureStress: boolean, humidityStress: boolean): string {
        if (temperatureStress && humidityStress) return 'yellow';
        if (temperatureStress || humidityStress) return 'light-green';
        return 'green';
    }

    private calculateStemStrength(windStress: boolean, humidity: number): number {
        let strength = 1.0;
        if (windStress) strength *= 0.8;
        if (humidity < 40) strength *= 0.9;
        return Math.max(0.5, strength);
    }

    private checkDiseaseSymptoms(temperatureStress: boolean, humidityStress: boolean): string[] {
        const symptoms: string[] = [];
        if (temperatureStress) symptoms.push('leaf-wilt');
        if (humidityStress) symptoms.push('powdery-mildew');
        return symptoms;
    }
}