import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.4.0
import axiosRetry from 'axios-retry'; // ^3.5.0
import rateLimit from 'axios-rate-limit'; // ^1.3.0

// Environment variables and constants
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const MAX_RETRIES = 3;
const REQUEST_TIMEOUT = 30000;
const RATE_LIMIT = { maxRequests: 50, perMilliseconds: 1000 };

// Type definitions
export interface RequestConfig extends AxiosRequestConfig {
  skipRetry?: boolean;
  skipRateLimit?: boolean;
  cacheResponse?: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  retryAttempt?: number;
  timestamp: string;
  requestId: string;
  recoverySteps?: string[];
}

export interface PerformanceMetrics {
  requestDuration: number;
  retryCount: number;
  timestamp: string;
}

/**
 * Singleton API service for handling all HTTP communications
 * with comprehensive error handling and monitoring
 */
class ApiService {
  private static instance: ApiService;
  private axiosInstance: AxiosInstance;
  private activeRequests: Map<string, AbortController>;

  private constructor() {
    this.activeRequests = new Map();
    this.axiosInstance = this.createAxiosInstance();
  }

  /**
   * Creates and configures an Axios instance with security, monitoring,
   * and error handling features
   */
  private createAxiosInstance(): AxiosInstance {
    // Create base instance
    const instance = axios.create({
      baseURL: API_BASE_URL,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    // Configure retry mechanism
    axiosRetry(instance, {
      retries: MAX_RETRIES,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) &&
          !error.config?.skipRetry;
      }
    });

    // Apply rate limiting
    const rateLimitedInstance = rateLimit(instance, RATE_LIMIT);

    // Request interceptor
    rateLimitedInstance.interceptors.request.use(
      (config) => {
        const requestId = this.generateRequestId();
        config.headers['X-Request-ID'] = requestId;
        
        // Add request cancellation token
        const controller = new AbortController();
        this.activeRequests.set(requestId, controller);
        config.signal = controller.signal;

        // Add performance monitoring
        config.metadata = { startTime: Date.now() };

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    rateLimitedInstance.interceptors.response.use(
      (response) => {
        this.logRequestMetrics(response);
        this.cleanupRequest(response.config);
        return response;
      },
      (error) => {
        this.cleanupRequest(error.config);
        return Promise.reject(this.handleError(error));
      }
    );

    return rateLimitedInstance;
  }

  /**
   * Performs type-safe GET request with error handling and response validation
   */
  public async get<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    try {
      const response = await this.axiosInstance.get<T>(endpoint, config);
      return this.validateResponse<T>(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Performs type-safe POST request with request validation and response transformation
   */
  public async post<T, R>(endpoint: string, data: T, config: RequestConfig = {}): Promise<R> {
    try {
      const response = await this.axiosInstance.post<R>(endpoint, data, {
        ...config,
        headers: {
          ...config.headers,
          'X-CSRF-Token': this.getCsrfToken()
        }
      });
      return this.validateResponse<R>(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Performs type-safe PUT request
   */
  public async put<T, R>(endpoint: string, data: T, config: RequestConfig = {}): Promise<R> {
    try {
      const response = await this.axiosInstance.put<R>(endpoint, data, {
        ...config,
        headers: {
          ...config.headers,
          'X-CSRF-Token': this.getCsrfToken()
        }
      });
      return this.validateResponse<R>(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Performs type-safe DELETE request
   */
  public async delete<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    try {
      const response = await this.axiosInstance.delete<T>(endpoint, {
        ...config,
        headers: {
          ...config.headers,
          'X-CSRF-Token': this.getCsrfToken()
        }
      });
      return this.validateResponse<T>(response);
    } catch (error) {
      throw this.handleError(error as AxiosError);
    }
  }

  /**
   * Comprehensive error handler that processes API errors into standardized format
   */
  public handleError(error: AxiosError): ApiError {
    const requestId = error.config?.headers?.['X-Request-ID'] as string;
    const timestamp = new Date().toISOString();

    const apiError: ApiError = {
      code: 'API_ERROR',
      message: 'An error occurred while processing your request',
      context: {},
      timestamp,
      requestId,
      recoverySteps: []
    };

    if (error.response) {
      // Server responded with error
      apiError.code = `SERVER_ERROR_${error.response.status}`;
      apiError.message = error.response.data?.message || error.message;
      apiError.context = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
    } else if (error.request) {
      // Request made but no response received
      apiError.code = 'NETWORK_ERROR';
      apiError.message = 'No response received from server';
      apiError.recoverySteps = [
        'Check your internet connection',
        'Try again in a few moments'
      ];
    } else {
      // Error in request configuration
      apiError.code = 'REQUEST_ERROR';
      apiError.message = error.message;
    }

    // Add retry attempt information if available
    if (error.config?.metadata?.retryCount) {
      apiError.retryAttempt = error.config.metadata.retryCount;
    }

    // Log error for monitoring
    this.logError(apiError);

    return apiError;
  }

  /**
   * Validates and transforms API response
   */
  private validateResponse<T>(response: AxiosResponse<T>): T {
    // Add validation logic here if needed
    return response.data;
  }

  /**
   * Generates unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Retrieves CSRF token for mutation requests
   */
  private getCsrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  }

  /**
   * Logs request performance metrics
   */
  private logRequestMetrics(response: AxiosResponse): void {
    const metrics: PerformanceMetrics = {
      requestDuration: Date.now() - (response.config.metadata?.startTime || 0),
      retryCount: response.config.metadata?.retryCount || 0,
      timestamp: new Date().toISOString()
    };
    // Add logging implementation here
    console.debug('Request metrics:', metrics);
  }

  /**
   * Logs API errors for monitoring
   */
  private logError(error: ApiError): void {
    // Add error logging implementation here
    console.error('API Error:', error);
  }

  /**
   * Cleans up request resources
   */
  private cleanupRequest(config: AxiosRequestConfig): void {
    const requestId = config.headers?.['X-Request-ID'] as string;
    if (requestId) {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Gets singleton instance of ApiService
   */
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }
}

// Export singleton instance
export const apiService = ApiService.getInstance();