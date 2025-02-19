//
// SunlightAnalyzer.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+

/// A thread-safe service class that analyzes and optimizes sunlight conditions
/// in garden zones with enhanced performance through caching.
public class SunlightAnalyzer {
    
    // MARK: - Properties
    
    private let garden: Garden
    private let lock = NSLock()
    private let distributionCache = NSCache<NSString, NSDictionary>()
    
    // MARK: - Error Types
    
    public enum SunlightAnalysisError: Error {
        case invalidZoneConfiguration
        case insufficientSunlight
        case incompatibleDistribution
        case calculationError
        case threadSafetyViolation
    }
    
    // MARK: - Initialization
    
    /// Creates a new SunlightAnalyzer instance with thread-safety mechanisms
    /// - Parameter garden: Garden instance to analyze
    public init(garden: Garden) {
        precondition(!garden.zones.isEmpty, "Garden must have at least one zone")
        
        self.garden = garden
        
        // Configure cache
        distributionCache.name = "com.gardenplanner.sunlight.distribution"
        distributionCache.countLimit = 5
    }
    
    // MARK: - Public Methods
    
    /// Analyzes sunlight distribution across garden zones with caching
    /// - Returns: Dictionary mapping sunlight conditions to percentage coverage
    public func analyzeSunlightDistribution() -> [String: Double] {
        lock.lock()
        defer { lock.unlock() }
        
        // Check cache
        if let cached = distributionCache.object(forKey: "distribution" as NSString) as? [String: Double] {
            return cached
        }
        
        let totalArea = garden.area
        var distribution: [String: Double] = [
            SunlightConditions.fullSun: 0.0,
            SunlightConditions.partialShade: 0.0,
            SunlightConditions.fullShade: 0.0
        ]
        
        // Calculate area for each sunlight condition
        for zone in garden.zones {
            let percentage = (zone.area / totalArea) * 100.0
            distribution[zone.sunlightCondition, default: 0.0] += percentage
        }
        
        // Validate total distribution
        let total = distribution.values.reduce(0.0, +)
        guard abs(total - 100.0) < 0.01 else {
            return [:] // Return empty if invalid distribution
        }
        
        // Cache results
        distributionCache.setObject(distribution as NSDictionary, 
                                  forKey: "distribution" as NSString)
        
        return distribution
    }
    
    /// Validates sunlight conditions for all zones with enhanced error handling
    /// - Returns: True if all zones have valid sunlight conditions
    public func validateZoneSunlight() -> Result<Bool, SunlightAnalysisError> {
        lock.lock()
        defer { lock.unlock() }
        
        // Validate each zone has valid sunlight condition
        for zone in garden.zones {
            guard [SunlightConditions.fullSun,
                  SunlightConditions.partialShade,
                  SunlightConditions.fullShade].contains(zone.sunlightCondition) else {
                return .failure(.invalidZoneConfiguration)
            }
        }
        
        // Check for minimum sunlight requirements
        let distribution = analyzeSunlightDistribution()
        let fullSunPercentage = distribution[SunlightConditions.fullSun] ?? 0.0
        
        guard fullSunPercentage >= 30.0 else {
            return .failure(.insufficientSunlight)
        }
        
        // Verify no overlapping zones
        let totalArea = garden.zones.reduce(0.0) { $0 + $1.area }
        guard abs(totalArea - garden.area) < 0.01 else {
            return .failure(.incompatibleDistribution)
        }
        
        return .success(true)
    }
    
    /// Finds optimal zone for plant placement based on sunlight requirements
    /// - Parameters:
    ///   - requiredSunlight: Required sunlight condition
    ///   - requiredArea: Minimum area needed in square feet
    /// - Returns: Optional zone that best matches requirements
    public func findOptimalZone(requiredSunlight: String, 
                              requiredArea: Double) -> Zone? {
        lock.lock()
        defer { lock.unlock() }
        
        // Validate input parameters
        guard requiredArea > 0 && requiredArea <= garden.area else {
            return nil
        }
        
        // Filter zones by sunlight requirement
        let compatibleZones = garden.zones.filter { zone in
            if requiredSunlight == SunlightConditions.partialShade {
                return zone.sunlightCondition == SunlightConditions.partialShade ||
                       zone.sunlightCondition == SunlightConditions.fullSun
            }
            return zone.sunlightCondition == requiredSunlight
        }
        
        // Score and sort zones
        let scoredZones = compatibleZones.map { zone -> (Zone, Double) in
            let availableSpace = zone.getAvailableSpace()
            let spaceScore = min(1.0, availableSpace / requiredArea)
            let utilizationScore = 1.0 - (zone.spaceUtilization / 100.0)
            let score = (spaceScore * 0.7) + (utilizationScore * 0.3)
            return (zone, score)
        }
        
        // Return highest scoring zone with sufficient space
        return scoredZones
            .filter { $0.0.getAvailableSpace() >= requiredArea }
            .sorted { $0.1 > $1.1 }
            .first?.0
    }
    
    /// Calculates comprehensive sunlight optimization score
    /// - Returns: Score between 0-100 indicating optimization level
    public func calculateSunlightScore() -> Double {
        lock.lock()
        defer { lock.unlock() }
        
        let distribution = analyzeSunlightDistribution()
        
        // Weight factors for scoring
        let fullSunWeight = 0.5
        let partialShadeWeight = 0.3
        let fullShadeWeight = 0.2
        
        // Calculate weighted scores
        let fullSunScore = (distribution[SunlightConditions.fullSun] ?? 0.0) * fullSunWeight
        let partialShadeScore = (distribution[SunlightConditions.partialShade] ?? 0.0) * partialShadeWeight
        let fullShadeScore = (distribution[SunlightConditions.fullShade] ?? 0.0) * fullShadeWeight
        
        // Calculate total score
        var totalScore = fullSunScore + partialShadeScore + fullShadeScore
        
        // Apply penalties for suboptimal conditions
        if (distribution[SunlightConditions.fullSun] ?? 0.0) < 30.0 {
            totalScore *= 0.8 // 20% penalty for insufficient full sun
        }
        
        if (distribution[SunlightConditions.fullShade] ?? 0.0) > 40.0 {
            totalScore *= 0.9 // 10% penalty for excessive shade
        }
        
        return min(100.0, max(0.0, totalScore))
    }
}