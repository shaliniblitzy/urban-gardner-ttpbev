/**
 * Garden Controller
 * @packageVersion 5.0
 * 
 * REST API controller handling garden management endpoints with enhanced validation,
 * performance monitoring, and optimization capabilities. Implements requirements for
 * garden space optimization (F-001) and related functional requirements.
 */

import { 
    Controller, 
    Get, 
    Post, 
    Put, 
    Delete, 
    Body, 
    Param, 
    UseGuards,
    HttpException,
    HttpStatus,
    Logger
} from '@nestjs/common'; // @version ^9.0.0
import { ThrottlerGuard } from '@nestjs/throttler'; // @version ^4.0.0

import { GardenService } from '../services/garden.service';
import { IGarden } from '../interfaces/garden.interface';
import { validateGardenInput } from '../validators/garden.validator';
import { GARDEN_AREA_LIMITS, SPACE_UTILIZATION_TARGET } from '../constants/garden.constants';

@Controller('gardens')
@UseGuards(ThrottlerGuard)
export class GardenController {
    private readonly logger = new Logger(GardenController.name);

    constructor(private readonly gardenService: GardenService) {
        this.logger.log('Initializing GardenController with enhanced validation');
    }

    /**
     * Creates a new garden with optimized layout
     * Implements F-001-RQ-001 and F-001-RQ-002 requirements
     */
    @Post()
    async createGarden(@Body() gardenData: IGarden): Promise<IGarden> {
        this.logger.debug(`Creating garden with area: ${gardenData.area} sq ft`);
        
        try {
            // Validate garden input
            await validateGardenInput(gardenData);

            // Create garden with optimization
            const garden = await this.gardenService.createGarden(gardenData);

            // Verify space utilization meets target
            if (garden.optimizationMetrics?.spaceUtilization < SPACE_UTILIZATION_TARGET) {
                throw new HttpException(
                    `Space utilization below target: ${garden.optimizationMetrics.spaceUtilization}%`,
                    HttpStatus.UNPROCESSABLE_ENTITY
                );
            }

            return garden;
        } catch (error) {
            this.logger.error(`Garden creation failed: ${error.message}`);
            throw new HttpException(
                error.message || 'Garden creation failed',
                error.status || HttpStatus.BAD_REQUEST
            );
        }
    }

    /**
     * Retrieves garden by ID with optimization metrics
     */
    @Get(':id')
    async getGarden(@Param('id') id: string): Promise<IGarden> {
        this.logger.debug(`Retrieving garden ${id}`);
        
        try {
            const garden = await this.gardenService.getGardenById(id);
            if (!garden) {
                throw new HttpException(
                    `Garden with ID ${id} not found`,
                    HttpStatus.NOT_FOUND
                );
            }
            return garden;
        } catch (error) {
            this.logger.error(`Garden retrieval failed: ${error.message}`);
            throw new HttpException(
                error.message || 'Garden retrieval failed',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Updates existing garden with optimization recalculation
     */
    @Put(':id')
    async updateGarden(
        @Param('id') id: string,
        @Body() updateData: Partial<IGarden>
    ): Promise<IGarden> {
        this.logger.debug(`Updating garden ${id}`);
        
        try {
            // Validate update data if area is included
            if (updateData.area) {
                if (updateData.area < GARDEN_AREA_LIMITS.MIN_AREA || 
                    updateData.area > GARDEN_AREA_LIMITS.MAX_AREA) {
                    throw new HttpException(
                        `Garden area must be between ${GARDEN_AREA_LIMITS.MIN_AREA} and ${GARDEN_AREA_LIMITS.MAX_AREA} sq ft`,
                        HttpStatus.BAD_REQUEST
                    );
                }
            }

            const garden = await this.gardenService.updateGarden(id, updateData);
            if (!garden) {
                throw new HttpException(
                    `Garden with ID ${id} not found`,
                    HttpStatus.NOT_FOUND
                );
            }
            return garden;
        } catch (error) {
            this.logger.error(`Garden update failed: ${error.message}`);
            throw new HttpException(
                error.message || 'Garden update failed',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Deletes garden and associated optimization data
     */
    @Delete(':id')
    async deleteGarden(@Param('id') id: string): Promise<void> {
        this.logger.debug(`Deleting garden ${id}`);
        
        try {
            const deleted = await this.gardenService.deleteGarden(id);
            if (!deleted) {
                throw new HttpException(
                    `Garden with ID ${id} not found`,
                    HttpStatus.NOT_FOUND
                );
            }
        } catch (error) {
            this.logger.error(`Garden deletion failed: ${error.message}`);
            throw new HttpException(
                error.message || 'Garden deletion failed',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }

    /**
     * Recalculates and optimizes layout for existing garden
     * Implements F-001-RQ-004 requirement
     */
    @Post(':id/optimize')
    @UseGuards(ThrottlerGuard)
    async optimizeGarden(@Param('id') id: string): Promise<IGarden> {
        this.logger.debug(`Optimizing garden ${id}`);
        
        try {
            const garden = await this.gardenService.optimizeExistingGarden(id);
            if (!garden) {
                throw new HttpException(
                    `Garden with ID ${id} not found`,
                    HttpStatus.NOT_FOUND
                );
            }

            // Verify optimization results
            if (garden.optimizationMetrics?.spaceUtilization < SPACE_UTILIZATION_TARGET) {
                throw new HttpException(
                    `Space utilization below target: ${garden.optimizationMetrics.spaceUtilization}%`,
                    HttpStatus.UNPROCESSABLE_ENTITY
                );
            }

            return garden;
        } catch (error) {
            this.logger.error(`Garden optimization failed: ${error.message}`);
            throw new HttpException(
                error.message || 'Garden optimization failed',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR
            );
        }
    }
}