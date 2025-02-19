// External imports
// sqlite3@5.1.0 - SQLite database driver
import * as sqlite3 from 'sqlite3';
// winston@3.8.0 - Logging utility
import * as winston from 'winston';
// generic-pool@3.9.0 - Connection pooling
import * as genericPool from 'generic-pool';

// Internal imports
import { databaseConfig } from '../config/database.config';

// Constants for database operations
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const TRANSACTION_TIMEOUT = 30000;
const MAX_POOL_SIZE = 10;
const MIN_POOL_SIZE = 2;
const CONNECTION_TIMEOUT = 5000;
const IDLE_TIMEOUT = 10000;

// Types for database utilities
interface RetryConfig {
    maxRetries?: number;
    delay?: number;
    exponentialBackoff?: boolean;
}

interface QueryOptimizationConfig {
    useIndexes?: boolean;
    analyzeExplainPlan?: boolean;
    suggestIndexes?: boolean;
}

interface OptimizedQuery {
    sql: string;
    explainPlan?: any;
    suggestedIndexes?: string[];
    estimatedCost?: number;
}

// Initialize logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'database-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'database.log' })
    ]
});

/**
 * Creates and manages a pool of SQLite database connections
 * @param config Pool configuration parameters
 * @returns Promise<genericPool.Pool<sqlite3.Database>>
 */
export const createConnectionPool = async (): Promise<genericPool.Pool<sqlite3.Database>> => {
    const factory = {
        create: async (): Promise<sqlite3.Database> => {
            return new Promise((resolve, reject) => {
                const db = new sqlite3.Database(
                    databaseConfig.path,
                    databaseConfig.options.mode,
                    (err) => {
                        if (err) {
                            logger.error('Failed to create database connection', { error: err });
                            reject(err);
                        } else {
                            // Configure connection with optimized settings
                            Object.entries(databaseConfig.options.pragma).forEach(([key, value]) => {
                                db.run(`PRAGMA ${key}=${value};`);
                            });
                            resolve(db);
                        }
                    }
                );
            });
        },
        destroy: async (client: sqlite3.Database): Promise<void> => {
            return new Promise((resolve, reject) => {
                client.close((err) => {
                    if (err) {
                        logger.error('Failed to close database connection', { error: err });
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        },
        validate: async (client: sqlite3.Database): Promise<boolean> => {
            return new Promise((resolve) => {
                client.get('SELECT 1', (err) => {
                    resolve(!err);
                });
            });
        }
    };

    const poolConfig = {
        max: MAX_POOL_SIZE,
        min: MIN_POOL_SIZE,
        acquireTimeoutMillis: CONNECTION_TIMEOUT,
        idleTimeoutMillis: IDLE_TIMEOUT,
        testOnBorrow: true
    };

    return genericPool.createPool(factory, poolConfig);
};

/**
 * Executes a series of database operations within a transaction
 * @param pool Database connection pool
 * @param operations Function containing database operations
 * @param timeout Transaction timeout in milliseconds
 * @returns Promise<any>
 */
export const executeTransaction = async <T>(
    pool: genericPool.Pool<sqlite3.Database>,
    operations: (db: sqlite3.Database) => Promise<T>,
    timeout: number = TRANSACTION_TIMEOUT
): Promise<T> => {
    const client = await pool.acquire();
    let timeoutId: NodeJS.Timeout;

    try {
        return await new Promise<T>((resolve, reject) => {
            timeoutId = setTimeout(() => {
                reject(new Error('Transaction timeout'));
            }, timeout);

            client.run('BEGIN TRANSACTION', async (err) => {
                if (err) {
                    reject(err);
                    return;
                }

                try {
                    const result = await operations(client);
                    client.run('COMMIT', (commitErr) => {
                        clearTimeout(timeoutId);
                        if (commitErr) {
                            reject(commitErr);
                        } else {
                            resolve(result);
                        }
                    });
                } catch (operationErr) {
                    client.run('ROLLBACK', () => {
                        clearTimeout(timeoutId);
                        reject(operationErr);
                    });
                }
            });
        });
    } finally {
        await pool.release(client);
    }
};

/**
 * Executes a database operation with automatic retry and circuit breaker
 * @param pool Database connection pool
 * @param operation Database operation to execute
 * @param config Retry configuration
 * @returns Promise<any>
 */
export const executeWithRetry = async <T>(
    pool: genericPool.Pool<sqlite3.Database>,
    operation: (db: sqlite3.Database) => Promise<T>,
    config: RetryConfig = {}
): Promise<T> => {
    const maxRetries = config.maxRetries || MAX_RETRIES;
    const delay = config.delay || RETRY_DELAY;
    const exponentialBackoff = config.exponentialBackoff ?? true;
    let attempts = 0;

    while (true) {
        try {
            const client = await pool.acquire();
            try {
                return await operation(client);
            } finally {
                await pool.release(client);
            }
        } catch (error) {
            attempts++;
            if (attempts >= maxRetries) {
                logger.error('Max retry attempts reached', {
                    error,
                    attempts,
                    maxRetries
                });
                throw error;
            }

            const waitTime = exponentialBackoff
                ? delay * Math.pow(2, attempts - 1)
                : delay;

            logger.warn('Retrying database operation', {
                attempt: attempts,
                waitTime,
                error
            });

            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
};

/**
 * Optimizes a SQL query using explain query plan and index analysis
 * @param query SQL query to optimize
 * @param config Query optimization configuration
 * @returns Promise<OptimizedQuery>
 */
export const optimizeQuery = async (
    query: string,
    config: QueryOptimizationConfig = {}
): Promise<OptimizedQuery> => {
    const pool = await createConnectionPool();
    const client = await pool.acquire();

    try {
        const optimizedQuery: OptimizedQuery = { sql: query };

        if (config.analyzeExplainPlan) {
            optimizedQuery.explainPlan = await new Promise((resolve, reject) => {
                client.all(`EXPLAIN QUERY PLAN ${query}`, (err, plan) => {
                    if (err) reject(err);
                    else resolve(plan);
                });
            });
        }

        if (config.suggestIndexes) {
            const tableNames = query.match(/FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi)
                ?.map(match => match.replace('FROM ', ''));

            if (tableNames) {
                const suggestedIndexes: string[] = [];
                for (const tableName of tableNames) {
                    const indexAnalysis = await new Promise((resolve, reject) => {
                        client.all(
                            `SELECT * FROM sqlite_master WHERE type='index' AND tbl_name=?`,
                            [tableName],
                            (err, indexes) => {
                                if (err) reject(err);
                                else resolve(indexes);
                            }
                        );
                    });
                    
                    if (Array.isArray(indexAnalysis) && indexAnalysis.length === 0) {
                        const columns = query.match(
                            new RegExp(`${tableName}\\.([a-zA-Z_][a-zA-Z0-9_]*)`, 'gi')
                        )?.map(match => match.split('.')[1]);

                        if (columns?.length) {
                            suggestedIndexes.push(
                                `CREATE INDEX idx_${tableName}_${columns.join('_')} ON ${tableName}(${columns.join(',')})`
                            );
                        }
                    }
                }
                optimizedQuery.suggestedIndexes = suggestedIndexes;
            }
        }

        return optimizedQuery;
    } finally {
        await pool.release(client);
        await pool.drain();
        await pool.clear();
    }
};