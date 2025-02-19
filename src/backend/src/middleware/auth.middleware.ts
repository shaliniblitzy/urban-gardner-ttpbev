// @package-version express@4.18.2
// @package-version winston@3.8.2
// @package-version express-rate-limit@6.7.0

import { Request, Response, NextFunction } from 'express';
import { verifyToken, validatePermission } from '../utils/security.utils';
import { securityConfig } from '../config/security.config';
import winston from 'winston';
import rateLimit from 'express-rate-limit';

// Configure auth logger
const authLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'auth-middleware' },
  transports: [
    new winston.transports.File({ filename: 'auth.log' })
  ]
});

// Permission cache with TTL
const permissionCache = new Map<string, {
  permissions: Set<string>;
  timestamp: number;
}>();

// Cache TTL in milliseconds (5 minutes)
const PERMISSION_CACHE_TTL = 5 * 60 * 1000;

// Rate limiter for authentication
const authRateLimiter = rateLimit({
  windowMs: securityConfig.authorization.rateLimit.windowMs,
  max: securityConfig.authorization.rateLimit.maxRequests,
  message: 'Too many authentication attempts, please try again later'
});

// Rate limiter for authorization
const authzRateLimiter = rateLimit({
  windowMs: securityConfig.authorization.rateLimit.windowMs,
  max: securityConfig.authorization.rateLimit.maxRequests * 2, // More lenient for authorized users
  message: 'Too many authorization attempts, please try again later'
});

/**
 * Enhanced middleware to authenticate JWT tokens with device fingerprint validation
 * and refresh token rotation
 */
export const authenticateToken = authRateLimiter(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token and device fingerprint
      const authHeader = req.headers.authorization;
      const deviceFingerprint = req.headers['x-device-fingerprint'] as string;

      if (!authHeader?.startsWith('Bearer ')) {
        authLogger.warn('Authentication failed: No bearer token provided');
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      if (!deviceFingerprint) {
        authLogger.warn('Authentication failed: No device fingerprint provided');
        res.status(401).json({ error: 'Device fingerprint required' });
        return;
      }

      const token = authHeader.split(' ')[1];

      // Verify token with device fingerprint
      const decoded = await verifyToken(token, deviceFingerprint);

      // Check for token expiration and rotation
      const tokenExp = decoded.exp! * 1000; // Convert to milliseconds
      const now = Date.now();
      const timeToExpiry = tokenExp - now;

      // Attach user data to request
      req.user = {
        id: decoded.sub!,
        role: decoded.role as keyof typeof securityConfig.authorization.roles,
        sessionId: decoded.jti
      };

      // Check for token rotation if enabled
      if (securityConfig.jwt.refreshToken.rotationEnabled && 
          timeToExpiry < securityConfig.jwt.tokenValidation.clockTolerance * 1000) {
        // Token is near expiry, generate new token
        const newToken = await generateNewToken(req.user, deviceFingerprint);
        res.setHeader('X-New-Token', newToken);
      }

      authLogger.info({
        message: 'Authentication successful',
        userId: req.user.id,
        role: req.user.role
      });

      next();
    } catch (error) {
      authLogger.error({
        message: 'Authentication failed',
        error: error.message
      });

      res.status(401).json({ error: 'Invalid token' });
    }
  }
);

/**
 * Enhanced middleware to check user permissions with role hierarchy and caching
 */
export const authorizePermission = (requiredPermissions: string[]) => {
  return authzRateLimiter(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { user } = req;

        if (!user) {
          throw new Error('User not authenticated');
        }

        // Check permission cache
        const cacheKey = `${user.id}:${user.role}:${requiredPermissions.join(',')}`;
        const cachedPermissions = permissionCache.get(cacheKey);

        if (cachedPermissions && 
            Date.now() - cachedPermissions.timestamp < PERMISSION_CACHE_TTL) {
          const hasPermissions = requiredPermissions.every(
            permission => cachedPermissions.permissions.has(permission)
          );

          if (hasPermissions) {
            next();
            return;
          }
        }

        // Validate permissions
        const hasPermissions = await validatePermission(user.role, requiredPermissions);

        if (!hasPermissions) {
          authLogger.warn({
            message: 'Authorization failed: Insufficient permissions',
            userId: user.id,
            role: user.role,
            requiredPermissions
          });

          res.status(403).json({
            error: 'Insufficient permissions'
          });
          return;
        }

        // Update permission cache
        permissionCache.set(cacheKey, {
          permissions: new Set(requiredPermissions),
          timestamp: Date.now()
        });

        authLogger.info({
          message: 'Authorization successful',
          userId: user.id,
          role: user.role,
          permissions: requiredPermissions
        });

        next();
      } catch (error) {
        authLogger.error({
          message: 'Authorization failed',
          error: error.message
        });

        res.status(403).json({
          error: 'Authorization failed'
        });
      }
    }
  );
};

/**
 * Helper function to generate a new token during rotation
 */
async function generateNewToken(
  user: { id: string; role: keyof typeof securityConfig.authorization.roles; sessionId: string },
  deviceFingerprint: string
): Promise<string> {
  // Implementation would call the token generation utility
  // This is a placeholder for the actual implementation
  return 'new.token.here';
}

// Extend Express Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: keyof typeof securityConfig.authorization.roles;
        sessionId: string;
      };
    }
  }
}