import { Router } from 'express'; // ^4.18.2
import helmet from 'helmet'; // ^7.0.0
import compression from 'compression'; // ^1.7.4
import rateLimit from 'express-rate-limit'; // ^6.7.0

import { NotificationController } from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateScheduleRequest } from '../middleware/validation.middleware';
import errorHandler from '../middleware/error.middleware';

// Initialize router
const router = Router();

// Initialize controller
const notificationController = new NotificationController();

// Configure rate limiters
const maintenanceRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many maintenance notifications created, please try again later'
});

const notificationRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // Limit each IP to 50 requests per window
    message: 'Too many notification requests, please try again later'
});

// Apply global middleware
router.use(helmet()); // Security headers
router.use(compression()); // Response compression

// Maintenance notification routes
router.post(
    '/maintenance',
    maintenanceRateLimiter,
    authenticateToken,
    validateScheduleRequest,
    notificationController.createMaintenanceNotification
);

router.post(
    '/watering',
    maintenanceRateLimiter,
    authenticateToken,
    validateScheduleRequest,
    notificationController.createWateringNotification
);

router.post(
    '/fertilizer',
    maintenanceRateLimiter,
    authenticateToken,
    validateScheduleRequest,
    notificationController.createFertilizerNotification
);

// Direct notification routes
router.post(
    '/send',
    notificationRateLimiter,
    authenticateToken,
    notificationController.sendNotification
);

router.post(
    '/batch',
    notificationRateLimiter,
    authenticateToken,
    notificationController.sendBatchNotifications
);

// Notification status routes
router.get(
    '/status',
    notificationRateLimiter,
    authenticateToken,
    notificationController.getNotificationStatus
);

// Apply error handling middleware
router.use(errorHandler);

export default router;