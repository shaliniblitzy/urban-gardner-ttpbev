import { MMKV } from 'react-native-mmkv'; // v2.8
import CryptoJS from 'crypto-js'; // v4.1.1
import { setItem, getItem, STORAGE_KEYS } from '../utils/storage.utils';
import { Zone, ZoneOptimizationResult } from '../types/zone.types';
import { GARDEN_VALIDATION } from '../constants/garden';

/**
 * Interface for garden data structure
 */
interface Garden {
    id: string;
    zones: Zone[];
    lastModified: number;
    version: string;
}

/**
 * Service class for managing secure local storage operations
 * Implements encrypted data persistence, quota management, and versioning
 */
export class StorageService {
    private storage: MMKV;
    private readonly maxStorageSize: number = 500 * 1024 * 1024; // 500MB
    private readonly currentVersion: string = '1.0';
    private readonly keyRotationInterval: number = 30 * 24 * 60 * 60 * 1000; // 30 days

    constructor() {
        this.storage = new MMKV({
            id: 'garden-planner-storage',
            encryptionKey: process.env.STORAGE_ENCRYPTION_KEY
        });
        this.initializeStorage();
    }

    /**
     * Initializes storage with necessary configurations
     */
    private async initializeStorage(): Promise<void> {
        try {
            const version = await getItem(STORAGE_KEYS.STORAGE_VERSION, false);
            if (!version) {
                await setItem(STORAGE_KEYS.STORAGE_VERSION, this.currentVersion, false);
            }
            await this.checkKeyRotation();
        } catch (error) {
            throw new Error(`Storage initialization failed: ${error.message}`);
        }
    }

    /**
     * Saves garden data with encryption and version control
     * @param garden Garden data to save
     */
    public async saveGardenData(garden: Garden): Promise<void> {
        try {
            // Validate garden structure
            this.validateGardenData(garden);

            // Check storage quota
            const dataSize = new TextEncoder().encode(JSON.stringify(garden)).length;
            await this.checkStorageQuota(dataSize);

            // Add metadata and save
            const dataWithMetadata = {
                data: garden,
                timestamp: Date.now(),
                version: this.currentVersion
            };

            await setItem(STORAGE_KEYS.GARDEN_DATA, dataWithMetadata, true);
        } catch (error) {
            throw new Error(`Failed to save garden data: ${error.message}`);
        }
    }

    /**
     * Retrieves and migrates garden data if needed
     * @returns Garden data or null if not found
     */
    public async getGardenData(): Promise<Garden | null> {
        try {
            const storedData = await getItem(STORAGE_KEYS.GARDEN_DATA, true);
            if (!storedData) return null;

            // Check version and migrate if needed
            if (storedData.version !== this.currentVersion) {
                const migratedData = await this.migrateStorageData(
                    storedData.version,
                    this.currentVersion,
                    storedData.data
                );
                return migratedData;
            }

            return storedData.data;
        } catch (error) {
            throw new Error(`Failed to retrieve garden data: ${error.message}`);
        }
    }

    /**
     * Handles data migration between storage versions
     * @param currentVersion Current data version
     * @param targetVersion Target version to migrate to
     * @param data Data to migrate
     */
    public async migrateStorageData(
        currentVersion: string,
        targetVersion: string,
        data: any
    ): Promise<any> {
        try {
            let migratedData = { ...data };

            // Version-specific migrations
            switch (currentVersion) {
                case '1.0':
                    // Current version, no migration needed
                    break;
                default:
                    throw new Error(`Unsupported version: ${currentVersion}`);
            }

            // Validate migrated data
            this.validateGardenData(migratedData);

            // Update version and save
            migratedData.version = targetVersion;
            await this.saveGardenData(migratedData);

            return migratedData;
        } catch (error) {
            throw new Error(`Migration failed: ${error.message}`);
        }
    }

    /**
     * Handles periodic rotation of encryption keys
     */
    public async rotateEncryptionKey(): Promise<void> {
        try {
            const lastRotation = await getItem(STORAGE_KEYS.SYSTEM_CONFIG, true);
            const shouldRotate = !lastRotation?.lastKeyRotation ||
                Date.now() - lastRotation.lastKeyRotation > this.keyRotationInterval;

            if (shouldRotate) {
                // Generate new key
                const newKey = CryptoJS.lib.WordArray.random(256 / 8).toString();

                // Re-encrypt all data with new key
                const gardenData = await this.getGardenData();
                const preferences = await getItem(STORAGE_KEYS.USER_PREFERENCES, true);
                const schedules = await getItem(STORAGE_KEYS.SCHEDULE_DATA, true);

                // Update storage configuration
                this.storage = new MMKV({
                    id: 'garden-planner-storage',
                    encryptionKey: newKey
                });

                // Re-save data with new encryption
                if (gardenData) await this.saveGardenData(gardenData);
                if (preferences) await setItem(STORAGE_KEYS.USER_PREFERENCES, preferences, true);
                if (schedules) await setItem(STORAGE_KEYS.SCHEDULE_DATA, schedules, true);

                // Update rotation timestamp
                await setItem(STORAGE_KEYS.SYSTEM_CONFIG, {
                    lastKeyRotation: Date.now()
                }, true);
            }
        } catch (error) {
            throw new Error(`Key rotation failed: ${error.message}`);
        }
    }

    /**
     * Manages storage cleanup and optimization
     */
    public async cleanupStorage(): Promise<void> {
        try {
            const usedSpace = await this.calculateStorageUsage();
            const threshold = this.maxStorageSize * 0.9; // 90% threshold

            if (usedSpace > threshold) {
                // Remove old schedules
                const schedules = await getItem(STORAGE_KEYS.SCHEDULE_DATA, true);
                if (schedules) {
                    const filteredSchedules = schedules.filter(
                        (schedule: any) => schedule.date > Date.now() - (90 * 24 * 60 * 60 * 1000)
                    );
                    await setItem(STORAGE_KEYS.SCHEDULE_DATA, filteredSchedules, true);
                }

                // Compact storage if supported
                if (typeof this.storage.clearAll === 'function') {
                    const tempData = {
                        garden: await this.getGardenData(),
                        preferences: await getItem(STORAGE_KEYS.USER_PREFERENCES, true),
                        schedules: await getItem(STORAGE_KEYS.SCHEDULE_DATA, true)
                    };

                    this.storage.clearAll();

                    // Restore data
                    if (tempData.garden) await this.saveGardenData(tempData.garden);
                    if (tempData.preferences) await setItem(STORAGE_KEYS.USER_PREFERENCES, tempData.preferences, true);
                    if (tempData.schedules) await setItem(STORAGE_KEYS.SCHEDULE_DATA, tempData.schedules, true);
                }
            }
        } catch (error) {
            throw new Error(`Storage cleanup failed: ${error.message}`);
        }
    }

    /**
     * Validates garden data structure and constraints
     * @param garden Garden data to validate
     */
    private validateGardenData(garden: Garden): void {
        if (!garden.id || !garden.zones || !Array.isArray(garden.zones)) {
            throw new Error('Invalid garden data structure');
        }

        // Validate zones
        let totalArea = 0;
        garden.zones.forEach(zone => {
            if (zone.area < GARDEN_VALIDATION.AREA_LIMITS.MIN ||
                zone.area > GARDEN_VALIDATION.AREA_LIMITS.MAX) {
                throw new Error(`Zone area outside valid range: ${zone.area}`);
            }
            totalArea += zone.area;
        });

        if (totalArea > GARDEN_VALIDATION.AREA_LIMITS.MAX) {
            throw new Error(`Total garden area exceeds maximum: ${totalArea}`);
        }
    }

    /**
     * Checks and manages storage quota
     * @param newDataSize Size of new data to store
     */
    private async checkStorageQuota(newDataSize: number): Promise<void> {
        const currentUsage = await this.calculateStorageUsage();
        if (currentUsage + newDataSize > this.maxStorageSize) {
            await this.cleanupStorage();
            const updatedUsage = await this.calculateStorageUsage();
            if (updatedUsage + newDataSize > this.maxStorageSize) {
                throw new Error('Storage quota exceeded');
            }
        }
    }

    /**
     * Calculates current storage usage
     * @returns Total storage usage in bytes
     */
    private async calculateStorageUsage(): Promise<number> {
        let totalSize = 0;
        const keys = this.storage.getAllKeys();
        
        for (const key of keys) {
            const value = this.storage.getString(key);
            if (value) {
                totalSize += new TextEncoder().encode(value).length;
            }
        }
        
        return totalSize;
    }

    /**
     * Checks if encryption key rotation is needed
     */
    private async checkKeyRotation(): Promise<void> {
        const config = await getItem(STORAGE_KEYS.SYSTEM_CONFIG, true);
        if (!config?.lastKeyRotation ||
            Date.now() - config.lastKeyRotation > this.keyRotationInterval) {
            await this.rotateEncryptionKey();
        }
    }
}