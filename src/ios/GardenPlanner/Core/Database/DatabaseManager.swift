//
// DatabaseManager.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+
import SQLite // v0.14.1

/// Thread-safe singleton class managing SQLite database operations with connection pooling,
/// automated backups, and comprehensive error handling
@objc public class DatabaseManager: NSObject {
    
    // MARK: - Constants
    
    private let DATABASE_NAME = DatabaseConstants.fileName
    private let DATABASE_VERSION = DatabaseConstants.version
    private let MAX_CONNECTIONS = 5
    private let BACKUP_INTERVAL: TimeInterval = DatabaseConstants.backupInterval
    
    // MARK: - Error Types
    
    public enum DatabaseError: Error {
        case connectionFailed(String)
        case queryFailed(String)
        case transactionFailed(String)
        case backupFailed(String)
        case poolExhausted
        case invalidOperation
    }
    
    // MARK: - Properties
    
    /// Thread-safe singleton instance
    @objc public static let shared = DatabaseManager()
    
    private var connectionPool: [Connection] = []
    private let connectionQueue = DispatchQueue(label: "com.gardenplanner.database.connections")
    private let databaseQueue = DispatchQueue(label: "com.gardenplanner.database.operations", attributes: .concurrent)
    private let migrationManager: DatabaseMigrationManager
    private var backupTimer: Timer?
    private let backupDirectory: URL
    private var availableConnections: Int
    
    // MARK: - Initialization
    
    private override init() {
        // Setup backup directory
        let fileManager = FileManager.default
        backupDirectory = try! fileManager.url(for: .applicationSupportDirectory,
                                             in: .userDomainMask,
                                             appropriateFor: nil,
                                             create: true)
            .appendingPathComponent("DatabaseBackups", isDirectory: true)
        
        availableConnections = MAX_CONNECTIONS
        
        // Ensure backup directory exists
        if !fileManager.fileExists(atPath: backupDirectory.path) {
            try! fileManager.createDirectory(at: backupDirectory,
                                          withIntermediateDirectories: true,
                                          attributes: nil)
        }
        
        // Initialize database path
        let databaseURL = try! fileManager.url(for: .applicationSupportDirectory,
                                             in: .userDomainMask,
                                             appropriateFor: nil,
                                             create: true)
            .appendingPathComponent(DATABASE_NAME)
        
        super.init()
        
        // Initialize connection pool
        for _ in 0..<MAX_CONNECTIONS {
            do {
                let connection = try Connection(databaseURL.path)
                connection.busyTimeout = 5.0 // 5 second timeout
                connection.busyHandler = { tries in
                    return tries < 3 // Retry 3 times
                }
                connectionPool.append(connection)
            } catch {
                fatalError("Failed to initialize database connection: \(error)")
            }
        }
        
        // Initialize migration manager with first connection
        migrationManager = try! DatabaseMigrationManager(database: connectionPool[0])
        
        // Run initial migration if needed
        try! runMigrations()
        
        // Setup automated backup timer
        setupBackupTimer()
    }
    
    // MARK: - Connection Pool Management
    
    /// Acquires a database connection from the pool
    private func acquireConnection() throws -> Connection {
        return try connectionQueue.sync {
            if availableConnections == 0 {
                throw DatabaseError.poolExhausted
            }
            
            guard let connection = connectionPool.first else {
                throw DatabaseError.connectionFailed("No connections available")
            }
            
            connectionPool.removeFirst()
            availableConnections -= 1
            return connection
        }
    }
    
    /// Returns a connection to the pool
    private func releaseConnection(_ connection: Connection) {
        connectionQueue.sync {
            connectionPool.append(connection)
            availableConnections += 1
        }
    }
    
    // MARK: - Public Methods
    
    /// Executes database operations within a transaction with rollback support
    /// - Parameter operation: Closure containing database operations
    /// - Returns: Operation result or error
    public func executeInTransaction<T>(_ operation: @escaping () throws -> T) throws -> T {
        let connection = try acquireConnection()
        
        defer {
            releaseConnection(connection)
        }
        
        do {
            var result: T?
            try connection.transaction {
                result = try operation()
            }
            return result!
        } catch {
            throw DatabaseError.transactionFailed(error.localizedDescription)
        }
    }
    
    /// Executes a database query with automatic connection management
    /// - Parameters:
    ///   - query: SQL query string
    ///   - parameters: Query parameters
    /// - Returns: Query result
    public func executeQuery(_ query: String, parameters: [Binding?] = []) throws -> Statement {
        let connection = try acquireConnection()
        
        defer {
            releaseConnection(connection)
        }
        
        do {
            return try connection.prepare(query, parameters)
        } catch {
            throw DatabaseError.queryFailed(error.localizedDescription)
        }
    }
    
    /// Creates point-in-time backup of database
    /// - Returns: Backup success status
    public func performBackup() -> Result<Bool, DatabaseError> {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMdd_HHmmss"
        let timestamp = dateFormatter.string(from: Date())
        let backupName = "garden_planner_backup_\(timestamp).sqlite"
        let backupURL = backupDirectory.appendingPathComponent(backupName)
        
        do {
            // Pause all active transactions
            connectionQueue.sync {
                connectionPool.forEach { $0.interrupt() }
            }
            
            // Get source database path
            guard let sourcePath = connectionPool.first?.filename else {
                return .failure(.backupFailed("Could not determine source database path"))
            }
            
            // Perform backup
            try FileManager.default.copyItem(atPath: sourcePath, toPath: backupURL.path)
            
            // Cleanup old backups (keep last 5)
            try cleanupOldBackups()
            
            return .success(true)
        } catch {
            return .failure(.backupFailed(error.localizedDescription))
        }
    }
    
    // MARK: - Private Methods
    
    /// Sets up automated backup timer
    private func setupBackupTimer() {
        backupTimer = Timer.scheduledTimer(withTimeInterval: BACKUP_INTERVAL, repeats: true) { [weak self] _ in
            self?.databaseQueue.async {
                _ = self?.performBackup()
            }
        }
    }
    
    /// Runs pending database migrations
    private func runMigrations() throws {
        do {
            _ = try migrationManager.migrate()
        } catch {
            throw DatabaseError.queryFailed("Migration failed: \(error)")
        }
    }
    
    /// Cleans up old database backups
    private func cleanupOldBackups() throws {
        let fileManager = FileManager.default
        let backupFiles = try fileManager.contentsOfDirectory(at: backupDirectory,
                                                            includingPropertiesForKeys: [.creationDateKey],
                                                            options: .skipsHiddenFiles)
        
        if backupFiles.count > 5 {
            // Sort by creation date and remove oldest
            let sortedFiles = try backupFiles.sorted {
                let date1 = try $0.resourceValues(forKeys: [.creationDateKey]).creationDate ?? Date.distantPast
                let date2 = try $1.resourceValues(forKeys: [.creationDateKey]).creationDate ?? Date.distantPast
                return date1 < date2
            }
            
            // Remove oldest files keeping only last 5
            for fileURL in sortedFiles[..<(sortedFiles.count - 5)] {
                try fileManager.removeItem(at: fileURL)
            }
        }
    }
    
    deinit {
        backupTimer?.invalidate()
        connectionPool.forEach { try? $0.close() }
    }
}