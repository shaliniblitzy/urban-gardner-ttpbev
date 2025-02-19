/**
 * Plant Controller
 * Handles HTTP requests for plant management with enhanced environmental factor support
 * @version 1.0.0
 */

import { 
    Controller, 
    Post, 
    Get, 
    Put, 
    Delete, 
    Body, 
    Param, 
    Query, 
    UseInterceptors, 
    CacheInterceptor,
    HttpException,
    HttpStatus,
    Logger
} from '@nestjs/common'; // ^8.0.0

import { PlantService } from '../services/plant.service';
import { validatePlant } from '../validators/plant.validator';
import { IPlant } from '../interfaces/plant.interface';

interface EnvironmentalFactors {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
}

@Controller('plants')
@UseInterceptors(CacheInterceptor)
export class PlantController {
    private readonly logger = new Logger(PlantController.name);

    constructor(private readonly plantService: PlantService) {}

    /**
     * Creates a new plant with environmental factor validation
     * @param plantData Plant creation data with environmental factors
     * @returns Promise<IPlant> Created plant record
     */
    @Post()
    async createPlant(@Body() plantData: IPlant): Promise<IPlant> {
        try {
            this.logger.log(`Creating new plant of type: ${plantData.type}`);
            await validatePlant(plantData);
            return await this.plantService.createPlant(plantData);
        } catch (error) {
            this.logger.error(`Failed to create plant: ${error.message}`);
            throw new HttpException(
                error.message,
                HttpStatus.BAD_REQUEST
            );
        }
    }

    /**
     * Retrieves plant by ID with current environmental data
     * @param id Plant identifier
     * @returns Promise<IPlant> Plant record with environmental data
     */
    @Get(':id')
    async getPlantById(@Param('id') id: string): Promise<IPlant> {
        try {
            this.logger.log(`Retrieving plant with ID: ${id}`);
            const plant = await this.plantService.getPlantById(id);
            if (!plant) {
                throw new HttpException(
                    'Plant not found',
                    HttpStatus.NOT_FOUND
                );
            }
            return plant;
        } catch (error) {
            this.logger.error(`Failed to retrieve plant: ${error.message}`);
            throw new HttpException(
                error.message,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Updates plant growth stage based on environmental factors
     * @param id Plant identifier
     * @param environmentalFactors Current environmental conditions
     * @returns Promise<IPlant> Updated plant record
     */
    @Put(':id/growth-stage')
    async updateGrowthStage(
        @Param('id') id: string,
        @Body() environmentalFactors: EnvironmentalFactors
    ): Promise<IPlant> {
        try {
            this.logger.log(`Updating growth stage for plant: ${id}`);
            return await this.plantService.updateGrowthStage(
                id,
                environmentalFactors
            );
        } catch (error) {
            this.logger.error(`Failed to update growth stage: ${error.message}`);
            throw new HttpException(
                error.message,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Calculates next care date considering environmental factors
     * @param id Plant identifier
     * @param careType Type of care (watering/fertilizing)
     * @returns Promise<Date> Next optimal care date
     */
    @Get(':id/next-care')
    async getNextCareDate(
        @Param('id') id: string,
        @Query('careType') careType: 'watering' | 'fertilizing'
    ): Promise<Date> {
        try {
            this.logger.log(`Calculating next ${careType} date for plant: ${id}`);
            return await this.plantService.calculateNextCareDate(id, careType);
        } catch (error) {
            this.logger.error(`Failed to calculate next care date: ${error.message}`);
            throw new HttpException(
                error.message,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Retrieves plants by type with environmental compatibility
     * @param type Plant type to filter by
     * @returns Promise<IPlant[]> Array of matching plants
     */
    @Get('by-type/:type')
    async getPlantsByType(@Param('type') type: string): Promise<IPlant[]> {
        try {
            this.logger.log(`Retrieving plants of type: ${type}`);
            return await this.plantService.getPlantsByType(type);
        } catch (error) {
            this.logger.error(`Failed to retrieve plants by type: ${error.message}`);
            throw new HttpException(
                error.message,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Deletes a plant and updates related environmental calculations
     * @param id Plant identifier
     * @returns Promise<void>
     */
    @Delete(':id')
    async deletePlant(@Param('id') id: string): Promise<void> {
        try {
            this.logger.log(`Deleting plant with ID: ${id}`);
            await this.plantService.deletePlant(id);
        } catch (error) {
            this.logger.error(`Failed to delete plant: ${error.message}`);
            throw new HttpException(
                error.message,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}