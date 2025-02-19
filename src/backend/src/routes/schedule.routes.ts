import { Router } from 'express'; // ^4.17.1
import { authenticate } from '@nestjs/passport'; // ^8.0.0
import { rateLimit } from 'express-rate-limit'; // ^6.0.0
import { Cache } from 'cache-manager'; // ^4.0.0

import { ScheduleController } from '../controllers/schedule.controller';
import { validateSchedule } from '../validators/schedule.validator';
import { ISchedule } from '../interfaces/schedule.interface';

/**
 * Configures and returns an Express router with enhanced schedule management endpoints
 * Implements caching, rate limiting, and environmental factor support
 * @param controller Instance of ScheduleController for handling schedule operations
 * @returns Configured Express router
 */
export function configureScheduleRoutes(controller: ScheduleController): Router {
    const router = Router();

    // Apply authentication middleware to all routes
    router.use(authenticate('jwt'));

    // Configure rate limiting for notification endpoints
    const notificationRateLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many notification requests, please try again later'
    });

    // Cache configuration for schedule retrieval
    const cacheConfig = {
        ttl: 300, // 5 minutes cache duration
        max: 100 // Maximum number of items in cache
    };

    /**
     * Create new maintenance schedule with environmental factors
     * POST /schedules
     */
    router.post('/', async (req, res, next) => {
        try {
            const { gardenId, daysAhead, environmentalFactors } = req.body;

            // Validate request data
            if (!gardenId || !daysAhead || !environmentalFactors) {
                return res.status(400).json({
                    error: 'Missing required fields: gardenId, daysAhead, or environmentalFactors'
                });
            }

            const schedules = await controller.createSchedule(
                gardenId,
                daysAhead,
                environmentalFactors
            );

            res.status(201).json(schedules);
        } catch (error) {
            next(error);
        }
    });

    /**
     * Retrieve garden schedules with caching
     * GET /schedules/:gardenId
     */
    router.get('/:gardenId', async (req, res, next) => {
        try {
            const { gardenId } = req.params;
            const cacheKey = `schedules:${gardenId}`;

            // Check cache first
            const cachedSchedules = await Cache.get(cacheKey);
            if (cachedSchedules) {
                return res.json(cachedSchedules);
            }

            const schedules = await controller.getGardenSchedules(gardenId);

            // Cache the results
            await Cache.set(cacheKey, schedules, cacheConfig.ttl);

            res.json(schedules);
        } catch (error) {
            next(error);
        }
    });

    /**
     * Retrieve pending tasks with environmental factor consideration
     * GET /schedules/pending
     */
    router.get('/pending', async (req, res, next) => {
        try {
            const { startDate, endDate, taskTypes } = req.query;

            const tasks = await controller.getPendingTasks(
                startDate ? new Date(startDate as string) : undefined,
                endDate ? new Date(endDate as string) : undefined,
                taskTypes as string[]
            );

            res.json(tasks);
        } catch (error) {
            next(error);
        }
    });

    /**
     * Mark task as completed with environmental feedback
     * PUT /schedules/:scheduleId/complete
     */
    router.put('/:scheduleId/complete', notificationRateLimiter, async (req, res, next) => {
        try {
            const { scheduleId } = req.params;
            const { environmentalFactors } = req.body;

            if (!environmentalFactors) {
                return res.status(400).json({
                    error: 'Environmental factors are required for task completion'
                });
            }

            const updatedSchedule = await controller.markTaskCompleted(
                scheduleId,
                environmentalFactors
            );

            // Invalidate relevant caches
            await Cache.del(`schedules:${updatedSchedule.gardenId}`);

            res.json(updatedSchedule);
        } catch (error) {
            next(error);
        }
    });

    /**
     * Update schedule with environmental adjustments
     * PUT /schedules/:scheduleId
     */
    router.put('/:scheduleId', async (req, res, next) => {
        try {
            const { scheduleId } = req.params;
            const updateData: Partial<ISchedule> = req.body;

            // Validate update data
            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({
                    error: 'No update data provided'
                });
            }

            // Validate schedule data if complete update
            if (updateData.dueDate || updateData.taskType) {
                validateSchedule(updateData as ISchedule);
            }

            const updatedSchedule = await controller.updateSchedule(
                scheduleId,
                updateData
            );

            // Invalidate relevant caches
            await Cache.del(`schedules:${updatedSchedule.gardenId}`);

            res.json(updatedSchedule);
        } catch (error) {
            next(error);
        }
    });

    /**
     * Adjust schedule for environmental conditions
     * POST /schedules/:scheduleId/adjust
     */
    router.post('/:scheduleId/adjust', async (req, res, next) => {
        try {
            const { scheduleId } = req.params;
            const { environmentalFactors } = req.body;

            if (!environmentalFactors) {
                return res.status(400).json({
                    error: 'Environmental factors are required for schedule adjustment'
                });
            }

            const adjustedSchedule = await controller.adjustScheduleForEnvironment(
                scheduleId,
                environmentalFactors
            );

            // Invalidate relevant caches
            await Cache.del(`schedules:${adjustedSchedule.gardenId}`);

            res.json(adjustedSchedule);
        } catch (error) {
            next(error);
        }
    });

    // Error handling middleware
    router.use((error: Error, req: any, res: any, next: any) => {
        console.error('Schedule route error:', error);
        res.status(500).json({
            error: 'An error occurred while processing the schedule operation',
            message: error.message
        });
    });

    return router;
}