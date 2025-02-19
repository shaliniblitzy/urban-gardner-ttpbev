//
// Zone.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation

/// A thread-safe model class representing a garden zone with specific sunlight conditions
/// and optimized space utilization for plant assignments.
@objc public class Zone: NSObject, Codable, Identifiable {
    
    // MARK: - Properties
    
    public let id: String
    public let area: Double
    public let sunlightCondition: String
    private var _plants: [Plant]
    public var plants: [Plant] {
        get {
            lock.lock()
            defer { lock.unlock() }
            return _plants
        }
    }
    private(set) public var spaceUtilization: Double
    
    // Thread safety
    private let lock = NSLock()
    private let spaceCache = NSCache<NSString, NSNumber>()
    
    // MARK: - Error Types
    
    public enum ZoneError: Error {
        case invalidArea
        case invalidSunlight
        case insufficientSpace
        case incompatiblePlant
        case threadSafetyViolation
    }
    
    // MARK: - Initialization
    
    /// Creates a new Zone instance with the specified parameters
    /// - Parameters:
    ///   - id: Unique identifier for the zone
    ///   - area: Zone area in square feet
    ///   - sunlightCondition: Sunlight condition from SunlightConditions
    public init(id: String, area: Double, sunlightCondition: String) {
        // Validate inputs
        precondition(area >= GardenValidation.minArea && area <= GardenValidation.maxArea,
                    "Area must be between \(GardenValidation.minArea) and \(GardenValidation.maxArea) sq ft")
        precondition([SunlightConditions.fullSun,
                     SunlightConditions.partialShade,
                     SunlightConditions.fullShade].contains(sunlightCondition),
                    "Invalid sunlight condition")
        
        self.id = id
        self.area = area
        self.sunlightCondition = sunlightCondition
        self._plants = []
        self.spaceUtilization = 0.0
        
        super.init()
        
        // Initialize space cache
        spaceCache.name = "com.gardenplanner.zone.\(id).spaceCache"
        spaceCache.countLimit = 1
        
        // Calculate initial space utilization
        calculateSpaceUtilization()
    }
    
    // MARK: - Public Methods
    
    /// Attempts to add a plant to the zone with comprehensive validation
    /// - Parameter plant: Plant to add to the zone
    /// - Returns: Result indicating success or specific error
    public func addPlant(_ plant: Plant) -> Result<Bool, ZoneError> {
        lock.lock()
        defer { lock.unlock() }
        
        // Verify sunlight compatibility
        guard plant.sunlightNeeds == sunlightCondition ||
              (plant.sunlightNeeds == SunlightConditions.partialShade &&
               sunlightCondition == SunlightConditions.fullSun) else {
            return .failure(.incompatiblePlant)
        }
        
        // Check available space
        let availableSpace = getAvailableSpace()
        guard availableSpace >= plant.spacing else {
            return .failure(.insufficientSpace)
        }
        
        // Verify compatibility with existing plants
        for existingPlant in _plants {
            guard plant.isCompatibleWith(existingPlant) else {
                return .failure(.incompatiblePlant)
            }
        }
        
        // Add plant and update space utilization
        _plants.append(plant)
        calculateSpaceUtilization()
        
        // Invalidate space cache
        spaceCache.removeAllObjects()
        
        return .success(true)
    }
    
    /// Calculates available space in the zone with caching
    /// - Returns: Available space in square feet
    public func getAvailableSpace() -> Double {
        // Check cache first
        if let cachedSpace = spaceCache.object(forKey: "availableSpace" as NSString) {
            return cachedSpace.doubleValue
        }
        
        lock.lock()
        defer { lock.unlock() }
        
        let usedSpace = _plants.reduce(0.0) { $0 + $1.spacing }
        let availableSpace = max(0.0, area - usedSpace)
        
        // Update cache
        spaceCache.setObject(NSNumber(value: availableSpace),
                           forKey: "availableSpace" as NSString)
        
        return availableSpace
    }
    
    /// Calculates current space utilization percentage
    /// - Returns: Percentage of space utilized (0-100)
    public func calculateSpaceUtilization() -> Double {
        lock.lock()
        defer { lock.unlock() }
        
        let usedSpace = _plants.reduce(0.0) { $0 + $1.spacing }
        let utilization = min(100.0, (usedSpace / area) * 100.0)
        
        spaceUtilization = utilization
        return utilization
    }
    
    /// Validates zone configuration and state
    /// - Returns: Result indicating validity or specific error
    public func validate() -> Result<Bool, ZoneError> {
        lock.lock()
        defer { lock.unlock() }
        
        // Validate area
        guard area >= GardenValidation.minArea && area <= GardenValidation.maxArea else {
            return .failure(.invalidArea)
        }
        
        // Validate sunlight condition
        guard [SunlightConditions.fullSun,
               SunlightConditions.partialShade,
               SunlightConditions.fullShade].contains(sunlightCondition) else {
            return .failure(.invalidSunlight)
        }
        
        // Validate space utilization
        let totalSpace = _plants.reduce(0.0) { $0 + $1.spacing }
        guard totalSpace <= area else {
            return .failure(.insufficientSpace)
        }
        
        // Validate plant compatibility
        for (index, plant) in _plants.enumerated() {
            for otherPlant in _plants[(index + 1)...] {
                guard plant.isCompatibleWith(otherPlant) else {
                    return .failure(.incompatiblePlant)
                }
            }
        }
        
        return .success(true)
    }
    
    // MARK: - Codable Implementation
    
    private enum CodingKeys: String, CodingKey {
        case id, area, sunlightCondition, plants, spaceUtilization
    }
    
    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        area = try container.decode(Double.self, forKey: .area)
        sunlightCondition = try container.decode(String.self, forKey: .sunlightCondition)
        _plants = try container.decode([Plant].self, forKey: .plants)
        spaceUtilization = try container.decode(Double.self, forKey: .spaceUtilization)
        
        super.init()
        
        // Initialize thread safety mechanisms
        spaceCache.name = "com.gardenplanner.zone.\(id).spaceCache"
        spaceCache.countLimit = 1
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(id, forKey: .id)
        try container.encode(area, forKey: .area)
        try container.encode(sunlightCondition, forKey: .sunlightCondition)
        try container.encode(_plants, forKey: .plants)
        try container.encode(spaceUtilization, forKey: .spaceUtilization)
    }
}