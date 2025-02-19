/**
 * Plant Routes Configuration
 * Implements comprehensive route handling for plant management including
 * growth tracking, care scheduling, and space optimization
 * @version 1.0.0
 */

import { Router } from 'express'; // @version 4.18.2
import { rateLimit } from 'express-rate-limit'; // @version 6.7.0
import compression from 'compression'; // @version 1.7.4
import cacheManager from 'cache-manager'; // @version 4.1.0
import { PlantController } from '../controllers/plant.controller';
import { validatePlantRequest } from '../middleware/validation.middleware';

// Initialize cache store for optimizing repeated requests
const memoryCache = cacheManager.caching({ store: 'memory', max: 100, ttl: 3600 });

// Configure rate limiting for API protection
const plantRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later'
});

// Initialize router with compression middleware
const router = Router();
router.use(compression());
router.use(plantRateLimit);

/**
 * POST /plants
 * Creates a new plant with environmental factor validation
 * @requires validatePlantRequest middleware
 */
router.post('/', validatePlantRequest, async (req, res, next) => {
    try {
        const plant = await PlantController.createPlant(req.body);
        res.status(201).json(plant);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /plants/:id
 * Retrieves plant by ID with current environmental data
 * Implements caching for performance optimization
 */
router.get('/:id', async (req, res, next) => {
    try {
        const cachedPlant = await memoryCache.get(`plant_${req.params.id}`);
        if (cachedPlant) {
            return res.json(cachedPlant);
        }

        const plant = await PlantController.getPlantById(req.params.id);
        await memoryCache.set(`plant_${req.params.id}`, plant);
        res.json(plant);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /plants/type/:type
 * Retrieves plants by type with environmental compatibility
 */
router.get('/type/:type', async (req, res, next) => {
    try {
        const plants = await PlantController.getPlantsByType(req.params.type);
        res.json(plants);
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /plants/:id/growth-stage
 * Updates plant growth stage based on environmental factors
 */
router.put('/:id/growth-stage', validatePlantRequest, async (req, res, next) => {
    try {
        const updatedPlant = await PlantController.updateGrowthStage(
            req.params.id,
            req.body.environmentalFactors
        );
        await memoryCache.del(`plant_${req.params.id}`);
        res.json(updatedPlant);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /plants/:id/next-care
 * Calculates next care date considering environmental factors
 */
router.get('/:id/next-care', async (req, res, next) => {
    try {
        const nextCareDate = await PlantController.getNextCareDate(
            req.params.id,
            req.query.careType as 'watering' | 'fertilizing'
        );
        res.json({ nextCareDate });
    } catch (error) {
        next(error);
    }
});

/**
 * GET /plants/zone/:zoneId
 * Retrieves plants by garden zone with spacing validation
 */
router.get('/zone/:zoneId', async (req, res, next) => {
    try {
        const plants = await PlantController.getPlantsByZone(req.params.zoneId);
        res.json(plants);
    } catch (error) {
        next(error);
    }
});

/**
 * GET /plants/:id/companions
 * Retrieves compatible companion plants
 */
router.get('/:id/companions', async (req, res, next) => {
    try {
        const companions = await PlantController.getCompanionPlants(req.params.id);
        res.json(companions);
    } catch (error) {
        next(error);
    }
});

/**
 * PUT /plants/:id
 * Updates plant information with validation
 */
router.put('/:id', validatePlantRequest, async (req, res, next) => {
    try {
        const updatedPlant = await PlantController.updatePlant(
            req.params.id,
            req.body
        );
        await memoryCache.del(`plant_${req.params.id}`);
        res.json(updatedPlant);
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /plants/:id
 * Removes a plant and updates related environmental calculations
 */
router.delete('/:id', async (req, res, next) => {
    try {
        await PlantController.deletePlant(req.params.id);
        await memoryCache.del(`plant_${req.params.id}`);
        res.status(204).send();
    } catch (error) {
        next(error);
    }
});

// Error handling middleware
router.use((error: any, req: any, res: any, next: any) => {
    console.error('Plant Route Error:', error);
    res.status(error.status || 500).json({
        error: {
            message: error.message || 'Internal server error',
            code: error.code || 'INTERNAL_ERROR'
        }
    });
});

export default router;