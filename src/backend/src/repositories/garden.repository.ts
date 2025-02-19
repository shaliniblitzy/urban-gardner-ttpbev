/**
 * Garden Repository
 * @packageVersion 5.0
 * 
 * Implements data persistence operations for garden management with comprehensive
 * validation and optimization support. Addresses requirements for garden space
 * optimization (F-001) and related functional requirements.
 */

import { Injectable, Logger } from '@nestjs/common'; // @version ^8.0.0
import { Model, Document, ClientSession } from 'mongoose'; // @version ^6.0.0
import { Garden } from '../models/garden.model';
import { 
    IGarden, 
    IGardenZone, 
    IGardenOptimizationParams 
} from '../interfaces/garden.interface';
import { 
    GARDEN_AREA_LIMITS,
    OPTIMIZATION_CONSTANTS,
    SPACE_UTILIZATION_TARGET,
    isValidGardenArea,
    isSunlightCondition
} from '../constants/garden.constants';

/**
 * Repository class handling garden data persistence operations with optimization support
 */
@Injectable()
export class GardenRepository {
    private readonly logger = new Logger(GardenRepository.name);

    constructor(
        private readonly gardenModel: Model<IGarden>
    ) {}

    /**
     * Creates a new garden with comprehensive validation and optimization
     * @param gardenData Garden creation data with optimization parameters
     * @returns Promise resolving to created garden document
     * @throws Error if validation fails
     */
    async createGarden(gardenData: IGarden): Promise<IGarden> {
        this.logger.debug(`Creating garden with area: ${gardenData.area} sq ft`);

        // Validate garden area
        if (!isValidGardenArea(gardenData.area)) {
            throw new Error(`Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} sq ft`);
        }

        // Validate zones
        await this.validateGardenZones(gardenData.zones);

        const session = await this.gardenModel.db.startSession();
        try {
            await session.withTransaction(async () => {
                const garden = new this.gardenModel(gardenData);
                await garden.save({ session });
                this.logger.debug(`Garden created successfully with ID: ${garden.id}`);
                return garden;
            });
        } catch (error) {
            this.logger.error(`Failed to create garden: ${error.message}`);
            throw error;
        } finally {
            await session.endSession();
        }

        return this.gardenModel.findById(gardenData.id).exec();
    }

    /**
     * Updates existing garden with optimization recalculation
     * @param id Garden identifier
     * @param updateData Partial garden update data
     * @returns Promise resolving to updated garden document
     */
    async updateGarden(id: string, updateData: Partial<IGarden>): Promise<IGarden | null> {
        this.logger.debug(`Updating garden ${id}`);

        const session = await this.gardenModel.db.startSession();
        try {
            await session.withTransaction(async () => {
                // Validate area if included in update
                if (updateData.area && !isValidGardenArea(updateData.area)) {
                    throw new Error(`Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} sq ft`);
                }

                // Validate zones if included in update
                if (updateData.zones) {
                    await this.validateGardenZones(updateData.zones);
                }

                const garden = await this.gardenModel
                    .findByIdAndUpdate(id, updateData, { 
                        new: true,
                        runValidators: true,
                        session 
                    })
                    .exec();

                if (!garden) {
                    throw new Error(`Garden with ID ${id} not found`);
                }

                this.logger.debug(`Garden ${id} updated successfully`);
                return garden;
            });
        } catch (error) {
            this.logger.error(`Failed to update garden ${id}: ${error.message}`);
            throw error;
        } finally {
            await session.endSession();
        }

        return this.gardenModel.findById(id).exec();
    }

    /**
     * Retrieves garden by ID with optimization data
     * @param id Garden identifier
     * @returns Promise resolving to garden document
     */
    async getGardenById(id: string): Promise<IGarden | null> {
        this.logger.debug(`Retrieving garden ${id}`);
        return this.gardenModel.findById(id).exec();
    }

    /**
     * Deletes garden and associated data
     * @param id Garden identifier
     * @returns Promise resolving to deletion result
     */
    async deleteGarden(id: string): Promise<boolean> {
        this.logger.debug(`Deleting garden ${id}`);

        const session = await this.gardenModel.db.startSession();
        try {
            await session.withTransaction(async () => {
                const result = await this.gardenModel
                    .findByIdAndDelete(id, { session })
                    .exec();

                if (!result) {
                    throw new Error(`Garden with ID ${id} not found`);
                }

                this.logger.debug(`Garden ${id} deleted successfully`);
                return true;
            });
        } catch (error) {
            this.logger.error(`Failed to delete garden ${id}: ${error.message}`);
            throw error;
        } finally {
            await session.endSession();
        }

        return true;
    }

    /**
     * Validates garden zones configuration
     * @param zones Array of garden zones to validate
     * @throws Error if validation fails
     */
    private async validateGardenZones(zones: IGardenZone[]): Promise<void> {
        if (!zones || zones.length === 0) {
            throw new Error('Garden must have at least one zone');
        }

        // Validate zone IDs uniqueness
        const zoneIds = new Set(zones.map(zone => zone.id));
        if (zoneIds.size !== zones.length) {
            throw new Error('Zone IDs must be unique');
        }

        // Validate each zone
        for (const zone of zones) {
            if (!isSunlightCondition(zone.sunlightCondition)) {
                throw new Error(`Invalid sunlight condition for zone ${zone.id}`);
            }

            if (zone.area < OPTIMIZATION_CONSTANTS.MIN_ZONE_SIZE) {
                throw new Error(`Zone ${zone.id} area must be at least ${OPTIMIZATION_CONSTANTS.MIN_ZONE_SIZE} sq ft`);
            }

            // Validate plants within zone
            if (zone.plants) {
                await this.validateZonePlants(zone);
            }
        }
    }

    /**
     * Validates plants configuration within a zone
     * @param zone Garden zone with plants to validate
     * @throws Error if validation fails
     */
    private async validateZonePlants(zone: IGardenZone): Promise<void> {
        let totalPlantArea = 0;

        for (const plant of zone.plants) {
            // Calculate plant area based on spacing
            const plantArea = Math.PI * Math.pow(plant.spacing / 24, 2);
            totalPlantArea += plantArea;
        }

        // Validate space utilization
        const zoneUtilization = (totalPlantArea / zone.area) * 100;
        if (zoneUtilization < SPACE_UTILIZATION_TARGET) {
            throw new Error(`Zone ${zone.id} space utilization (${zoneUtilization.toFixed(1)}%) is below target ${SPACE_UTILIZATION_TARGET}%`);
        }
    }
}