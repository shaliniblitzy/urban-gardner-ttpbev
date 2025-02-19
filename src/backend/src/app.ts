/**
 * Garden Planner Application Entry Point
 * Configures and initializes the Express/NestJS backend server with comprehensive
 * security, performance optimization, monitoring, and error handling
 * @packageVersion 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // @version ^4.18.2
import cors from 'cors'; // @version ^2.8.5
import helmet from 'helmet'; // @version ^4.6.0
import compression from 'compression'; // @version ^1.7.4
import winston from 'winston'; // @version ^3.8.2

import { gardenRoutes } from './routes/garden.routes';
import { scheduleRoutes } from './routes/schedule.routes';
import { authenticateToken } from './middleware/auth.middleware';
import { errorHandler } from './middleware/error.middleware';
import { requestLogger, responseLogger, errorLogger } from './middleware/logger.middleware';

// Environment variables with defaults
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_WHITELIST = process.env.CORS_WHITELIST?.split(',') || [];
const MAX_REQUEST_SIZE = process.env.MAX_REQUEST_SIZE || '1mb';

// Initialize Express application
const app: Express = express();

/**
 * Configures global middleware with enhanced security and performance features
 * @param app Express application instance
 */
function configureMiddleware(app: Express): void {
    // Security middleware
    app.use(helmet({
        contentSecurityPolicy: true,
        crossOriginEmbedderPolicy: true,
        crossOriginOpenerPolicy: true,
        crossOriginResourcePolicy: true,
        dnsPrefetchControl: true,
        frameguard: true,
        hidePoweredBy: true,
        hsts: true,
        ieNoOpen: true,
        noSniff: true,
        permittedCrossDomainPolicies: true,
        referrerPolicy: true,
        xssFilter: true
    }));

    // CORS configuration
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin || CORS_WHITELIST.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Fingerprint'],
        credentials: true,
        maxAge: 86400 // 24 hours
    }));

    // Compression middleware
    app.use(compression({
        level: 6,
        threshold: 1024,
        filter: (req, res) => {
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        }
    }));

    // Body parsing middleware
    app.use(express.json({ limit: MAX_REQUEST_SIZE }));
    app.use(express.urlencoded({ extended: true, limit: MAX_REQUEST_SIZE }));

    // Logging middleware
    app.use(requestLogger);
    app.use(responseLogger);
}

/**
 * Configures API routes with validation and monitoring
 * @param app Express application instance
 */
function configureRoutes(app: Express): void {
    // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: NODE_ENV
        });
    });

    // API routes with authentication
    app.use('/api/garden', authenticateToken, gardenRoutes);
    app.use('/api/schedules', authenticateToken, scheduleRoutes);

    // 404 handler
    app.use((req: Request, res: Response) => {
        res.status(404).json({
            error: 'Not Found',
            message: `Route ${req.path} not found`,
            path: req.path,
            timestamp: new Date().toISOString()
        });
    });

    // Error handling middleware
    app.use(errorLogger);
    app.use(errorHandler);
}

/**
 * Initializes and starts the Express server with graceful shutdown
 * @param app Express application instance
 */
async function startServer(app: Express): Promise<void> {
    try {
        // Configure middleware and routes
        configureMiddleware(app);
        configureRoutes(app);

        // Start server
        const server = app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
        });

        // Graceful shutdown handling
        process.on('SIGTERM', () => {
            console.log('SIGTERM received. Starting graceful shutdown...');
            server.close(() => {
                console.log('Server closed. Process terminating...');
                process.exit(0);
            });
        });

        process.on('uncaughtException', (error: Error) => {
            console.error('Uncaught Exception:', error);
            server.close(() => {
                process.exit(1);
            });
        });

        process.on('unhandledRejection', (reason: any) => {
            console.error('Unhandled Rejection:', reason);
            server.close(() => {
                process.exit(1);
            });
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer(app);

// Export app instance for testing
export { app };