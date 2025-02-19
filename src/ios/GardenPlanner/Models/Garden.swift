//
// Garden.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+

/// A thread-safe model class representing a garden with comprehensive management
/// of dimensions, zones, plants and optimization capabilities.
@objc public class Garden: NSObject, Codable, Identifiable {
    
    // MARK: - Properties
    
    public let id: String
    public let area: Double
    private var _zones: [Zone]
    public var zones: [Zone] {
        get {
            lock.lock()
            defer { lock.unlock() }
            return _zones
        }
    }
    private var _plants: [Plant]
    public var plants: [Plant] {
        get {
            lock.lock()
            defer { lock.unlock() }
            return _plants
        }
    }
    public let createdAt: Date
    private(set) public var updatedAt: Date
    private(set) public var spaceUtilization: Double
    private(set) public var isOptimized: Bool
    
    // Thread safety
    private let lock = NSLock()
    private let calculationCache = NSCache<NSString, NSNumber>()
    
    // MARK: - Error Types
    
    public enum GardenValidationError: Error {
        case invalidArea
        case noZones
        case incompatibleZones
        case spaceOverflow
        case invalidPlantAssignment
    }
    
    public enum OptimizationError: Error {
        case insufficientSpace
        case incompatiblePlants
        case invalidZoneConfiguration
        case optimizationFailed
    }
    
    // MARK: - Initialization
    
    /// Creates a new Garden instance with the specified parameters
    /// - Parameters:
    ///   - id: Unique identifier for the garden
    ///   - area: Garden area in square feet
    ///   - zones: Array of garden zones
    ///   - plants: Array of plants in the garden
    public init(id: String, area: Double, zones: [Zone], plants: [Plant]) {
        // Validate area constraints
        precondition(area >= GardenValidation.minArea && area <= GardenValidation.maxArea,
                    "Garden area must be between \(GardenValidation.minArea) and \(GardenValidation.maxArea) sq ft")
        precondition(!zones.isEmpty, "Garden must have at least one zone")
        
        self.id = id
        self.area = area
        self._zones = zones
        self._plants = plants
        self.createdAt = Date()
        self.updatedAt = Date()
        self.spaceUtilization = 0.0
        self.isOptimized = false
        
        super.init()
        
        // Initialize calculation cache
        calculationCache.name = "com.gardenplanner.garden.\(id).calculationCache"
        calculationCache.countLimit = 10
        
        // Calculate initial space utilization
        calculateSpaceUtilization()
    }
    
    // MARK: - Public Methods
    
    /// Thread-safe calculation of garden space utilization percentage
    /// - Returns: Percentage of space utilized (0-100)
    public func calculateSpaceUtilization() -> Double {
        lock.lock()
        defer { lock.unlock() }
        
        // Check cache first
        if let cachedUtilization = calculationCache.object(forKey: "spaceUtilization" as NSString) {
            return cachedUtilization.doubleValue
        }
        
        // Calculate total utilized space across all zones
        let totalUtilizedSpace = _zones.reduce(0.0) { sum, zone in
            sum + (zone.spaceUtilization * zone.area / 100.0)
        }
        
        // Calculate overall utilization percentage
        let utilization = min(100.0, (totalUtilizedSpace / area) * 100.0)
        spaceUtilization = utilization
        
        // Cache the calculation
        calculationCache.setObject(NSNumber(value: utilization),
                                 forKey: "spaceUtilization" as NSString)
        
        return utilization
    }
    
    /// Thread-safe addition of plant to the most suitable zone
    /// - Parameters:
    ///   - plant: Plant to add to the garden
    ///   - targetZone: Specific zone for plant placement
    /// - Returns: Success status of plant addition
    public func addPlant(_ plant: Plant, to targetZone: Zone) -> Result<Bool, GardenValidationError> {
        lock.lock()
        defer { lock.unlock() }
        
        // Validate zone belongs to garden
        guard _zones.contains(where: { $0.id == targetZone.id }) else {
            return .failure(.invalidPlantAssignment)
        }
        
        // Attempt to add plant to zone
        switch targetZone.addPlant(plant) {
        case .success:
            _plants.append(plant)
            updatedAt = Date()
            calculationCache.removeAllObjects()
            calculateSpaceUtilization()
            return .success(true)
            
        case .failure:
            return .failure(.invalidPlantAssignment)
        }
    }
    
    /// Comprehensive validation of garden properties
    /// - Returns: Validation result with detailed error information
    public func validate() -> Result<Bool, GardenValidationError> {
        lock.lock()
        defer { lock.unlock() }
        
        // Validate area constraints
        guard area >= GardenValidation.minArea && area <= GardenValidation.maxArea else {
            return .failure(.invalidArea)
        }
        
        // Validate zones existence
        guard !_zones.isEmpty else {
            return .failure(.noZones)
        }
        
        // Validate total zone area matches garden area
        let totalZoneArea = _zones.reduce(0.0) { $0 + $1.area }
        guard abs(totalZoneArea - area) < 0.01 else { // Allow small floating-point difference
            return .failure(.spaceOverflow)
        }
        
        // Validate each zone
        for zone in _zones {
            if case .failure = zone.validate() {
                return .failure(.incompatibleZones)
            }
        }
        
        return .success(true)
    }
    
    /// Thread-safe optimization of garden layout
    /// - Returns: Optimization result with error information
    public func optimizeLayout() -> Result<Bool, OptimizationError> {
        lock.lock()
        defer { lock.unlock() }
        
        // Validate current state before optimization
        if case .failure = validate() {
            return .failure(.invalidZoneConfiguration)
        }
        
        // Sort plants by space requirements (largest first)
        let sortedPlants = _plants.sorted { $0.spacing > $1.spacing }
        
        // Sort zones by available space (largest first)
        let sortedZones = _zones.sorted { $0.getAvailableSpace() > $1.getAvailableSpace() }
        
        // Clear existing plant assignments
        _plants.removeAll()
        for zone in _zones {
            if case .failure = zone.validate() {
                return .failure(.optimizationFailed)
            }
        }
        
        // Attempt to assign plants to optimal zones
        for plant in sortedPlants {
            var placed = false
            
            for zone in sortedZones {
                if zone.getAvailableSpace() >= plant.spacing {
                    switch addPlant(plant, to: zone) {
                    case .success:
                        placed = true
                        break
                    case .failure:
                        continue
                    }
                }
            }
            
            if !placed {
                return .failure(.insufficientSpace)
            }
        }
        
        isOptimized = true
        updatedAt = Date()
        calculationCache.removeAllObjects()
        calculateSpaceUtilization()
        
        return .success(true)
    }
    
    // MARK: - Codable Implementation
    
    private enum CodingKeys: String, CodingKey {
        case id, area, zones, plants, createdAt, updatedAt, spaceUtilization, isOptimized
    }
    
    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        area = try container.decode(Double.self, forKey: .area)
        _zones = try container.decode([Zone].self, forKey: .zones)
        _plants = try container.decode([Plant].self, forKey: .plants)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        spaceUtilization = try container.decode(Double.self, forKey: .spaceUtilization)
        isOptimized = try container.decode(Bool.self, forKey: .isOptimized)
        
        super.init()
        
        // Initialize thread safety mechanisms
        calculationCache.name = "com.gardenplanner.garden.\(id).calculationCache"
        calculationCache.countLimit = 10
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(id, forKey: .id)
        try container.encode(area, forKey: .area)
        try container.encode(_zones, forKey: .zones)
        try container.encode(_plants, forKey: .plants)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encode(spaceUtilization, forKey: .spaceUtilization)
        try container.encode(isOptimized, forKey: .isOptimized)
    }
}