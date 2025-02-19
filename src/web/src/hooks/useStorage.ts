import { useState, useCallback, useEffect } from 'react';
import { 
    setItem, 
    getItem, 
    removeItem, 
    STORAGE_KEYS,
    validateQuota as validateStorageQuota,
    getStorageInfo
} from '../utils/storage.utils';

/**
 * Storage hook options interface
 * @version 1.0.0
 */
interface StorageOptions {
    /** Enable data compression */
    compress?: boolean;
    /** Data expiration in milliseconds */
    expiry?: number;
    /** Automatic retry configuration */
    retry?: {
        attempts: number;
        delay: number;
    };
    /** Version migration handler */
    migrationHandler?: (oldData: any, oldVersion: string) => Promise<any>;
}

/**
 * Storage operation result interface
 */
interface StorageOperationResult<T> {
    /** Stored/retrieved data */
    data: T | null;
    /** Error message if operation failed */
    error: Error | null;
    /** Loading state indicator */
    isLoading: boolean;
    /** Last update timestamp */
    lastUpdate: number | null;
    /** Storage quota information */
    quotaInfo: {
        used: number;
        available: number;
        percentage: number;
    };
    /** Set data with encryption */
    setData: (newData: T) => Promise<void>;
    /** Remove data */
    removeData: () => Promise<void>;
    /** Clear expired data */
    clearExpired: () => Promise<void>;
    /** Batch update operation */
    batchUpdate: (updateFn: (currentData: T | null) => T) => Promise<void>;
}

/**
 * Custom hook for managing encrypted local storage operations
 * Implements secure storage with quota management and data versioning
 * 
 * @param key - Storage key from STORAGE_KEYS
 * @param encrypt - Enable encryption (default: true)
 * @param options - Additional storage options
 * @returns Storage operations and state
 * 
 * @example
 * const { data, setData, error } = useStorage(STORAGE_KEYS.GARDEN_DATA, true, {
 *   compress: true,
 *   expiry: 24 * 60 * 60 * 1000 // 24 hours
 * });
 */
export default function useStorage<T>(
    key: keyof typeof STORAGE_KEYS,
    encrypt: boolean = true,
    options: StorageOptions = {}
): StorageOperationResult<T> {
    // State management
    const [data, setDataState] = useState<T | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [lastUpdate, setLastUpdate] = useState<number | null>(null);
    const [quotaInfo, setQuotaInfo] = useState<StorageOperationResult<T>['quotaInfo']>({
        used: 0,
        available: 0,
        percentage: 0
    });

    /**
     * Updates quota information
     */
    const updateQuotaInfo = useCallback(async () => {
        try {
            const info = await getStorageInfo();
            setQuotaInfo({
                used: info.usedSpace,
                available: info.availableSpace,
                percentage: (info.usedSpace / (info.usedSpace + info.availableSpace)) * 100
            });
        } catch (err) {
            setError(new Error(`Failed to update quota info: ${err.message}`));
        }
    }, []);

    /**
     * Sets data with encryption and quota validation
     */
    const setData = useCallback(async (newData: T) => {
        setIsLoading(true);
        setError(null);
        try {
            await setItem(key, newData, encrypt, {
                compress: options.compress
            });
            setDataState(newData);
            setLastUpdate(Date.now());
            await updateQuotaInfo();
        } catch (err) {
            setError(new Error(`Failed to set data: ${err.message}`));
        } finally {
            setIsLoading(false);
        }
    }, [key, encrypt, options.compress, updateQuotaInfo]);

    /**
     * Removes data and updates quota
     */
    const removeData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await removeItem(key);
            setDataState(null);
            setLastUpdate(null);
            await updateQuotaInfo();
        } catch (err) {
            setError(new Error(`Failed to remove data: ${err.message}`));
        } finally {
            setIsLoading(false);
        }
    }, [key, updateQuotaInfo]);

    /**
     * Clears expired data if expiry is set
     */
    const clearExpired = useCallback(async () => {
        if (!options.expiry || !lastUpdate) return;
        
        const isExpired = Date.now() - lastUpdate > options.expiry;
        if (isExpired) {
            await removeData();
        }
    }, [options.expiry, lastUpdate, removeData]);

    /**
     * Performs batch update operation
     */
    const batchUpdate = useCallback(async (updateFn: (currentData: T | null) => T) => {
        setIsLoading(true);
        setError(null);
        try {
            const newData = updateFn(data);
            await setData(newData);
        } catch (err) {
            setError(new Error(`Failed to perform batch update: ${err.message}`));
        } finally {
            setIsLoading(false);
        }
    }, [data, setData]);

    /**
     * Loads initial data and sets up storage event listeners
     */
    useEffect(() => {
        let mounted = true;
        let retryCount = 0;
        const maxRetries = options.retry?.attempts ?? 3;
        const retryDelay = options.retry?.delay ?? 1000;

        const loadData = async () => {
            try {
                const storedData = await getItem(key, encrypt);
                if (mounted) {
                    setDataState(storedData);
                    setLastUpdate(storedData ? Date.now() : null);
                    await updateQuotaInfo();
                }
            } catch (err) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    setTimeout(loadData, retryDelay);
                } else {
                    if (mounted) {
                        setError(new Error(`Failed to load data: ${err.message}`));
                    }
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        loadData();

        // Handle storage events for multi-tab support
        const handleStorageChange = async (e: StorageEvent) => {
            if (e.key === STORAGE_KEYS[key]) {
                await loadData();
            }
        };

        window.addEventListener('storage', handleStorageChange);

        return () => {
            mounted = false;
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [key, encrypt, options.retry?.attempts, options.retry?.delay, updateQuotaInfo]);

    // Clear expired data on mount and when lastUpdate changes
    useEffect(() => {
        clearExpired();
    }, [clearExpired]);

    return {
        data,
        error,
        isLoading,
        lastUpdate,
        quotaInfo,
        setData,
        removeData,
        clearExpired,
        batchUpdate
    };
}