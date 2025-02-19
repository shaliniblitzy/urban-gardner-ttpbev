//
// LayoutViewModel.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation
import Combine

/// A thread-safe view model that manages garden layout optimization state and business logic
/// with comprehensive error handling and performance monitoring.
@available(iOS 13.0, *)
public class LayoutViewModel: ObservableObject {
    
    // MARK: - Published Properties
    
    @Published private(set) var garden: Garden?
    @Published private(set) var optimizedLayout: [Zone: [Plant]] = [:]
    @Published private(set) var utilizationScore: Double = 0.0
    @Published private(set) var isLoading: Bool = false
    @Published private(set) var error: LayoutOptimizationError?
    @Published private(set) var performanceMetrics: LayoutOptimizationMetrics?
    
    // MARK: - Private Properties
    
    private let optimizer: GardenOptimizer
    private let layoutCache: NSCache<NSString, CachedLayout>
    private var cancellables = Set<AnyCancellable>()
    private let optimizationQueue = DispatchQueue(
        label: "com.gardenplanner.layoutoptimization",
        qos: .userInitiated
    )
    
    // MARK: - Types
    
    private class CachedLayout {
        let layout: [Zone: [Plant]]
        let score: Double
        let timestamp: Date
        
        init(layout: [Zone: [Plant]], score: Double) {
            self.layout = layout
            self.score = score
            self.timestamp = Date()
        }
    }
    
    public struct LayoutOptimizationMetrics {
        let optimizationDuration: TimeInterval
        let spaceUtilization: Double
        let sunlightScore: Double
        let plantCompatibility: Double
        let memoryUsage: Double
    }
    
    public enum LayoutOptimizationError: Error {
        case invalidGarden
        case optimizationFailed
        case insufficientSpace
        case lowUtilization
        case performanceThresholdExceeded
        case cacheError
    }
    
    // MARK: - Initialization
    
    /// Creates a new LayoutViewModel instance with a garden and optimization configuration
    /// - Parameter garden: Garden instance to optimize
    public init(garden: Garden) {
        self.garden = garden
        self.optimizer = GardenOptimizer(garden: garden)
        
        // Initialize layout cache
        self.layoutCache = NSCache<NSString, CachedLayout>()
        self.layoutCache.countLimit = 5
        self.layoutCache.name = "com.gardenplanner.layoutviewmodel.cache"
        
        setupBindings()
    }
    
    // MARK: - Public Methods
    
    /// Generates an optimized garden layout with comprehensive error handling and performance monitoring
    /// - Returns: Publisher that emits optimization success status or error
    public func generateOptimizedLayout() -> AnyPublisher<Bool, LayoutOptimizationError> {
        return Future { [weak self] promise in
            guard let self = self else {
                promise(.failure(.optimizationFailed))
                return
            }
            
            self.optimizationQueue.async {
                self.isLoading = true
                let startTime = Date()
                
                // Check cache first
                if let cachedLayout = self.checkCache() {
                    self.updateWithCachedLayout(cachedLayout, promise: promise)
                    return
                }
                
                // Validate garden
                guard let garden = self.garden, case .success = garden.validate() else {
                    self.handleError(.invalidGarden, promise: promise)
                    return
                }
                
                // Generate layout
                switch self.optimizer.optimizeGardenLayout() {
                case .success:
                    // Calculate metrics
                    let duration = Date().timeIntervalSince(startTime)
                    let validationResult = self.optimizer.validateOptimization()
                    
                    // Validate performance
                    guard duration <= 3.0 else {
                        self.handleError(.performanceThresholdExceeded, promise: promise)
                        return
                    }
                    
                    // Update state
                    self.updateOptimizationResults(
                        validationResult: validationResult,
                        duration: duration,
                        promise: promise
                    )
                    
                case .failure(let error):
                    self.handleOptimizationError(error, promise: promise)
                }
            }
        }.eraseToAnyPublisher()
    }
    
    /// Updates the space utilization score with validation
    /// - Returns: Publisher that emits new utilization score or error
    public func updateUtilizationScore() -> AnyPublisher<Double, LayoutOptimizationError> {
        return Future { [weak self] promise in
            guard let self = self else {
                promise(.failure(.optimizationFailed))
                return
            }
            
            let score = self.optimizer.calculateOptimizationScore()
            
            // Validate 30% improvement requirement
            guard score.spaceUtilization >= 30.0 else {
                promise(.failure(.lowUtilization))
                return
            }
            
            self.utilizationScore = score.spaceUtilization
            promise(.success(score.spaceUtilization))
        }.eraseToAnyPublisher()
    }
    
    // MARK: - Private Methods
    
    private func setupBindings() {
        // Observe garden changes
        $garden
            .dropFirst()
            .sink { [weak self] _ in
                self?.layoutCache.removeAllObjects()
                self?.optimizedLayout = [:]
                self?.utilizationScore = 0.0
                self?.error = nil
            }
            .store(in: &cancellables)
    }
    
    private func checkCache() -> CachedLayout? {
        guard let garden = garden else { return nil }
        let cacheKey = "layout_\(garden.id)" as NSString
        let cached = layoutCache.object(forKey: cacheKey)
        
        // Validate cache freshness (30 minutes)
        if let cached = cached,
           Date().timeIntervalSince(cached.timestamp) < 1800 {
            return cached
        }
        return nil
    }
    
    private func updateWithCachedLayout(_ cached: CachedLayout,
                                      promise: (Result<Bool, LayoutOptimizationError>) -> Void) {
        DispatchQueue.main.async { [weak self] in
            self?.optimizedLayout = cached.layout
            self?.utilizationScore = cached.score
            self?.isLoading = false
            promise(.success(true))
        }
    }
    
    private func updateOptimizationResults(validationResult: GardenOptimizer.ValidationResult,
                                         duration: TimeInterval,
                                         promise: (Result<Bool, LayoutOptimizationError>) -> Void) {
        guard let garden = garden else {
            handleError(.invalidGarden, promise: promise)
            return
        }
        
        // Create performance metrics
        let metrics = LayoutOptimizationMetrics(
            optimizationDuration: duration,
            spaceUtilization: validationResult.spaceUtilization,
            sunlightScore: validationResult.sunlightScore,
            plantCompatibility: validationResult.compatibilityScore,
            memoryUsage: validationResult.performanceMetrics["memoryUsage"] ?? 0.0
        )
        
        // Cache successful layout
        let cacheKey = "layout_\(garden.id)" as NSString
        let cachedLayout = CachedLayout(
            layout: optimizedLayout,
            score: validationResult.spaceUtilization
        )
        layoutCache.setObject(cachedLayout, forKey: cacheKey)
        
        DispatchQueue.main.async { [weak self] in
            self?.performanceMetrics = metrics
            self?.isLoading = false
            promise(.success(true))
        }
    }
    
    private func handleOptimizationError(_ error: GardenOptimizer.OptimizationError,
                                       promise: (Result<Bool, LayoutOptimizationError>) -> Void) {
        let layoutError: LayoutOptimizationError
        switch error {
        case .invalidGardenConfiguration:
            layoutError = .invalidGarden
        case .insufficientSpace:
            layoutError = .insufficientSpace
        case .optimizationFailed:
            layoutError = .optimizationFailed
        default:
            layoutError = .optimizationFailed
        }
        handleError(layoutError, promise: promise)
    }
    
    private func handleError(_ error: LayoutOptimizationError,
                           promise: (Result<Bool, LayoutOptimizationError>) -> Void) {
        DispatchQueue.main.async { [weak self] in
            self?.error = error
            self?.isLoading = false
            promise(.failure(error))
        }
    }
}