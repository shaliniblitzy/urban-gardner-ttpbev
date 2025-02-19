//
// Plant.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+

/// A thread-safe model class representing a plant with comprehensive tracking of growth,
/// care requirements, and compatibility rules.
@objc public class Plant: NSObject, Codable, Identifiable {
    
    // MARK: - Properties
    
    public let id: String
    public let type: String
    private(set) public var growthStage: String
    public let sunlightNeeds: String
    public let spacing: Double
    public let daysToMaturity: Int
    private(set) public var plantedDate: Date
    private(set) public var lastWateredDate: Date
    private(set) public var lastFertilizedDate: Date
    public let wateringFrequencyDays: Int
    public let fertilizingFrequencyDays: Int
    public let minSunlightHours: Int
    public let companionPlants: [String]
    public let incompatiblePlants: [String]
    public let expectedYieldKg: Double
    public let isPerennial: Bool
    
    // Thread safety
    private let lock = NSLock()
    
    // MARK: - Initialization
    
    /// Creates a new Plant instance with comprehensive growth and care parameters
    /// - Parameters:
    ///   - id: Unique identifier for the plant
    ///   - type: Plant variety or species
    ///   - sunlightNeeds: Required sunlight condition from SunlightConditions
    ///   - spacing: Required spacing in feet
    ///   - daysToMaturity: Expected days until harvest
    ///   - minSunlightHours: Minimum required daily sunlight hours
    ///   - companionPlants: Array of compatible plant types
    ///   - incompatiblePlants: Array of incompatible plant types
    ///   - expectedYieldKg: Expected harvest yield in kilograms
    ///   - isPerennial: Whether the plant regrows seasonally
    public init(
        id: String,
        type: String,
        sunlightNeeds: String,
        spacing: Double,
        daysToMaturity: Int,
        minSunlightHours: Int,
        companionPlants: [String],
        incompatiblePlants: [String],
        expectedYieldKg: Double,
        isPerennial: Bool
    ) {
        // Validate inputs
        precondition(spacing > 0, "Spacing must be positive")
        precondition(daysToMaturity > 0, "Days to maturity must be positive")
        precondition(minSunlightHours >= 0 && minSunlightHours <= SunlightConditions.maxSunlightHours,
                    "Invalid sunlight hours")
        precondition(expectedYieldKg >= 0, "Expected yield must be non-negative")
        
        self.id = id
        self.type = type
        self.growthStage = "seedling"
        self.sunlightNeeds = sunlightNeeds
        self.spacing = spacing
        self.daysToMaturity = daysToMaturity
        self.minSunlightHours = minSunlightHours
        self.companionPlants = companionPlants
        self.incompatiblePlants = incompatiblePlants
        self.expectedYieldKg = expectedYieldKg
        self.isPerennial = isPerennial
        
        // Initialize dates
        let now = Date()
        self.plantedDate = now
        self.lastWateredDate = now
        self.lastFertilizedDate = now
        
        // Set default care frequencies based on plant type
        self.wateringFrequencyDays = 2 // Default to every 2 days
        self.fertilizingFrequencyDays = 14 // Default to every 2 weeks
        
        super.init()
    }
    
    // MARK: - Public Methods
    
    /// Calculates expected harvest date considering growth stage and environmental factors
    /// - Returns: Calculated harvest date with environmental adjustments
    public func calculateExpectedHarvestDate() -> Date {
        lock.lock()
        defer { lock.unlock() }
        
        let calendar = Calendar.current
        let baseMaturityDate = calendar.date(byAdding: .day, value: daysToMaturity, to: plantedDate)!
        
        // Apply growth stage adjustments
        var adjustedDate = baseMaturityDate
        switch growthStage {
        case "seedling":
            adjustedDate = calendar.date(byAdding: .day, value: 7, to: adjustedDate)!
        case "vegetative":
            adjustedDate = calendar.date(byAdding: .day, value: 3, to: adjustedDate)!
        default:
            break
        }
        
        return adjustedDate
    }
    
    /// Comprehensive compatibility check considering spacing, sunlight, and companion planting rules
    /// - Parameter otherPlant: Plant to check compatibility with
    /// - Returns: True if plants are compatible for adjacent planting
    public func isCompatibleWith(_ otherPlant: Plant) -> Bool {
        // Check incompatible plants list
        if incompatiblePlants.contains(otherPlant.type) || 
           otherPlant.incompatiblePlants.contains(self.type) {
            return false
        }
        
        // Verify sunlight compatibility
        if sunlightNeeds == SunlightConditions.fullSun && 
           otherPlant.sunlightNeeds == SunlightConditions.fullShade {
            return false
        }
        
        // Check companion plants list
        if companionPlants.contains(otherPlant.type) {
            return true
        }
        
        // Verify spacing requirements
        let combinedSpacing = spacing + otherPlant.spacing
        if combinedSpacing > 4.0 { // Maximum reasonable combined spacing
            return false
        }
        
        return true
    }
    
    /// Thread-safe determination of watering needs based on schedule and environmental factors
    /// - Returns: True if plant requires watering
    public func needsWatering() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        
        let calendar = Calendar.current
        let daysSinceWatering = calendar.dateComponents([.day], from: lastWateredDate, to: Date()).day ?? 0
        
        // Adjust frequency based on growth stage
        var adjustedFrequency = wateringFrequencyDays
        switch growthStage {
        case "seedling":
            adjustedFrequency = max(1, adjustedFrequency - 1)
        case "flowering", "fruiting":
            adjustedFrequency = max(1, adjustedFrequency - 1)
        default:
            break
        }
        
        return daysSinceWatering >= adjustedFrequency
    }
    
    /// Thread-safe determination of fertilizing needs based on schedule and growth stage
    /// - Returns: True if plant requires fertilizing
    public func needsFertilizing() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        
        let calendar = Calendar.current
        let daysSinceFertilizing = calendar.dateComponents([.day], from: lastFertilizedDate, to: Date()).day ?? 0
        
        // Adjust frequency based on growth stage
        var adjustedFrequency = fertilizingFrequencyDays
        switch growthStage {
        case "vegetative", "flowering":
            adjustedFrequency = max(7, adjustedFrequency - 7)
        default:
            break
        }
        
        return daysSinceFertilizing >= adjustedFrequency
    }
    
    /// Thread-safe update of growth stage based on time elapsed and environmental factors
    /// - Returns: Updated growth stage
    public func updateGrowthStage() -> String {
        lock.lock()
        defer { lock.unlock() }
        
        let calendar = Calendar.current
        let daysSincePlanting = calendar.dateComponents([.day], from: plantedDate, to: Date()).day ?? 0
        
        let newStage: String
        let maturityPercentage = Double(daysSincePlanting) / Double(daysToMaturity)
        
        switch maturityPercentage {
        case 0..<0.2:
            newStage = "seedling"
        case 0.2..<0.4:
            newStage = "vegetative"
        case 0.4..<0.6:
            newStage = "flowering"
        case 0.6..<0.8:
            newStage = "fruiting"
        default:
            newStage = "mature"
        }
        
        growthStage = newStage
        return newStage
    }
    
    // MARK: - Codable Implementation
    
    private enum CodingKeys: String, CodingKey {
        case id, type, growthStage, sunlightNeeds, spacing, daysToMaturity,
             plantedDate, lastWateredDate, lastFertilizedDate, wateringFrequencyDays,
             fertilizingFrequencyDays, minSunlightHours, companionPlants,
             incompatiblePlants, expectedYieldKg, isPerennial
    }
}