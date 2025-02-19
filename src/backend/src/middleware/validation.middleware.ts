import { Request, Response, NextFunction } from 'express'; // @version 4.18.2
import { ValidationError } from 'class-validator'; // @version 0.14.0
import { validateGardenInput } from '../validators/garden.validator';
import { validatePlant } from '../validators/plant.validator';
import { validateSchedule } from '../validators/schedule.validator';
import { ERROR_MESSAGES } from '../constants/error.constants';

/**
 * Maximum request body size limits in bytes
 */
const REQUEST_SIZE_LIMITS = {
    GARDEN: 1024 * 1024, // 1MB
    PLANT: 512 * 1024,   // 500KB
    SCHEDULE: 200 * 1024 // 200KB
} as const;

/**
 * Middleware to validate garden-related requests
 * Implements F-001-RQ-001 requirements for garden area validation
 */
export const validateGardenRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Validate request body size
        if (req.headers['content-length'] && 
            parseInt(req.headers['content-length']) > REQUEST_SIZE_LIMITS.GARDEN) {
            throw new ValidationError('Request body exceeds size limit');
        }

        // Sanitize input
        const gardenData = {
            ...req.body,
            area: Number(req.body.area),
            zones: Array.isArray(req.body.zones) ? req.body.zones : []
        };

        // Validate garden data
        await validateGardenInput(gardenData);

        next();
    } catch (error) {
        handleValidationError(error, res);
    }
};

/**
 * Middleware to validate plant-related requests
 * Implements plant data integrity validation
 */
export const validatePlantRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Validate request body size
        if (req.headers['content-length'] && 
            parseInt(req.headers['content-length']) > REQUEST_SIZE_LIMITS.PLANT) {
            throw new ValidationError('Request body exceeds size limit');
        }

        // Sanitize and validate plant data
        const plantData = req.body;
        const adjacentPlants = Array.isArray(req.body.adjacentPlants) 
            ? req.body.adjacentPlants 
            : [];

        await validatePlant(plantData, adjacentPlants);

        next();
    } catch (error) {
        handleValidationError(error, res);
    }
};

/**
 * Middleware to validate schedule-related requests
 * Implements F-002-RQ-001 requirements for maintenance schedules
 */
export const validateScheduleRequest = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Validate request body size
        if (req.headers['content-length'] && 
            parseInt(req.headers['content-length']) > REQUEST_SIZE_LIMITS.SCHEDULE) {
            throw new ValidationError('Request body exceeds size limit');
        }

        // Parse dates in schedule data
        const scheduleData = {
            ...req.body,
            dueDate: new Date(req.body.dueDate),
            completedDate: req.body.completedDate ? new Date(req.body.completedDate) : null
        };

        await validateSchedule(scheduleData);

        next();
    } catch (error) {
        handleValidationError(error, res);
    }
};

/**
 * Enhanced error handler for validation errors
 * Provides detailed error context and suggestions
 */
const handleValidationError = (error: ValidationError, res: Response): void => {
    const errorResponse = {
        code: 'VALIDATION_ERROR',
        message: error.message || ERROR_MESSAGES.GENERIC_ERROR,
        details: Array.isArray(error.constraints) 
            ? error.constraints 
            : [error.message],
        timestamp: new Date().toISOString(),
        path: res.req.path,
        suggestions: getSuggestions(error)
    };

    // Log validation error for monitoring
    console.error('Validation Error:', {
        ...errorResponse,
        stack: error.stack
    });

    res.status(400).json(errorResponse);
};

/**
 * Helper function to generate error correction suggestions
 */
const getSuggestions = (error: ValidationError): string[] => {
    const suggestions: string[] = [];

    if (error.message?.includes('garden area')) {
        suggestions.push('Garden area must be between 1 and 1000 square feet');
        suggestions.push('Only numeric values are allowed');
    }

    if (error.message?.includes('sunlight')) {
        suggestions.push('Specify sunlight conditions for each garden zone');
        suggestions.push('Valid conditions are: FULL_SUN, PARTIAL_SHADE, FULL_SHADE');
    }

    if (error.message?.includes('schedule')) {
        suggestions.push('Ensure all required schedule fields are provided');
        suggestions.push('Check that dates are in valid format (YYYY-MM-DD)');
    }

    return suggestions.length > 0 ? suggestions : ['Please review input requirements and try again'];
};