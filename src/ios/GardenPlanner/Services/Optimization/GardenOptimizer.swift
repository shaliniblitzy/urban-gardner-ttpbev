//
// GardenOptimizer.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+

/// A thread-safe service class that orchestrates garden optimization by combining
/// space utilization, sunlight analysis, and plant compatibility calculations.
public class GardenOptimizer {
    
    // MARK: - Properties
    
    private let garden: Garden
    private let spaceCalculator: SpaceCalculator
    private let sunlightAnalyzer: SunlightAnalyzer
    private let optimizationLock = NSLock()
    private let optimizationCache: NSCache<NSString, OptimizationResult>
    
    // MARK: - Types
    
    /// Represents the result of a garden optimization operation
    private class OptimizationResult {
        let layout: [Zone: [Plant]]
        let score: Double
        let timestamp: Date
        let spaceUtilization: Double
        
        init(layout: [Zone: [Plant]], score: Double, spaceUtilization: Double) {
            self.layout = layout
            self.score = score
            self.timestamp = Date()
            self.spaceUtilization = spaceUtilization
        }
    }
    
    /// Comprehensive optimization score breakdown
    public struct OptimizationScore {
        public let overall: Double
        public let spaceUtilization: Double
        public let sunlightEfficiency: Double
        public let plantCompatibility: Double
        public let timestamp: Date
    }
    
    /// Detailed validation result
    public struct ValidationResult {
        public let isValid: Bool
        public let spaceUtilization: Double
        public let sunlightScore: Double
        public let compatibilityScore: Double
        public let performanceMetrics: [String: Double]
    }
    
    /// Optimization improvement suggestion
    public struct ImprovementSuggestion {
        public let type: String
        public let description: String
        public let impact: Double
        public let priority: Int
    }
    
    // MARK: - Error Types
    
    public enum OptimizationError: Error {
        case invalidGardenConfiguration
        case insufficientSpace
        case incompatiblePlants
        case optimizationFailed
        case threadSafetyViolation
        case cachingError
    }
    
    // MARK: - Initialization
    
    /// Creates a new GardenOptimizer instance with required dependencies
    /// - Parameters:
    ///   - garden: Garden instance to optimize
    ///   - cacheSize: Maximum number of cached optimization results
    public init(garden: Garden, cacheSize: Int = 10) {
        self.garden = garden
        self.spaceCalculator = SpaceCalculator()
        self.sunlightAnalyzer = SunlightAnalyzer(garden: garden)
        
        // Initialize optimization cache
        self.optimizationCache = NSCache<NSString, OptimizationResult>()
        self.optimizationCache.countLimit = cacheSize
        self.optimizationCache.name = "com.gardenplanner.optimizer.\(garden.id)"
    }
    
    // MARK: - Public Methods
    
    /// Generates an optimized garden layout with performance monitoring
    /// - Returns: Result indicating success or specific error
    public func optimizeGardenLayout() -> Result<Bool, OptimizationError> {
        optimizationLock.lock()
        defer { optimizationLock.unlock() }
        
        // Check cache
        let cacheKey = "layout_\(garden.id)" as NSString
        if let cached = optimizationCache.object(forKey: cacheKey),
           Date().timeIntervalSince(cached.timestamp) < 1800 { // 30 minutes cache
            return .success(true)
        }
        
        // Start performance monitoring
        let startTime = Date()
        
        // Validate garden configuration
        guard case .success = garden.validate() else {
            return .failure(.invalidGardenConfiguration)
        }
        
        // Analyze sunlight distribution
        guard case .success = sunlightAnalyzer.validateZoneSunlight() else {
            return .failure(.optimizationFailed)
        }
        
        // Process zones in batches
        let batchSize = 5
        let zones = garden.zones
        var optimizedLayout: [Zone: [Plant]] = [:]
        
        for i in stride(from: 0, to: zones.count, by: batchSize) {
            let batch = Array(zones[i..<min(i + batchSize, zones.count)])
            
            for zone in batch {
                // Calculate optimal plant placement
                if let layout = spaceCalculator.optimizeLayout(garden: garden, plants: garden.plants) {
                    optimizedLayout[zone] = layout[zone]
                }
            }
        }
        
        // Validate plant compatibility
        guard spaceCalculator.validatePlantSpacing(optimizedLayout) else {
            return .failure(.incompatiblePlants)
        }
        
        // Calculate optimization metrics
        let spaceUtilization = spaceCalculator.calculateUtilization(
            layout: optimizedLayout,
            totalArea: garden.area
        )
        let optimizationScore = calculateOptimizationScore().overall
        
        // Cache optimization result
        let result = OptimizationResult(
            layout: optimizedLayout,
            score: optimizationScore,
            spaceUtilization: spaceUtilization
        )
        optimizationCache.setObject(result, forKey: cacheKey)
        
        // Log performance metrics
        let duration = Date().timeIntervalSince(startTime)
        print("Garden optimization completed in \(duration) seconds")
        
        return .success(true)
    }
    
    /// Calculates comprehensive optimization score
    /// - Returns: Detailed score breakdown
    public func calculateOptimizationScore() -> OptimizationScore {
        optimizationLock.lock()
        defer { optimizationLock.unlock() }
        
        // Calculate component scores
        let spaceScore = garden.calculateSpaceUtilization()
        let sunlightScore = sunlightAnalyzer.calculateSunlightScore()
        let compatibilityScore = calculateCompatibilityScore()
        
        // Apply weighted scoring
        let spaceWeight = 0.4
        let sunlightWeight = 0.4
        let compatibilityWeight = 0.2
        
        let overallScore = (spaceScore * spaceWeight) +
                          (sunlightScore * sunlightWeight) +
                          (compatibilityScore * compatibilityWeight)
        
        return OptimizationScore(
            overall: overallScore,
            spaceUtilization: spaceScore,
            sunlightEfficiency: sunlightScore,
            plantCompatibility: compatibilityScore,
            timestamp: Date()
        )
    }
    
    /// Performs comprehensive validation of optimization
    /// - Returns: Detailed validation results
    public func validateOptimization() -> ValidationResult {
        optimizationLock.lock()
        defer { optimizationLock.unlock() }
        
        let startTime = Date()
        
        // Validate space utilization
        let spaceUtilization = garden.calculateSpaceUtilization()
        let targetUtilization = 0.3 // 30% improvement target
        
        // Validate sunlight conditions
        let sunlightScore = sunlightAnalyzer.calculateSunlightScore()
        
        // Validate plant compatibility
        let compatibilityScore = calculateCompatibilityScore()
        
        // Calculate performance metrics
        let duration = Date().timeIntervalSince(startTime)
        let performanceMetrics = [
            "validationDuration": duration,
            "memoryUsage": Double(ProcessInfo.processInfo.physicalMemory) / 1_000_000
        ]
        
        let isValid = spaceUtilization >= targetUtilization &&
                     sunlightScore >= 70.0 &&
                     compatibilityScore >= 80.0
        
        return ValidationResult(
            isValid: isValid,
            spaceUtilization: spaceUtilization,
            sunlightScore: sunlightScore,
            compatibilityScore: compatibilityScore,
            performanceMetrics: performanceMetrics
        )
    }
    
    /// Generates actionable suggestions for improving garden layout
    /// - Returns: Prioritized list of improvement suggestions
    public func suggestImprovements() -> [ImprovementSuggestion] {
        optimizationLock.lock()
        defer { optimizationLock.unlock() }
        
        var suggestions: [ImprovementSuggestion] = []
        
        // Analyze space utilization
        let spaceUtilization = garden.calculateSpaceUtilization()
        if spaceUtilization < 0.7 { // Less than 70% utilized
            suggestions.append(ImprovementSuggestion(
                type: "space",
                description: "Increase plant density in underutilized zones",
                impact: 0.8,
                priority: 1
            ))
        }
        
        // Analyze sunlight distribution
        let sunlightScore = sunlightAnalyzer.calculateSunlightScore()
        if sunlightScore < 80.0 {
            suggestions.append(ImprovementSuggestion(
                type: "sunlight",
                description: "Redistribute plants to optimize sunlight exposure",
                impact: 0.7,
                priority: 2
            ))
        }
        
        // Analyze plant compatibility
        let compatibilityScore = calculateCompatibilityScore()
        if compatibilityScore < 90.0 {
            suggestions.append(ImprovementSuggestion(
                type: "compatibility",
                description: "Adjust plant placement to improve companion planting",
                impact: 0.6,
                priority: 3
            ))
        }
        
        return suggestions.sorted { $0.priority < $1.priority }
    }
    
    // MARK: - Private Methods
    
    private func calculateCompatibilityScore() -> Double {
        var compatiblePairs = 0
        var totalPairs = 0
        
        for zone in garden.zones {
            let plants = zone.plants
            for (index, plant) in plants.enumerated() {
                for otherPlant in plants[(index + 1)...] {
                    totalPairs += 1
                    if plant.isCompatibleWith(otherPlant) {
                        compatiblePairs += 1
                    }
                }
            }
        }
        
        return totalPairs > 0 ? (Double(compatiblePairs) / Double(totalPairs)) * 100.0 : 100.0
    }
}