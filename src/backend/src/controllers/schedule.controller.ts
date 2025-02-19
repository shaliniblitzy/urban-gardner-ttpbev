import { Controller, Get, Post, Put, Body, Param, Query, UseInterceptors } from '@nestjs/common'; // ^8.0.0
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger'; // ^5.0.0
import { CacheInterceptor } from '@nestjs/cache-manager'; // ^1.0.0

import { ScheduleService } from '../services/schedule.service';
import { validateSchedule } from '../validators/schedule.validator';
import { ISchedule, TaskType } from '../interfaces/schedule.interface';
import { SCHEDULE_ERRORS } from '../constants/schedule.constants';

interface EnvironmentalFactors {
    temperature: number;
    humidity: number;
    rainfall: number;
    windSpeed: number;
}

/**
 * Controller handling garden maintenance schedule operations
 * Implements caching, environmental factor support, and optimized performance
 */
@Controller('schedules')
@ApiTags('schedules')
@UseInterceptors(CacheInterceptor)
export class ScheduleController {
    constructor(private readonly scheduleService: ScheduleService) {}

    /**
     * Creates a new maintenance schedule with environmental factor consideration
     */
    @Post()
    @ApiOperation({ summary: 'Create maintenance schedule with environmental factors' })
    @ApiResponse({ status: 201, description: 'Schedule created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    async createSchedule(
        @Body('gardenId') gardenId: string,
        @Body('daysAhead') daysAhead: number,
        @Body('environmentalFactors') environmentalFactors: EnvironmentalFactors
    ): Promise<ISchedule[]> {
        try {
            if (!gardenId || !daysAhead || !environmentalFactors) {
                throw new Error(SCHEDULE_ERRORS.INVALID_GARDEN_ID);
            }

            return await this.scheduleService.createMaintenanceSchedule(
                gardenId,
                daysAhead,
                environmentalFactors
            );
        } catch (error) {
            throw new Error(`Failed to create schedule: ${error.message}`);
        }
    }

    /**
     * Retrieves garden schedules with caching support
     */
    @Get(':gardenId')
    @ApiOperation({ summary: 'Get garden maintenance schedules' })
    @ApiResponse({ status: 200, description: 'Schedules retrieved successfully' })
    @ApiResponse({ status: 404, description: 'Garden not found' })
    async getGardenSchedules(
        @Param('gardenId') gardenId: string
    ): Promise<ISchedule[]> {
        try {
            return await this.scheduleService.getGardenSchedule(gardenId);
        } catch (error) {
            throw new Error(`Failed to retrieve schedules: ${error.message}`);
        }
    }

    /**
     * Retrieves pending tasks with filtering and environmental considerations
     */
    @Get('pending/:gardenId')
    @ApiOperation({ summary: 'Get pending maintenance tasks' })
    @ApiQuery({ name: 'taskTypes', required: false, type: [String] })
    @ApiQuery({ name: 'startDate', required: false, type: Date })
    @ApiQuery({ name: 'endDate', required: false, type: Date })
    async getPendingTasks(
        @Param('gardenId') gardenId: string,
        @Query('taskTypes') taskTypes?: TaskType[],
        @Query('startDate') startDate?: Date,
        @Query('endDate') endDate?: Date
    ): Promise<ISchedule[]> {
        try {
            const start = startDate ? new Date(startDate) : new Date();
            const end = endDate ? new Date(endDate) : new Date(start.getTime() + (7 * 24 * 60 * 60 * 1000));

            return await this.scheduleService.getPendingTasks(start, end, {
                taskTypes,
                completed: false
            });
        } catch (error) {
            throw new Error(`Failed to retrieve pending tasks: ${error.message}`);
        }
    }

    /**
     * Marks task as completed with environmental factor updates
     */
    @Put(':scheduleId/complete')
    @ApiOperation({ summary: 'Mark maintenance task as completed' })
    @ApiResponse({ status: 200, description: 'Task marked as completed' })
    @ApiResponse({ status: 404, description: 'Schedule not found' })
    async markTaskCompleted(
        @Param('scheduleId') scheduleId: string,
        @Body('environmentalFactors') environmentalFactors: EnvironmentalFactors
    ): Promise<ISchedule> {
        try {
            return await this.scheduleService.markTaskCompleted(
                scheduleId,
                environmentalFactors
            );
        } catch (error) {
            throw new Error(`Failed to mark task as completed: ${error.message}`);
        }
    }

    /**
     * Updates schedule with environmental factor consideration
     */
    @Put(':scheduleId')
    @ApiOperation({ summary: 'Update maintenance schedule' })
    @ApiResponse({ status: 200, description: 'Schedule updated successfully' })
    @ApiResponse({ status: 400, description: 'Invalid update data' })
    async updateSchedule(
        @Param('scheduleId') scheduleId: string,
        @Body() updateData: Partial<ISchedule>
    ): Promise<ISchedule> {
        try {
            // Validate update data
            if (updateData.dueDate || updateData.taskType) {
                validateSchedule(updateData as ISchedule);
            }

            return await this.scheduleService.updateSchedule(scheduleId, updateData);
        } catch (error) {
            throw new Error(`Failed to update schedule: ${error.message}`);
        }
    }
}