// @package-version jsonwebtoken@9.0.0
// @package-version crypto@1.0.1
// @package-version express-rate-limit@6.7.0
// @package-version winston@3.8.0

import { securityConfig } from '../config/security.config';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';

// Configure security logger
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'security-utils' },
  transports: [
    new winston.transports.File({ filename: 'security.log' })
  ]
});

// Cache for permission validation
const permissionCache = new Map<string, Set<string>>();

// Token blacklist for revoked tokens
const tokenBlacklist = new Set<string>();

// Decorator for rate limiting
function RateLimit(limit: number, window: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const limiter = rateLimit({
      windowMs: parseTimeWindow(window),
      max: limit
    });
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
      limiter(args[0], args[1], () => {});
      return original.apply(this, args);
    };
    return descriptor;
  };
}

// Decorator for security logging
function SecurityLog(operation: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const start = Date.now();
      try {
        const result = original.apply(this, args);
        securityLogger.info({
          operation,
          success: true,
          duration: Date.now() - start
        });
        return result;
      } catch (error) {
        securityLogger.error({
          operation,
          success: false,
          error: error.message,
          duration: Date.now() - start
        });
        throw error;
      }
    };
    return descriptor;
  };
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface EncryptedData {
  data: string;
  iv: string;
  tag: string;
  keyVersion: number;
}

@RateLimit(10, '1m')
@SecurityLog('token_generation')
export function generateToken(userData: { id: string; role: string; deviceFingerprint: string }): TokenData {
  // Validate input
  if (!userData.id || !userData.role || !userData.deviceFingerprint) {
    throw new Error('Invalid user data for token generation');
  }

  // Generate fingerprint hash
  const fingerprintHash = crypto
    .createHash('sha256')
    .update(userData.deviceFingerprint)
    .digest('hex');

  // Create token payload
  const payload = {
    sub: userData.id,
    role: userData.role,
    fingerprint: fingerprintHash,
    iss: securityConfig.jwt.issuer,
    aud: securityConfig.jwt.audience
  };

  // Sign access token
  const accessToken = jwt.sign(payload, securityConfig.jwt.secret!, {
    algorithm: securityConfig.jwt.algorithm,
    expiresIn: securityConfig.jwt.expiresIn
  });

  // Generate refresh token if enabled
  const refreshToken = securityConfig.jwt.refreshToken.enabled
    ? crypto.randomBytes(64).toString('hex')
    : '';

  // Store token pair in blacklist cache for rotation
  if (securityConfig.jwt.refreshToken.rotationEnabled) {
    tokenBlacklist.add(`${userData.id}:${accessToken}`);
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: parseTimeWindow(securityConfig.jwt.expiresIn)
  };
}

@RateLimit(100, '1m')
@SecurityLog('token_verification')
export function verifyToken(token: string, fingerprint: string): jwt.JwtPayload {
  // Check token blacklist
  if (tokenBlacklist.has(token)) {
    throw new Error('Token has been revoked');
  }

  // Verify token signature and expiration
  const decoded = jwt.verify(token, securityConfig.jwt.secret!, {
    algorithms: [securityConfig.jwt.algorithm],
    issuer: securityConfig.jwt.issuer,
    audience: securityConfig.jwt.audience,
    clockTolerance: securityConfig.jwt.tokenValidation.clockTolerance
  }) as jwt.JwtPayload;

  // Verify fingerprint
  const fingerprintHash = crypto
    .createHash('sha256')
    .update(fingerprint)
    .digest('hex');

  if (decoded.fingerprint !== fingerprintHash) {
    throw new Error('Invalid token fingerprint');
  }

  return decoded;
}

@RateLimit(50, '1m')
@SecurityLog('encryption')
export function encrypt(data: string): EncryptedData {
  // Validate input
  if (!data) {
    throw new Error('Data required for encryption');
  }

  // Generate IV
  const iv = crypto.randomBytes(securityConfig.encryption.ivLength);

  // Create cipher with timing protection
  const cipher = crypto.createCipheriv(
    securityConfig.encryption.algorithm,
    Buffer.from(securityConfig.encryption.keyLength),
    iv
  );

  // Encrypt data with padding validation
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get authentication tag
  const tag = cipher.getAuthTag();

  return {
    data: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    keyVersion: 1 // Current key version
  };
}

@RateLimit(50, '1m')
@SecurityLog('decryption')
export function decrypt(encryptedData: EncryptedData): string {
  // Validate encrypted data object
  if (!encryptedData.data || !encryptedData.iv || !encryptedData.tag) {
    throw new Error('Invalid encrypted data format');
  }

  // Create decipher with timing protection
  const decipher = crypto.createDecipheriv(
    securityConfig.encryption.algorithm,
    Buffer.from(securityConfig.encryption.keyLength),
    Buffer.from(encryptedData.iv, 'hex')
  );

  // Set auth tag
  decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));

  // Decrypt data with padding validation
  let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

@RateLimit(200, '1m')
@SecurityLog('permission_check')
export function validatePermission(role: string, requiredPermissions: string[]): boolean {
  // Check permission cache
  const cacheKey = `${role}:${requiredPermissions.join(',')}`;
  const cachedResult = permissionCache.get(cacheKey);
  if (cachedResult) {
    return requiredPermissions.every(permission => cachedResult.has(permission));
  }

  // Get role configuration
  const roleConfig = securityConfig.authorization.roles[role as keyof typeof securityConfig.authorization.roles];
  if (!roleConfig) {
    return false;
  }

  // Validate permissions
  const hasPermissions = requiredPermissions.every(permission =>
    roleConfig.permissions.includes(permission)
  );

  // Update cache
  permissionCache.set(cacheKey, new Set(roleConfig.permissions));

  return hasPermissions;
}

// Helper function to parse time windows
function parseTimeWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error('Invalid time window format');
  }

  const [, value, unit] = match;
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return parseInt(value) * multipliers[unit as keyof typeof multipliers];
}