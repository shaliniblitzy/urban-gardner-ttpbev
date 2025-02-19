import { MMKV } from 'react-native-mmkv';
import CryptoJS from 'crypto-js';
import { GARDEN_VALIDATION } from '../constants/garden';

/**
 * Storage key constants for different data categories
 * @version 1.0.0
 */
export const STORAGE_KEYS = {
    GARDEN_DATA: 'garden_data',
    USER_PREFERENCES: 'user_preferences',
    SCHEDULE_DATA: 'schedule_data',
    PLANT_DATABASE: 'plant_database',
    SYSTEM_CONFIG: 'system_config'
} as const;

// Storage configuration constants
const STORAGE_VERSION = '1.0';
const MAX_STORAGE_SIZE = 500 * 1024 * 1024; // 500MB
const ENCRYPTION_KEY = process.env.STORAGE_ENCRYPTION_KEY || 'default-dev-key';

// Initialize MMKV storage instance
const storage = new MMKV({
    id: 'garden-planner-storage',
    encryptionKey: ENCRYPTION_KEY
});

/**
 * Interface for storage metadata
 */
interface StorageMetadata {
    version: string;
    timestamp: number;
    size: number;
    encrypted: boolean;
}

/**
 * Interface for storage options
 */
interface StorageOptions {
    compress?: boolean;
    expiry?: number;
}

/**
 * Interface for storage information
 */
interface StorageInfo {
    usedSpace: number;
    availableSpace: number;
    itemCount: number;
    version: string;
    health: {
        integrity: boolean;
        lastCheck: number;
    };
    quotaUsage: {
        [key in keyof typeof STORAGE_KEYS]: number;
    };
}

/**
 * Encrypts data using AES-256
 * @param data - Data to encrypt
 * @returns Encrypted string
 */
const encryptData = (data: any): string => {
    const jsonStr = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonStr, ENCRYPTION_KEY).toString();
};

/**
 * Decrypts AES-256 encrypted data
 * @param encryptedData - Encrypted string
 * @returns Decrypted data
 */
const decryptData = (encryptedData: string): any => {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedStr);
};

/**
 * Validates storage quota
 * @param newDataSize - Size of new data to store
 * @throws Error if quota would be exceeded
 */
const validateQuota = async (newDataSize: number): Promise<void> => {
    const info = await getStorageInfo();
    if (info.usedSpace + newDataSize > MAX_STORAGE_SIZE) {
        throw new Error('Storage quota would be exceeded');
    }
};

/**
 * Stores data in local storage with encryption support
 * @param key - Storage key
 * @param value - Data to store
 * @param encrypt - Whether to encrypt the data
 * @param options - Storage options
 */
export const setItem = async (
    key: keyof typeof STORAGE_KEYS,
    value: any,
    encrypt: boolean = true,
    options: StorageOptions = {}
): Promise<void> => {
    try {
        // Validate key
        if (!Object.keys(STORAGE_KEYS).includes(key)) {
            throw new Error('Invalid storage key');
        }

        // Prepare data with metadata
        const metadata: StorageMetadata = {
            version: STORAGE_VERSION,
            timestamp: Date.now(),
            size: 0,
            encrypted: encrypt
        };

        // Process and validate data
        let processedData = value;
        if (encrypt) {
            processedData = encryptData(value);
        }

        const dataWithMetadata = {
            metadata,
            data: processedData
        };

        // Calculate size and validate quota
        const dataSize = new TextEncoder().encode(JSON.stringify(dataWithMetadata)).length;
        await validateQuota(dataSize);

        // Update metadata with final size
        dataWithMetadata.metadata.size = dataSize;

        // Store data
        storage.set(STORAGE_KEYS[key], JSON.stringify(dataWithMetadata));

    } catch (error) {
        throw new Error(`Storage error: ${error.message}`);
    }
};

/**
 * Retrieves data from storage with optional decryption
 * @param key - Storage key
 * @param decrypt - Whether to decrypt the data
 * @param options - Retrieval options
 * @returns Retrieved data or null if not found
 */
export const getItem = async (
    key: keyof typeof STORAGE_KEYS,
    decrypt: boolean = true,
    options: StorageOptions = {}
): Promise<any> => {
    try {
        const rawData = storage.getString(STORAGE_KEYS[key]);
        if (!rawData) return null;

        const { metadata, data } = JSON.parse(rawData);

        // Validate version compatibility
        if (metadata.version !== STORAGE_VERSION) {
            throw new Error('Storage version mismatch');
        }

        // Return decrypted data if needed
        if (metadata.encrypted && decrypt) {
            return decryptData(data);
        }

        return data;
    } catch (error) {
        throw new Error(`Retrieval error: ${error.message}`);
    }
};

/**
 * Removes item from storage
 * @param key - Storage key to remove
 */
export const removeItem = async (key: keyof typeof STORAGE_KEYS): Promise<void> => {
    try {
        storage.delete(STORAGE_KEYS[key]);
    } catch (error) {
        throw new Error(`Removal error: ${error.message}`);
    }
};

/**
 * Clears all user data while preserving system configuration
 */
export const clearStorage = async (): Promise<void> => {
    try {
        // Backup system configuration
        const sysConfig = await getItem(STORAGE_KEYS.SYSTEM_CONFIG, true);

        // Clear all keys except system configuration
        Object.keys(STORAGE_KEYS).forEach(key => {
            if (key !== 'SYSTEM_CONFIG') {
                storage.delete(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS]);
            }
        });

        // Restore system configuration
        if (sysConfig) {
            await setItem(STORAGE_KEYS.SYSTEM_CONFIG, sysConfig, true);
        }
    } catch (error) {
        throw new Error(`Clear storage error: ${error.message}`);
    }
};

/**
 * Retrieves storage usage statistics and health information
 * @returns Storage information object
 */
export const getStorageInfo = async (): Promise<StorageInfo> => {
    try {
        const itemCount = storage.getAllKeys().length;
        let usedSpace = 0;
        const quotaUsage: { [key: string]: number } = {};

        // Calculate space usage per category
        for (const key of Object.values(STORAGE_KEYS)) {
            const rawData = storage.getString(key);
            if (rawData) {
                const size = new TextEncoder().encode(rawData).length;
                usedSpace += size;
                quotaUsage[key] = size;
            } else {
                quotaUsage[key] = 0;
            }
        }

        return {
            usedSpace,
            availableSpace: MAX_STORAGE_SIZE - usedSpace,
            itemCount,
            version: STORAGE_VERSION,
            health: {
                integrity: true,
                lastCheck: Date.now()
            },
            quotaUsage: quotaUsage as { [key in keyof typeof STORAGE_KEYS]: number }
        };
    } catch (error) {
        throw new Error(`Storage info error: ${error.message}`);
    }
};