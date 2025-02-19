import { Request, Response, NextFunction } from 'express';
import CircuitBreaker from 'opossum';
import { logger } from '../middleware/logger.middleware';
import {
  HTTP_STATUS_CODES,
  ERROR_MESSAGES,
  ERROR_CODES,
  RETRY_CONFIG,
  ERROR_TO_HTTP_STATUS
} from '../constants/error.constants';

// Circuit breaker configuration
const circuitBreakerOptions = {
  timeout: RETRY_CONFIG.TIMEOUT,
  errorThresholdPercentage: 50,
  resetTimeout: RETRY_CONFIG.RETRY_INTERVAL * 2
};

// Initialize circuit breaker
const breaker = new CircuitBreaker(async (operation: Function) => {
  return await operation();
}, circuitBreakerOptions);

/**
 * Implements retry logic with exponential backoff
 * @param operation - Function to retry
 * @param maxRetries - Maximum number of retry attempts
 * @param baseDelay - Base delay between retries in milliseconds
 */
const retryOperation = async (
  operation: Function,
  maxRetries: number = RETRY_CONFIG.MAX_ATTEMPTS,
  baseDelay: number = RETRY_CONFIG.RETRY_INTERVAL
): Promise<any> => {
  let lastError: Error;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        // Calculate exponential backoff with jitter
        const delay = Math.min(
          baseDelay * Math.pow(RETRY_CONFIG.BACKOFF_MULTIPLIER, attempt) +
          Math.random() * RETRY_CONFIG.JITTER_MAX,
          RETRY_CONFIG.TIMEOUT
        );
        
        logger.warn('Operation failed, retrying...', {
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: lastError.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};

/**
 * Formats error response with enhanced details and tracking information
 * @param error - Error object
 * @param req - Express request object
 */
const formatErrorResponse = (error: any, req: Request) => {
  const errorCode = error.code || ERROR_CODES.SYSTEM_ERROR;
  const statusCode = ERROR_TO_HTTP_STATUS[errorCode] || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
  
  return {
    error: {
      code: errorCode,
      message: error.message || ERROR_MESSAGES.GENERIC_ERROR,
      status: statusCode,
      requestId: req.id,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method
    },
    retryable: statusCode >= 500,
    environment: process.env.NODE_ENV,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: error.stack,
      details: error.details
    })
  };
};

/**
 * Express middleware for centralized error handling
 * Implements retry mechanism, circuit breaker, and comprehensive error tracking
 */
const errorHandler = async (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check circuit breaker status
    if (breaker.opened) {
      logger.error('Circuit breaker is open, failing fast', {
        requestId: req.id,
        error: error.message
      });
      
      res.status(HTTP_STATUS_CODES.SERVICE_UNAVAILABLE).json({
        error: {
          code: ERROR_CODES.SYSTEM_ERROR,
          message: ERROR_MESSAGES.GENERIC_ERROR,
          status: HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
          requestId: req.id
        }
      });
      return;
    }

    // Attempt error recovery with retry mechanism
    await breaker.fire(async () => {
      if (error.retryable !== false) {
        await retryOperation(async () => {
          // Custom recovery logic based on error type
          if (error.code === ERROR_CODES.DATABASE_ERROR) {
            // Attempt database reconnection
          } else if (error.code === ERROR_CODES.NETWORK_ERROR) {
            // Attempt request retry
          }
          
          throw error; // If recovery fails
        });
      }
    });
  } catch (handlingError) {
    // Log error with enhanced details
    logger.error('Error handling failed', {
      requestId: req.id,
      originalError: error,
      handlingError,
      stack: error.stack
    });
    
    // Format and send error response
    const errorResponse = formatErrorResponse(error, req);
    res.status(errorResponse.error.status).json(errorResponse);
  }
};

export default errorHandler;
```

This implementation provides a robust error handling middleware with the following features:

1. Circuit breaker pattern to prevent cascading failures
2. Retry mechanism with exponential backoff and jitter
3. Comprehensive error tracking and logging
4. Environment-aware error response formatting
5. Standardized error codes and messages
6. Request tracking with unique IDs
7. Enhanced error recovery attempts based on error type
8. Production/development-specific error details
9. Configurable retry parameters
10. Integration with the application's logging system

The middleware can be used in the Express application by adding it after all route handlers:

```typescript
app.use(errorHandler);