//
// DatabaseMigrationManager.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation
import SQLite // v0.14.1

/// Manages database schema migrations and version control for the Garden Planner SQLite database
public class DatabaseMigrationManager {
    
    // MARK: - Constants
    
    private let SCHEMA_VERSION_KEY = "schema_version"
    private let CURRENT_SCHEMA_VERSION = DatabaseConstants.version
    private let MIGRATION_BACKUP_PREFIX = "migration_backup_"
    
    // MARK: - Properties
    
    private let database: Connection
    private var currentVersion: Int
    private let migrationLogger = Logger(subsystem: "com.gardenplanner.database", category: "migrations")
    
    /// Progress tracking for migrations
    public struct MigrationProgress {
        var totalSteps: Int
        var currentStep: Int
        var description: String
    }
    
    private var migrationProgress: MigrationProgress?
    
    // MARK: - Error Types
    
    public enum MigrationError: Error {
        case invalidVersion
        case migrationFailed(String)
        case backupFailed(String)
        case restoreFailed(String)
        case transactionFailed
        case schemaValidationFailed
    }
    
    // MARK: - Initialization
    
    /// Initializes the migration manager with a database connection
    /// - Parameter database: SQLite database connection
    public init(database: Connection) throws {
        self.database = database
        
        // Create version tracking table if not exists
        try database.run("""
            CREATE TABLE IF NOT EXISTS schema_versions (
                version INTEGER PRIMARY KEY,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                description TEXT
            )
        """)
        
        // Get current version
        if let version = try getCurrentVersion() {
            self.currentVersion = version
        } else {
            // Initialize version if not set
            try setVersion(0)
            self.currentVersion = 0
        }
        
        migrationLogger.info("Database migration manager initialized with version \(currentVersion)")
    }
    
    // MARK: - Public Methods
    
    /// Retrieves the current database schema version
    /// - Returns: Current version number or nil if not set
    public func getCurrentVersion() throws -> Int? {
        do {
            let query = "SELECT MAX(version) as version FROM schema_versions"
            let result = try database.prepare(query)
            
            if let row = try result.next() {
                return row[0] as? Int
            }
            return nil
        } catch {
            migrationLogger.error("Failed to get current version: \(error.localizedDescription)")
            throw MigrationError.invalidVersion
        }
    }
    
    /// Updates the database schema version
    /// - Parameter version: New version number
    private func setVersion(_ version: Int) throws {
        do {
            try database.transaction {
                try database.run("""
                    INSERT INTO schema_versions (version, description)
                    VALUES (?, ?)
                """, version, "Schema version \(version)")
                
                self.currentVersion = version
                migrationLogger.info("Updated schema version to \(version)")
            }
        } catch {
            migrationLogger.error("Failed to set version: \(error.localizedDescription)")
            throw MigrationError.transactionFailed
        }
    }
    
    /// Executes pending database migrations
    /// - Returns: Success status with error details if failed
    public func migrate() throws -> Bool {
        guard let backupPath = try createBackup() else {
            throw MigrationError.backupFailed("Failed to create backup before migration")
        }
        
        migrationLogger.info("Starting database migration from version \(currentVersion)")
        
        do {
            try database.transaction {
                // Apply migrations sequentially
                for version in (currentVersion + 1)...CURRENT_SCHEMA_VERSION {
                    try applyMigration(version)
                }
                
                // Verify final schema
                try validateSchema()
                
                migrationLogger.info("Migration completed successfully")
            }
            return true
            
        } catch {
            migrationLogger.error("Migration failed: \(error.localizedDescription)")
            
            // Attempt to restore from backup
            try restoreFromBackup(backupPath)
            
            throw MigrationError.migrationFailed(error.localizedDescription)
        }
    }
    
    // MARK: - Private Methods
    
    /// Creates a backup of the database before migration
    private func createBackup() throws -> String? {
        let backupName = "\(MIGRATION_BACKUP_PREFIX)\(Date().timeIntervalSince1970)"
        let fileManager = FileManager.default
        
        guard let dbPath = database.filename,
              let backupPath = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
                .appendingPathComponent(backupName).path else {
            throw MigrationError.backupFailed("Could not determine backup path")
        }
        
        do {
            try fileManager.copyItem(atPath: dbPath, toPath: backupPath)
            migrationLogger.info("Created database backup at \(backupPath)")
            return backupPath
        } catch {
            throw MigrationError.backupFailed(error.localizedDescription)
        }
    }
    
    /// Restores database from backup after failed migration
    private func restoreFromBackup(_ backupPath: String) throws {
        guard let dbPath = database.filename else {
            throw MigrationError.restoreFailed("Could not determine database path")
        }
        
        let fileManager = FileManager.default
        
        do {
            // Close database connection
            try database.close()
            
            // Restore from backup
            try fileManager.removeItem(atPath: dbPath)
            try fileManager.copyItem(atPath: backupPath, toPath: dbPath)
            
            migrationLogger.info("Successfully restored database from backup")
        } catch {
            throw MigrationError.restoreFailed(error.localizedDescription)
        }
    }
    
    /// Applies a specific version migration
    private func applyMigration(_ version: Int) throws {
        migrationProgress = MigrationProgress(totalSteps: CURRENT_SCHEMA_VERSION - currentVersion,
                                           currentStep: version - currentVersion,
                                           description: "Applying version \(version) migration")
        
        switch version {
        case 1:
            try createInitialSchema()
        case 2:
            try addScheduleRecurringFields()
        case 3:
            try addPlantYieldTracking()
        default:
            throw MigrationError.invalidVersion
        }
        
        try setVersion(version)
    }
    
    /// Creates initial database schema
    private func createInitialSchema() throws {
        try database.run("""
            CREATE TABLE gardens (
                id TEXT PRIMARY KEY,
                area REAL NOT NULL,
                sunlight TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        try database.run("""
            CREATE TABLE zones (
                id TEXT PRIMARY KEY,
                garden_id TEXT NOT NULL,
                area REAL NOT NULL,
                sunlight_condition TEXT NOT NULL,
                FOREIGN KEY(garden_id) REFERENCES gardens(id) ON DELETE CASCADE
            )
        """)
        
        try database.run("""
            CREATE TABLE plants (
                id TEXT PRIMARY KEY,
                zone_id TEXT NOT NULL,
                type TEXT NOT NULL,
                growth_stage TEXT NOT NULL,
                spacing REAL NOT NULL,
                planted_date DATETIME NOT NULL,
                FOREIGN KEY(zone_id) REFERENCES zones(id) ON DELETE CASCADE
            )
        """)
        
        try database.run("""
            CREATE TABLE schedules (
                id TEXT PRIMARY KEY,
                plant_id TEXT NOT NULL,
                task_type TEXT NOT NULL,
                due_date DATETIME NOT NULL,
                is_completed BOOLEAN DEFAULT 0,
                completed_date DATETIME,
                FOREIGN KEY(plant_id) REFERENCES plants(id) ON DELETE CASCADE
            )
        """)
    }
    
    /// Adds recurring schedule fields
    private func addScheduleRecurringFields() throws {
        try database.run("""
            ALTER TABLE schedules
            ADD COLUMN is_recurring BOOLEAN DEFAULT 0
        """)
        
        try database.run("""
            ALTER TABLE schedules
            ADD COLUMN recurring_frequency_days INTEGER DEFAULT 0
        """)
    }
    
    /// Adds plant yield tracking
    private func addPlantYieldTracking() throws {
        try database.run("""
            ALTER TABLE plants
            ADD COLUMN expected_yield_kg REAL DEFAULT 0
        """)
        
        try database.run("""
            CREATE TABLE yield_records (
                id TEXT PRIMARY KEY,
                plant_id TEXT NOT NULL,
                harvest_date DATETIME NOT NULL,
                yield_amount_kg REAL NOT NULL,
                FOREIGN KEY(plant_id) REFERENCES plants(id) ON DELETE CASCADE
            )
        """)
    }
    
    /// Validates final schema structure
    private func validateSchema() throws {
        let requiredTables = ["gardens", "zones", "plants", "schedules", "schema_versions"]
        
        for table in requiredTables {
            let query = "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
            let exists = try database.scalar(query, table) as? String != nil
            
            if !exists {
                throw MigrationError.schemaValidationFailed
            }
        }
    }
}