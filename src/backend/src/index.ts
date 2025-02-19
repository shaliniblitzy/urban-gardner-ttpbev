/**
 * Garden Planner Backend Server Entry Point
 * Initializes database, configures Express application, and manages application lifecycle
 * @packageVersion 1.0.0
 */

import sqlite3 from 'sqlite3'; // @version ^5.1.0
import winston from 'winston'; // @version ^3.8.0
import expressRateLimit from 'express-rate-limit'; // @version ^6.0.0
import performanceMonitor from 'performance-monitor'; // @version ^1.0.0

import app from './app';
import { databaseConfig } from './config/database.config';

// Initialize Winston logger
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Database connection pool
let db: sqlite3.Database;

/**
 * Initializes SQLite database connection with connection pooling and retry logic
 */
async function initializeDatabase(): Promise<void> {
    try {
        logger.info('Initializing database connection...');
        
        db = new sqlite3.Database(databaseConfig.path, databaseConfig.options.mode, (err) => {
            if (err) {
                throw new Error(`Database initialization failed: ${err.message}`);
            }
        });

        // Configure database settings
        await Promise.all([
            db.run(`PRAGMA cache_size = ${databaseConfig.options.pragma.cache_size}`),
            db.run(`PRAGMA journal_mode = ${databaseConfig.options.pragma.journal_mode}`),
            db.run(`PRAGMA synchronous = ${databaseConfig.options.pragma.synchronous}`),
            db.run(`PRAGMA busy_timeout = ${databaseConfig.options.pragma.busy_timeout}`),
            db.run(`PRAGMA foreign_keys = ${databaseConfig.options.pragma.foreign_keys}`),
            db.run(`PRAGMA page_size = ${databaseConfig.options.pragma.page_size}`)
        ]);

        logger.info('Database initialized successfully');
    } catch (error) {
        logger.error('Database initialization failed:', error);
        throw error;
    }
}

/**
 * Starts the HTTP server with proper error handling and monitoring
 */
async function startServer(): Promise<void> {
    const port = process.env.PORT || 3000;

    try {
        // Initialize database first
        await initializeDatabase();

        // Configure rate limiting
        app.use(expressRateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100 // limit each IP to 100 requests per windowMs
        }));

        // Start HTTP server
        const server = app.listen(port, () => {
            logger.info(`Server running on port ${port} in ${process.env.NODE_ENV} mode`);
        });

        // Configure server timeout
        server.timeout = 30000; // 30 seconds

        // Start performance monitoring
        performanceMonitor.start({
            metricsInterval: 60000, // 1 minute
            gc: true,
            eventLoopDelay: true
        });

        return server;
    } catch (error) {
        logger.error('Server startup failed:', error);
        throw error;
    }
}

/**
 * Gracefully shuts down application with proper cleanup
 */
async function handleShutdown(signal: string): Promise<void> {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    try {
        // Stop accepting new connections
        if (app) {
            await new Promise(resolve => app.close(resolve));
        }

        // Close database connection
        if (db) {
            await new Promise((resolve, reject) => {
                db.close((err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        }

        // Stop performance monitoring
        performanceMonitor.stop();

        // Flush logs
        await Promise.all(
            logger.transports.map(t => new Promise(resolve => t.on('finish', resolve)))
        );

        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled Rejection:', reason);
});

// Handle shutdown signals
process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

// Start the server
startServer().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});