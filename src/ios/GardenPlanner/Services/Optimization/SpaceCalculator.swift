//
// SpaceCalculator.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+

/// A thread-safe service class that handles garden space optimization calculations
/// with performance optimizations and caching support.
public class SpaceCalculator {
    
    // MARK: - Properties
    
    private let minSpacing: Double = 0.1 // Minimum spacing in meters
    private let targetUtilization: Double = 0.9 // Target 90% space utilization
    private let calculationLock = NSLock()
    private let layoutCache = NSCache<NSString, LayoutResult>()
    private let calculationQueue = DispatchQueue(
        label: "com.gardenplanner.spacecalculator",
        qos: .userInitiated,
        attributes: .concurrent
    )
    
    // MARK: - Types
    
    /// Represents the result of a layout calculation for caching
    private class LayoutResult {
        let layout: [Zone: [Plant]]
        let timestamp: Date
        
        init(layout: [Zone: [Plant]], timestamp: Date = Date()) {
            self.layout = layout
            self.timestamp = timestamp
        }
    }
    
    // MARK: - Initialization
    
    public init() {
        // Configure cache limits
        layoutCache.countLimit = 50
        layoutCache.totalCostLimit = 5 * 1024 * 1024 // 5MB
    }
    
    // MARK: - Public Methods
    
    /// Calculates the optimal number of plants that can fit in a given area
    /// - Parameters:
    ///   - area: Available area in square feet
    ///   - plantSpacing: Required spacing between plants
    /// - Returns: Maximum number of plants that can fit
    public func calculateOptimalPlantCount(area: Double, plantSpacing: Double) -> Int {
        calculationLock.lock()
        defer { calculationLock.unlock() }
        
        // Check cache
        let cacheKey = "plantCount_\(area)_\(plantSpacing)" as NSString
        if let cached = layoutCache.object(forKey: cacheKey) as? LayoutResult,
           Date().timeIntervalSince(cached.timestamp) < 3600 { // 1 hour cache
            return cached.layout.values.reduce(0) { $0 + $1.count }
        }
        
        // Validate inputs
        guard area >= GardenValidation.minArea && area <= GardenValidation.maxArea else {
            return 0
        }
        guard plantSpacing >= minSpacing else {
            return 0
        }
        
        // Calculate effective area considering spacing requirements
        let effectiveArea = area * targetUtilization
        let plantsPerRow = Int(sqrt(effectiveArea / (plantSpacing * plantSpacing)))
        let optimalCount = plantsPerRow * plantsPerRow
        
        // Cache result
        let result = LayoutResult(layout: [:])
        layoutCache.setObject(result, forKey: cacheKey)
        
        return optimalCount
    }
    
    /// Validates plant spacing requirements in a given layout
    /// - Parameter layout: Current garden layout
    /// - Returns: Whether spacing requirements are met
    public func validatePlantSpacing(_ layout: [Zone: [Plant]]) -> Bool {
        return calculationQueue.sync {
            // Process plants in batches for performance
            let batchSize = 100
            var isValid = true
            
            for (zone, plants) in layout {
                let batches = stride(from: 0, to: plants.count, by: batchSize).map {
                    Array(plants[$0..<min($0 + batchSize, plants.count)])
                }
                
                for batch in batches {
                    let dispatchGroup = DispatchGroup()
                    var batchValid = true
                    
                    for (index, plant) in batch.enumerated() {
                        calculationQueue.async(group: dispatchGroup) {
                            // Check spacing with other plants in batch
                            for otherPlant in batch[(index + 1)...] {
                                if !plant.isCompatibleWith(otherPlant) {
                                    batchValid = false
                                }
                            }
                        }
                    }
                    
                    dispatchGroup.wait()
                    if !batchValid {
                        isValid = false
                        break
                    }
                }
                
                if !isValid {
                    break
                }
            }
            
            return isValid
        }
    }
    
    /// Optimizes plant layout for maximum space utilization
    /// - Parameters:
    ///   - garden: Garden to optimize
    ///   - plants: Plants to arrange
    /// - Returns: Optimized layout by zone
    public func optimizeLayout(garden: Garden, plants: [Plant]) -> [Zone: [Plant]] {
        calculationLock.lock()
        defer { calculationLock.unlock() }
        
        // Check cache
        let cacheKey = "layout_\(garden.id)_\(plants.map { $0.id }.joined())" as NSString
        if let cached = layoutCache.object(forKey: cacheKey) as? LayoutResult,
           Date().timeIntervalSince(cached.timestamp) < 1800 { // 30 minutes cache
            return cached.layout
        }
        
        // Start performance monitoring
        let startTime = Date()
        var optimizedLayout: [Zone: [Plant]] = [:]
        
        // Sort plants by spacing requirements (largest first)
        let sortedPlants = plants.sorted { $0.spacing > $1.spacing }
        
        // Process zones in parallel
        let dispatchGroup = DispatchGroup()
        let zones = garden.zones
        
        for zone in zones {
            calculationQueue.async(group: dispatchGroup) {
                var zonePlants: [Plant] = []
                var availableSpace = zone.area
                
                for plant in sortedPlants where availableSpace >= plant.spacing {
                    if zone.sunlightCondition == plant.sunlightNeeds ||
                       (zone.sunlightCondition == SunlightConditions.fullSun &&
                        plant.sunlightNeeds == SunlightConditions.partialShade) {
                        
                        // Check compatibility with existing plants
                        let isCompatible = zonePlants.allSatisfy { $0.isCompatibleWith(plant) }
                        if isCompatible {
                            zonePlants.append(plant)
                            availableSpace -= plant.spacing
                        }
                    }
                }
                
                self.calculationLock.lock()
                optimizedLayout[zone] = zonePlants
                self.calculationLock.unlock()
            }
        }
        
        dispatchGroup.wait()
        
        // Validate final arrangement
        guard validatePlantSpacing(optimizedLayout) else {
            return [:]
        }
        
        // Cache optimized layout
        let result = LayoutResult(layout: optimizedLayout)
        layoutCache.setObject(result, forKey: cacheKey)
        
        // Log performance metrics
        let duration = Date().timeIntervalSince(startTime)
        print("Layout optimization completed in \(duration) seconds")
        
        return optimizedLayout
    }
    
    /// Calculates space utilization percentage for a given layout
    /// - Parameters:
    ///   - layout: Current garden layout
    ///   - totalArea: Total garden area
    /// - Returns: Utilization percentage (0-1)
    public func calculateUtilization(layout: [Zone: [Plant]], totalArea: Double) -> Double {
        calculationLock.lock()
        defer { calculationLock.unlock() }
        
        var totalUsedSpace: Double = 0
        
        for (_, plants) in layout {
            let zoneUsedSpace = plants.reduce(0.0) { total, plant in
                // Consider growth stage in space calculation
                let spaceMultiplier: Double
                switch plant.growthStage {
                case "seedling": spaceMultiplier = 0.3
                case "vegetative": spaceMultiplier = 0.6
                case "flowering": spaceMultiplier = 0.8
                case "fruiting", "mature": spaceMultiplier = 1.0
                default: spaceMultiplier = 0.5
                }
                return total + (plant.spacing * spaceMultiplier)
            }
            totalUsedSpace += zoneUsedSpace
        }
        
        return min(1.0, totalUsedSpace / totalArea)
    }
}