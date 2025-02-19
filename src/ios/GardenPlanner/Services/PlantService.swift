//
// PlantService.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+

/// Thread-safe service class managing plant-related operations with enhanced error handling
/// and performance optimizations for the Garden Planner application.
@objc public class PlantService: NSObject {
    
    // MARK: - Properties
    
    private let databaseManager: DatabaseManager
    private let logger: Logger
    private let operationQueue: DispatchQueue
    private let plantCache: NSCache<NSString, Plant>
    private let lock: NSLock
    
    // Constants for cache configuration
    private let CACHE_LIMIT = 100
    private let CACHE_COST_LIMIT = 1024 * 1024 * 10 // 10MB
    
    // MARK: - Singleton
    
    @objc public static let shared = PlantService()
    
    // MARK: - Initialization
    
    private override init() {
        self.databaseManager = DatabaseManager.shared
        self.logger = Logger.shared
        self.operationQueue = DispatchQueue(label: "com.gardenplanner.plantservice", qos: .userInitiated)
        self.plantCache = NSCache<NSString, Plant>()
        self.lock = NSLock()
        
        super.init()
        
        // Configure cache limits
        plantCache.countLimit = CACHE_LIMIT
        plantCache.totalCostLimit = CACHE_COST_LIMIT
        
        // Setup memory pressure handling
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
    }
    
    // MARK: - Public Methods
    
    /// Thread-safe plant saving with retry logic and error handling
    /// - Parameters:
    ///   - plant: Plant instance to save
    ///   - gardenId: Associated garden identifier
    /// - Returns: Result indicating success or detailed error information
    public func savePlant(_ plant: Plant, gardenId: String) -> Result<Bool, GardenPlannerError> {
        lock.lock()
        defer { lock.unlock() }
        
        logger.info("Starting plant save operation for plant ID: \(plant.id)")
        
        // Validate plant data
        guard plant.spacing > 0 && plant.spacing <= GardenValidation.maxArea else {
            return .failure(.invalidInput(.invalidGardenDimensions))
        }
        
        do {
            var retryCount = 0
            var lastError: Error?
            
            // Retry loop for database operations
            while retryCount < RetryConfiguration.maxAttempts {
                do {
                    return try databaseManager.executeInTransaction {
                        // Get garden by ID
                        let query = "SELECT * FROM gardens WHERE id = ?"
                        let garden = try databaseManager.executeQuery(query, parameters: [gardenId])
                        
                        guard try garden.next() != nil else {
                            throw GardenPlannerError.customError(.databaseError, "Garden not found")
                        }
                        
                        // Save plant data
                        try databaseManager.executeQuery("""
                            INSERT OR REPLACE INTO plants (
                                id, zone_id, type, growth_stage, spacing, planted_date,
                                expected_yield_kg, sunlight_needs, days_to_maturity
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            parameters: [
                                plant.id,
                                plant.zone?.id ?? "",
                                plant.type,
                                plant.growthStage,
                                plant.spacing,
                                plant.plantedDate,
                                plant.expectedYieldKg,
                                plant.sunlightNeeds,
                                plant.daysToMaturity
                            ]
                        )
                        
                        // Update cache
                        self.plantCache.setObject(plant, forKey: plant.id as NSString)
                        
                        logger.info("Successfully saved plant with ID: \(plant.id)")
                        return .success(true)
                    }
                } catch {
                    lastError = error
                    retryCount += 1
                    
                    if GardenPlannerError.shouldRetry(error) {
                        Thread.sleep(forTimeInterval: RetryConfiguration.retryInterval)
                        continue
                    }
                    break
                }
            }
            
            logger.error(lastError ?? GardenPlannerError.customError(.databaseError, "Unknown error"))
            return .failure(.systemError(lastError ?? GardenPlannerError.customError(.databaseError, "Save failed")))
            
        } catch {
            logger.error(error)
            return .failure(.systemError(error))
        }
    }
    
    /// Optimized plant compatibility checking with caching
    /// - Parameters:
    ///   - plant1: First plant to check
    ///   - plant2: Second plant to check
    /// - Returns: Compatibility result with error handling
    public func checkPlantCompatibility(_ plant1: Plant, _ plant2: Plant) -> Result<Bool, GardenPlannerError> {
        // Generate cache key for compatibility check
        let cacheKey = "\(min(plant1.id, plant2.id))_\(max(plant1.id, plant2.id))" as NSString
        
        // Check cache first
        if let cachedResult = plantCache.object(forKey: cacheKey) {
            return .success(cachedResult.isCompatibleWith(plant2))
        }
        
        do {
            let isCompatible = plant1.isCompatibleWith(plant2)
            
            // Cache the result
            plantCache.setObject(plant1, forKey: cacheKey)
            
            return .success(isCompatible)
        } catch {
            logger.error(error)
            return .failure(.customError(.incompatiblePlants, "Failed to check plant compatibility"))
        }
    }
    
    /// Enhanced maintenance schedule calculation with weather adjustments
    /// - Parameters:
    ///   - plant: Plant requiring maintenance
    ///   - weatherData: Optional weather data for schedule adjustment
    /// - Returns: Detailed schedule with weather adjustments
    public func calculateMaintenanceSchedule(
        for plant: Plant,
        weatherData: [String: Any]? = nil
    ) -> Result<Schedule, GardenPlannerError> {
        operationQueue.sync {
            do {
                // Calculate base watering schedule
                let wateringSchedule = try calculateWateringSchedule(for: plant, weatherData: weatherData)
                
                // Calculate fertilizing schedule
                let fertilizingSchedule = try calculateFertilizingSchedule(for: plant)
                
                // Combine schedules and create notifications
                let combinedSchedule = Schedule(
                    id: UUID().uuidString,
                    plant: plant,
                    taskType: plant.needsWatering() ? "WATERING" : "FERTILIZING",
                    dueDate: plant.needsWatering() ? wateringSchedule : fertilizingSchedule,
                    notificationPreference: .defaultReminderTime
                )
                
                return .success(combinedSchedule)
                
            } catch {
                logger.error(error)
                return .failure(.customError(.scheduleGenerationFailed, "Failed to generate maintenance schedule"))
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func calculateWateringSchedule(
        for plant: Plant,
        weatherData: [String: Any]?
    ) throws -> Date {
        let calendar = Calendar.current
        var baseSchedule = calendar.date(
            byAdding: .day,
            value: plant.wateringFrequencyDays,
            to: plant.lastWateredDate
        ) ?? Date()
        
        // Adjust for weather if data available
        if let weatherData = weatherData,
           let rainfall = weatherData["rainfall"] as? Double {
            let rainAdjustment = Int(rainfall * 2) // 1mm rain = 2 days delay
            baseSchedule = calendar.date(
                byAdding: .day,
                value: rainAdjustment,
                to: baseSchedule
            ) ?? baseSchedule
        }
        
        return baseSchedule
    }
    
    private func calculateFertilizingSchedule(for plant: Plant) throws -> Date {
        let calendar = Calendar.current
        
        // Adjust frequency based on growth stage
        var frequencyAdjustment = 0
        switch plant.growthStage {
        case "vegetative", "flowering":
            frequencyAdjustment = -7 // More frequent during active growth
        case "fruiting":
            frequencyAdjustment = -3 // Slightly more frequent during fruiting
        default:
            break
        }
        
        return calendar.date(
            byAdding: .day,
            value: plant.fertilizingFrequencyDays + frequencyAdjustment,
            to: plant.lastFertilizedDate
        ) ?? Date()
    }
    
    @objc private func handleMemoryWarning() {
        plantCache.removeAllObjects()
        logger.info("Cleared plant cache due to memory warning")
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}