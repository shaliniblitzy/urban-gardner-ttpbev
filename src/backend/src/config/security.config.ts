// @package-version dotenv@16.0.3
import { config } from 'dotenv';

// Load environment variables
config();

/**
 * Security configuration for the Garden Planner application
 * Includes settings for JWT authentication, encryption, and authorization
 */
export const securityConfig = {
  /**
   * JSON Web Token (JWT) configuration
   */
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '24h',
    algorithm: 'HS256',
    issuer: 'garden-planner-api',
    audience: 'garden-planner-client',
    tokenValidation: {
      validateIssuer: true,
      validateAudience: true,
      validateLifetime: true,
      clockTolerance: 30, // seconds
    },
    refreshToken: {
      enabled: true,
      expiresIn: '7d',
      rotationEnabled: true,
    },
  },

  /**
   * Data encryption configuration
   * Uses AES-256-GCM for secure data storage
   */
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    saltLength: 64,
    iterations: 100000,
    digest: 'sha512',
    keyDerivation: {
      algorithm: 'pbkdf2',
      minPasswordLength: 12,
    },
    performance: {
      maxEncryptionTimeMs: 100,
      maxDecryptionTimeMs: 100,
    },
  },

  /**
   * Authorization and access control configuration
   * Defines roles, permissions, and rate limiting
   */
  authorization: {
    roles: {
      user: {
        permissions: [
          'read:own_garden',
          'write:own_garden',
          'read:own_schedule',
          'write:own_schedule',
        ],
        maxGardens: 1,
        maxSchedules: 10,
      },
      premium: {
        permissions: [
          'read:own_garden',
          'write:own_garden',
          'read:own_schedule',
          'write:own_schedule',
          'use:advanced_features',
        ],
        maxGardens: 5,
        maxSchedules: 50,
      },
      admin: {
        permissions: [
          'read:all_gardens',
          'write:all_gardens',
          'read:all_schedules',
          'write:all_schedules',
          'manage:users',
          'manage:system',
        ],
        maxGardens: -1, // unlimited
        maxSchedules: -1, // unlimited
      },
    },
    rateLimit: {
      windowMs: 900000, // 15 minutes
      maxRequests: 100,
    },
    session: {
      maxConcurrentSessions: 3,
      inactivityTimeout: '30m',
    },
  },
} as const;

// Type definitions for better type safety and IDE support
export type SecurityConfig = typeof securityConfig;
export type JWTConfig = SecurityConfig['jwt'];
export type EncryptionConfig = SecurityConfig['encryption'];
export type AuthorizationConfig = SecurityConfig['authorization'];
export type UserRole = keyof SecurityConfig['authorization']['roles'];
export type Permission = SecurityConfig['authorization']['roles'][UserRole]['permissions'][number];