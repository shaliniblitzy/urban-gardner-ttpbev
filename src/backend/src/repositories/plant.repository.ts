/**
 * Repository class for handling plant data persistence and database operations
 * Provides enhanced support for maintenance scheduling and environmental factors
 * @version 1.0.0
 */

import mongoose from 'mongoose'; // v6.0.0
import { Plant } from '../models/plant.model';
import { IPlant, IPlantCareSchedule } from '../interfaces/plant.interface';
import { PLANT_TYPES, GROWTH_STAGES, DEFAULT_PLANT_SPACING } from '../constants/plant.constants';

/**
 * Enhanced repository class for managing plant data persistence
 */
export class PlantRepository {
    private readonly Plant: mongoose.Model<IPlant>;
    private readonly logger: any;

    constructor(logger: any) {
        this.Plant = Plant;
        this.logger = logger;

        // Initialize indexes for optimized queries
        this.initializeIndexes();
    }

    /**
     * Initialize database indexes for optimized querying
     * @private
     */
    private async initializeIndexes(): Promise<void> {
        try {
            await this.Plant.collection.createIndex({ id: 1 }, { unique: true });
            await this.Plant.collection.createIndex({ type: 1 });
            await this.Plant.collection.createIndex({ growthStage: 1 });
            await this.Plant.collection.createIndex({ 'environmentalFactors.temperature': 1 });
        } catch (error) {
            this.logger.error('Failed to initialize indexes:', error);
            throw error;
        }
    }

    /**
     * Creates a new plant record with enhanced validation
     * @param plantData Plant data to be created
     * @returns Promise<IPlant> Created plant record
     */
    async createPlant(plantData: IPlant): Promise<IPlant> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Validate spacing requirements
            if (plantData.spacing < DEFAULT_PLANT_SPACING[plantData.type]) {
                throw new Error(`Invalid spacing for ${plantData.type}. Minimum required: ${DEFAULT_PLANT_SPACING[plantData.type]} inches`);
            }

            // Create new plant instance
            const plant = new this.Plant({
                ...plantData,
                plantedDate: new Date(),
                lastWateredDate: new Date(),
                lastFertilizedDate: new Date()
            });

            // Save plant with transaction
            await plant.save({ session });
            await session.commitTransaction();

            this.logger.info(`Created new plant: ${plant.id}, Type: ${plant.type}`);
            return plant;
        } catch (error) {
            await session.abortTransaction();
            this.logger.error('Failed to create plant:', error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Updates plant growth stage considering environmental factors
     * @param id Plant identifier
     * @param environmentalFactors Current environmental conditions
     * @returns Promise<IPlant | null> Updated plant record
     */
    async updatePlantGrowthStage(
        id: string,
        environmentalFactors: any,
        healthIndicators: any
    ): Promise<IPlant | null> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const plant = await this.Plant.findOne({ id }).session(session);
            if (!plant) {
                throw new Error(`Plant not found with id: ${id}`);
            }

            const newGrowthStage = plant.updateGrowthStage(environmentalFactors, healthIndicators);
            
            if (newGrowthStage !== plant.growthStage) {
                plant.growthStage = newGrowthStage;
                await plant.save({ session });
                this.logger.info(`Updated growth stage for plant ${id}: ${newGrowthStage}`);
            }

            await session.commitTransaction();
            return plant;
        } catch (error) {
            await session.abortTransaction();
            this.logger.error(`Failed to update growth stage for plant ${id}:`, error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Retrieves plants by garden zone with spacing validation
     * @param zoneId Garden zone identifier
     * @returns Promise<IPlant[]> Array of plants in the zone
     */
    async getPlantsByZone(zoneId: string): Promise<IPlant[]> {
        try {
            const plants = await this.Plant.find({
                'location.zoneId': zoneId
            }).sort({ plantedDate: -1 });

            // Verify spacing compliance
            const spacingViolations = this.verifyZoneSpacing(plants);
            if (spacingViolations.length > 0) {
                this.logger.warn(`Spacing violations detected in zone ${zoneId}:`, spacingViolations);
            }

            return plants;
        } catch (error) {
            this.logger.error(`Failed to retrieve plants for zone ${zoneId}:`, error);
            throw error;
        }
    }

    /**
     * Updates plant maintenance schedule based on growth stage and environmental factors
     * @param id Plant identifier
     * @param schedule Updated care schedule
     * @returns Promise<IPlant | null> Updated plant record
     */
    async updatePlantCareSchedule(
        id: string,
        schedule: IPlantCareSchedule
    ): Promise<IPlant | null> {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const plant = await this.Plant.findOne({ id }).session(session);
            if (!plant) {
                throw new Error(`Plant not found with id: ${id}`);
            }

            // Calculate next care dates based on environmental factors
            const nextWateringDate = plant.calculateNextWateringDate(
                plant.environmentalFactors,
                plant.soilConditions
            );

            const nextFertilizingDate = plant.calculateNextFertilizingDate(
                plant.soilConditions,
                plant.growthStage
            );

            // Update schedule with calculated dates
            plant.set({
                'careSchedule.nextWateringDate': nextWateringDate,
                'careSchedule.nextFertilizingDate': nextFertilizingDate,
                'careSchedule.wateringFrequencyDays': schedule.wateringFrequencyDays,
                'careSchedule.fertilizingFrequencyDays': schedule.fertilizingFrequencyDays,
                'careSchedule.minSunlightHours': schedule.minSunlightHours,
                'careSchedule.harvestWindowDays': schedule.harvestWindowDays
            });

            await plant.save({ session });
            await session.commitTransaction();

            this.logger.info(`Updated care schedule for plant ${id}`);
            return plant;
        } catch (error) {
            await session.abortTransaction();
            this.logger.error(`Failed to update care schedule for plant ${id}:`, error);
            throw error;
        } finally {
            session.endSession();
        }
    }

    /**
     * Verifies plant spacing compliance within a zone
     * @private
     * @param plants Array of plants in a zone
     * @returns Array of spacing violation details
     */
    private verifyZoneSpacing(plants: IPlant[]): Array<{
        plantId: string,
        type: PLANT_TYPES,
        currentSpacing: number,
        requiredSpacing: number
    }> {
        const violations = [];

        for (let i = 0; i < plants.length; i++) {
            for (let j = i + 1; j < plants.length; j++) {
                const distance = this.calculatePlantDistance(
                    plants[i].location,
                    plants[j].location
                );

                const requiredSpacing = Math.max(
                    DEFAULT_PLANT_SPACING[plants[i].type],
                    DEFAULT_PLANT_SPACING[plants[j].type]
                );

                if (distance < requiredSpacing) {
                    violations.push({
                        plantId: plants[i].id,
                        type: plants[i].type,
                        currentSpacing: distance,
                        requiredSpacing
                    });
                }
            }
        }

        return violations;
    }

    /**
     * Calculates distance between two plants
     * @private
     * @param location1 First plant location
     * @param location2 Second plant location
     * @returns Distance in inches
     */
    private calculatePlantDistance(location1: any, location2: any): number {
        const dx = location1.x - location2.x;
        const dy = location1.y - location2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}