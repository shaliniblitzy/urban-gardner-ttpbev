import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import morgan from 'morgan';
import { v4 as uuidv4 } from 'uuid';
import { HTTP_STATUS_CODES } from '../constants/error.constants';

// Custom interface to extend Express Request with logger
declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
      logger: winston.Logger;
    }
  }
}

// Configure Winston logger with custom format and transports
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        requestId,
        message,
        ...meta
      });
    })
  ),
  transports: [
    // Console transport with color coding for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File transport with daily rotation for production
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Performance metrics tracking
const metrics = {
  requestCount: 0,
  errorCount: 0,
  responseTimeTotal: 0,
  memoryUsage: {
    initial: 0,
    final: 0
  }
};

/**
 * Request logging middleware
 * Logs incoming HTTP requests with unique ID and timing information
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  const requestId = uuidv4();
  req.id = requestId;
  req.startTime = Date.now();

  // Attach logger instance to request
  req.logger = logger.child({ requestId });

  // Track initial memory usage
  metrics.memoryUsage.initial = process.memoryUsage().heapUsed;
  metrics.requestCount++;

  // Log request details
  req.logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: process.env.NODE_ENV !== 'production' ? req.body : '[REDACTED]',
    ip: req.ip
  });

  // Use Morgan for standard HTTP logging
  morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.http(message.trim());
      }
    }
  })(req, res, next);
};

/**
 * Response logging middleware
 * Logs HTTP response details and performance metrics
 */
export const responseLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Capture response timing
  const responseTime = Date.now() - req.startTime;
  metrics.responseTimeTotal += responseTime;

  // Track final memory usage
  metrics.memoryUsage.final = process.memoryUsage().heapUsed;
  const memoryDiff = metrics.memoryUsage.final - metrics.memoryUsage.initial;

  // Store original response send
  const originalSend = res.send;

  // Override response send method to capture response body
  res.send = function (body: any): Response {
    res.send = originalSend;
    
    // Log response details
    req.logger.info('Outgoing response', {
      statusCode: res.statusCode,
      responseTime,
      memoryUsed: memoryDiff,
      headers: res.getHeaders(),
      body: res.statusCode !== HTTP_STATUS_CODES.OK ? body : '[SUCCESS]'
    });

    // Log performance metrics
    if (process.env.NODE_ENV === 'production') {
      req.logger.debug('Performance metrics', {
        averageResponseTime: metrics.responseTimeTotal / metrics.requestCount,
        totalRequests: metrics.requestCount,
        errorRate: (metrics.errorCount / metrics.requestCount) * 100,
        memoryUsage: process.memoryUsage()
      });
    }

    return originalSend.call(this, body);
  };

  next();
};

/**
 * Error logging middleware
 * Logs detailed error information with stack traces and metrics
 */
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  metrics.errorCount++;

  // Log error details
  req.logger.error('Request error', {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      status: res.statusCode
    },
    request: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: process.env.NODE_ENV !== 'production' ? req.body : '[REDACTED]'
    }
  });

  // Track error metrics
  if (process.env.NODE_ENV === 'production') {
    req.logger.debug('Error metrics', {
      totalErrors: metrics.errorCount,
      errorRate: (metrics.errorCount / metrics.requestCount) * 100,
      errorType: error.name,
      statusCode: res.statusCode
    });
  }

  next(error);
};

// Export logger instance for use in other modules
export const appLogger = logger;
```

This implementation provides a robust logging system with the following features:

1. Structured logging using Winston with multiple transports (console and file)
2. Request tracing with unique IDs using UUID
3. Performance monitoring including response times and memory usage
4. Detailed request/response logging with environment-based redaction
5. Error tracking with stack traces and metrics
6. Log rotation and size management
7. Morgan integration for standard HTTP logging
8. Production/development environment awareness
9. Metric collection for monitoring and analytics

The middleware can be used in the main application by applying the middleware functions in the correct order:

```typescript
app.use(requestLogger);
app.use(responseLogger);
app.use(errorLogger);