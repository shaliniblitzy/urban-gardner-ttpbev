//
// GardenViewModel.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation
import Combine

/// ViewModel implementing MVVM pattern for Garden screen functionality with comprehensive
/// performance monitoring and error handling.
@available(iOS 14.0, *)
public class GardenViewModel: ViewModelType {
    
    // MARK: - Types
    
    public struct Input {
        let createGarden: AnyPublisher<(area: Double, zones: [Zone], plants: [Plant]), Never>
        let optimizeGarden: AnyPublisher<Garden, Never>
        let validateGarden: AnyPublisher<Garden, Never>
        let updateProgress: AnyPublisher<Double, Never>
    }
    
    public struct Output {
        let garden: AnyPublisher<Garden?, Never>
        let isLoading: AnyPublisher<Bool, Never>
        let error: AnyPublisher<GardenError, Never>
        let progress: AnyPublisher<Double, Never>
        let validationState: AnyPublisher<ValidationState, Never>
    }
    
    public enum ValidationState {
        case none
        case validating
        case valid
        case invalid(String)
    }
    
    public enum GardenError: LocalizedError {
        case invalidInput(String)
        case optimizationFailed(String)
        case validationFailed(String)
        case serviceError(String)
        
        public var errorDescription: String? {
            switch self {
            case .invalidInput(let message):
                return "Invalid input: \(message)"
            case .optimizationFailed(let message):
                return "Optimization failed: \(message)"
            case .validationFailed(let message):
                return "Validation failed: \(message)"
            case .serviceError(let message):
                return "Service error: \(message)"
            }
        }
    }
    
    // MARK: - Properties
    
    private let gardenService: GardenService
    private let performanceMonitor: PerformanceMonitor
    private let errorSubject = PassthroughSubject<GardenError, Never>()
    private let gardenSubject = PassthroughSubject<Garden?, Never>()
    private let loadingSubject = PassthroughSubject<Bool, Never>()
    private let progressSubject = PassthroughSubject<Double, Never>()
    private let validationSubject = CurrentValueSubject<ValidationState, Never>(.none)
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    public init(gardenService: GardenService, performanceMonitor: PerformanceMonitor) {
        self.gardenService = gardenService
        self.performanceMonitor = performanceMonitor
        
        // Configure performance monitoring
        performanceMonitor.configure(
            subsystem: "com.gardenplanner.viewmodel",
            category: "garden_operations"
        )
    }
    
    // MARK: - ViewModelType Implementation
    
    public func transform(_ input: Input) -> Output {
        // Handle garden creation
        input.createGarden
            .sink { [weak self] area, zones, plants in
                self?.createGarden(area: area, zones: zones, plants: plants)
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                self?.errorSubject.send(error)
                            }
                        },
                        receiveValue: { garden in
                            self?.gardenSubject.send(garden)
                        }
                    )
                    .store(in: &self!.cancellables)
            }
            .store(in: &cancellables)
        
        // Handle garden optimization
        input.optimizeGarden
            .sink { [weak self] garden in
                self?.optimizeGarden(garden)
                    .sink(
                        receiveCompletion: { completion in
                            if case .failure(let error) = completion {
                                self?.errorSubject.send(error)
                            }
                        },
                        receiveValue: { optimizedGarden in
                            self?.gardenSubject.send(optimizedGarden)
                        }
                    )
                    .store(in: &self!.cancellables)
            }
            .store(in: &cancellables)
        
        // Handle garden validation
        input.validateGarden
            .sink { [weak self] garden in
                self?.validateGarden(garden)
            }
            .store(in: &cancellables)
        
        // Handle progress updates
        input.updateProgress
            .sink { [weak self] progress in
                self?.progressSubject.send(progress)
            }
            .store(in: &cancellables)
        
        return Output(
            garden: gardenSubject.eraseToAnyPublisher(),
            isLoading: loadingSubject.eraseToAnyPublisher(),
            error: errorSubject.eraseToAnyPublisher(),
            progress: progressSubject.eraseToAnyPublisher(),
            validationState: validationSubject.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func createGarden(area: Double, zones: [Zone], plants: [Plant]) -> AnyPublisher<Garden, GardenError> {
        performanceMonitor.begin(operation: "create_garden")
        loadingSubject.send(true)
        validationSubject.send(.validating)
        
        return Future { [weak self] promise in
            guard let self = self else { return }
            
            // Validate input parameters
            guard area >= GardenValidation.minArea && area <= GardenValidation.maxArea else {
                promise(.failure(.invalidInput("Garden area must be between \(GardenValidation.minArea) and \(GardenValidation.maxArea) sq ft")))
                return
            }
            
            // Create garden through service
            switch self.gardenService.createGarden(area: area, zones: zones, plants: plants) {
            case .success(let garden):
                self.performanceMonitor.end(operation: "create_garden")
                self.validationSubject.send(.valid)
                promise(.success(garden))
                
            case .failure(let error):
                self.performanceMonitor.recordError(operation: "create_garden", error: error)
                promise(.failure(.serviceError(error.localizedDescription)))
            }
            
            self.loadingSubject.send(false)
        }
        .eraseToAnyPublisher()
    }
    
    private func optimizeGarden(_ garden: Garden) -> AnyPublisher<Garden, GardenError> {
        performanceMonitor.begin(operation: "optimize_garden")
        loadingSubject.send(true)
        
        return Future { [weak self] promise in
            guard let self = self else { return }
            
            // Validate garden before optimization
            guard case .success = garden.validate() else {
                promise(.failure(.validationFailed("Invalid garden configuration")))
                return
            }
            
            // Optimize through service
            switch self.gardenService.optimizeGarden(garden) {
            case .success(let optimizedGarden):
                self.performanceMonitor.end(operation: "optimize_garden")
                promise(.success(optimizedGarden))
                
            case .failure(let error):
                self.performanceMonitor.recordError(operation: "optimize_garden", error: error)
                promise(.failure(.optimizationFailed(error.localizedDescription)))
            }
            
            self.loadingSubject.send(false)
        }
        .eraseToAnyPublisher()
    }
    
    private func validateGarden(_ garden: Garden) {
        performanceMonitor.begin(operation: "validate_garden")
        validationSubject.send(.validating)
        
        switch gardenService.validateGardenSetup(garden) {
        case .success:
            performanceMonitor.end(operation: "validate_garden")
            validationSubject.send(.valid)
            
        case .failure(let error):
            performanceMonitor.recordError(operation: "validate_garden", error: error)
            validationSubject.send(.invalid(error.localizedDescription))
        }
    }
}