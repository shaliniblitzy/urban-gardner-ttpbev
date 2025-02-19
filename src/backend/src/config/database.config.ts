// External imports
// path@1.7.0 - Handle database file paths
import * as path from 'path';
// sqlite3@5.1.0 - SQLite database driver type definitions
import { Database } from 'sqlite3';

// Global database file path
const DB_PATH = path.join(__dirname, '../../data/garden.db');

// Database configuration constants
const MAX_CONNECTIONS = 10;
const CONNECTION_TIMEOUT = 60000; // 60 seconds
const CACHE_SIZE = -2000; // 2MB cache size (negative value means kilobytes)
const BUSY_TIMEOUT = 30000; // 30 seconds
const JOURNAL_MODE = 'WAL'; // Write-Ahead Logging for better concurrency
const SYNCHRONOUS = 'NORMAL'; // Balance between safety and performance

/**
 * Returns optimized SQLite connection options
 * Configures performance settings including caching, journaling, and timeouts
 */
const getConnectionOptions = (): Record<string, any> => {
    return {
        // Basic connection settings
        timeout: CONNECTION_TIMEOUT,
        
        // Performance optimizations
        pragma: {
            // Cache settings
            'cache_size': CACHE_SIZE,
            
            // Journal settings
            'journal_mode': JOURNAL_MODE,
            'synchronous': SYNCHRONOUS,
            
            // Concurrency settings
            'busy_timeout': BUSY_TIMEOUT,
            
            // Enable foreign keys for referential integrity
            'foreign_keys': 'ON',
            
            // Enable automatic indexing for faster queries
            'automatic_index': 'ON',
            
            // Memory management
            'page_size': 4096,
            'mmap_size': 30000000000, // 30GB max memory map
            
            // Temp storage settings
            'temp_store': 'MEMORY'
        },
        
        // Verbose error reporting in development
        verbose: process.env.NODE_ENV === 'development',
        
        // File locking settings
        fileMustExist: false,
        
        // Read/write mode
        mode: Database.OPEN_READWRITE | Database.OPEN_CREATE
    };
};

/**
 * Database configuration object exported for application use
 * Contains path, connection limits and optimized SQLite options
 */
export const databaseConfig = {
    // Database file path
    path: DB_PATH,
    
    // Maximum number of concurrent connections
    maxConnections: MAX_CONNECTIONS,
    
    // Connection options with optimized settings
    options: getConnectionOptions()
} as const;

// Type definitions for database configuration
export type DatabaseConfig = typeof databaseConfig;