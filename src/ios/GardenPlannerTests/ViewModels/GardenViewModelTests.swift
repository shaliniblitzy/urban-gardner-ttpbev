//
// GardenViewModelTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
import Combine
@testable import GardenPlanner

@available(iOS 14.0, *)
class GardenViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: GardenViewModel!
    private var mockGardenService: MockGardenService!
    private var cancellables: Set<AnyCancellable>!
    
    // MARK: - Test Lifecycle
    
    override func setUp() {
        super.setUp()
        mockGardenService = MockGardenService()
        let performanceMonitor = PerformanceMonitor()
        sut = GardenViewModel(gardenService: mockGardenService, performanceMonitor: performanceMonitor)
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        cancellables.forEach { $0.cancel() }
        cancellables = nil
        sut = nil
        mockGardenService = nil
        super.tearDown()
    }
    
    // MARK: - Garden Creation Tests
    
    func testCreateGardenSuccess() {
        // Given
        let expectation = XCTestExpectation(description: "Garden created successfully")
        var receivedGarden: Garden?
        var loadingStates: [Bool] = []
        var receivedError: GardenViewModel.GardenError?
        
        let area = 100.0
        let zone = Zone(id: "zone1", area: area, sunlightCondition: SunlightConditions.fullSun)
        let plant = Plant(id: "plant1", type: "Tomato", sunlightNeeds: SunlightConditions.fullSun,
                         spacing: 2.0, daysToMaturity: 60, minSunlightHours: 6,
                         companionPlants: [], incompatiblePlants: [], expectedYieldKg: 2.0,
                         isPerennial: false)
        
        let garden = Garden(id: "garden1", area: area, zones: [zone], plants: [plant])
        mockGardenService.createGardenResult = .success(garden)
        
        // When
        let input = GardenViewModel.Input(
            createGarden: Just((area: area, zones: [zone], plants: [plant])).eraseToAnyPublisher(),
            optimizeGarden: Empty().eraseToAnyPublisher(),
            validateGarden: Empty().eraseToAnyPublisher(),
            updateProgress: Empty().eraseToAnyPublisher()
        )
        
        let output = sut.transform(input)
        
        output.garden
            .sink { garden in
                receivedGarden = garden
                if garden != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        output.isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)
        
        output.error
            .sink { error in
                receivedError = error
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedGarden)
        XCTAssertEqual(receivedGarden?.id, "garden1")
        XCTAssertEqual(loadingStates, [true, false])
        XCTAssertNil(receivedError)
    }
    
    func testCreateGardenFailure() {
        // Given
        let expectation = XCTestExpectation(description: "Garden creation failed")
        var receivedError: GardenViewModel.GardenError?
        var loadingStates: [Bool] = []
        var receivedGarden: Garden?
        
        mockGardenService.createGardenResult = .failure(.invalidInput("Invalid area"))
        
        // When
        let input = GardenViewModel.Input(
            createGarden: Just((area: -1.0, zones: [], plants: [])).eraseToAnyPublisher(),
            optimizeGarden: Empty().eraseToAnyPublisher(),
            validateGarden: Empty().eraseToAnyPublisher(),
            updateProgress: Empty().eraseToAnyPublisher()
        )
        
        let output = sut.transform(input)
        
        output.error
            .sink { error in
                receivedError = error
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        output.isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)
        
        output.garden
            .sink { garden in
                receivedGarden = garden
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(receivedError?.errorDescription, "Invalid input: Invalid area")
        XCTAssertEqual(loadingStates, [true, false])
        XCTAssertNil(receivedGarden)
    }
    
    // MARK: - Garden Optimization Tests
    
    func testOptimizeGardenSuccess() {
        // Given
        let expectation = XCTestExpectation(description: "Garden optimized successfully")
        var receivedGarden: Garden?
        var loadingStates: [Bool] = []
        var receivedError: GardenViewModel.GardenError?
        
        let garden = Garden(id: "garden1", area: 100.0,
                          zones: [Zone(id: "zone1", area: 100.0, sunlightCondition: SunlightConditions.fullSun)],
                          plants: [])
        mockGardenService.optimizeGardenResult = .success(garden)
        
        // When
        let input = GardenViewModel.Input(
            createGarden: Empty().eraseToAnyPublisher(),
            optimizeGarden: Just(garden).eraseToAnyPublisher(),
            validateGarden: Empty().eraseToAnyPublisher(),
            updateProgress: Empty().eraseToAnyPublisher()
        )
        
        let output = sut.transform(input)
        
        output.garden
            .sink { garden in
                receivedGarden = garden
                if garden != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        output.isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)
        
        output.error
            .sink { error in
                receivedError = error
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedGarden)
        XCTAssertEqual(receivedGarden?.id, "garden1")
        XCTAssertEqual(loadingStates, [true, false])
        XCTAssertNil(receivedError)
    }
    
    func testOptimizeGardenFailure() {
        // Given
        let expectation = XCTestExpectation(description: "Garden optimization failed")
        var receivedError: GardenViewModel.GardenError?
        var loadingStates: [Bool] = []
        var receivedGarden: Garden?
        
        let garden = Garden(id: "garden1", area: 100.0,
                          zones: [Zone(id: "zone1", area: 100.0, sunlightCondition: SunlightConditions.fullSun)],
                          plants: [])
        mockGardenService.optimizeGardenResult = .failure(.optimizationFailed("Optimization failed"))
        
        // When
        let input = GardenViewModel.Input(
            createGarden: Empty().eraseToAnyPublisher(),
            optimizeGarden: Just(garden).eraseToAnyPublisher(),
            validateGarden: Empty().eraseToAnyPublisher(),
            updateProgress: Empty().eraseToAnyPublisher()
        )
        
        let output = sut.transform(input)
        
        output.error
            .sink { error in
                receivedError = error
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        output.isLoading
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)
        
        output.garden
            .sink { garden in
                receivedGarden = garden
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(receivedError?.errorDescription, "Optimization failed: Optimization failed")
        XCTAssertEqual(loadingStates, [true, false])
        XCTAssertNil(receivedGarden)
    }
    
    // MARK: - Performance Tests
    
    func testPerformanceRequirements() {
        // Given
        let expectation = XCTestExpectation(description: "Performance requirements met")
        let garden = Garden(id: "garden1", area: 100.0,
                          zones: [Zone(id: "zone1", area: 100.0, sunlightCondition: SunlightConditions.fullSun)],
                          plants: [])
        mockGardenService.createGardenResult = .success(garden)
        mockGardenService.optimizeGardenResult = .success(garden)
        
        // When
        measure {
            let input = GardenViewModel.Input(
                createGarden: Just((area: 100.0, zones: garden.zones, plants: garden.plants)).eraseToAnyPublisher(),
                optimizeGarden: Just(garden).eraseToAnyPublisher(),
                validateGarden: Empty().eraseToAnyPublisher(),
                updateProgress: Empty().eraseToAnyPublisher()
            )
            
            let output = sut.transform(input)
            
            output.garden
                .sink { _ in
                    expectation.fulfill()
                }
                .store(in: &cancellables)
        }
        
        // Then
        wait(for: [expectation], timeout: 3.0) // Verify 3s performance requirement
    }
}

// MARK: - Mock Garden Service

private class MockGardenService: GardenService {
    var createGardenResult: Result<Garden, GardenServiceError>!
    var optimizeGardenResult: Result<Garden, GardenServiceError>!
    var validateGardenResult: Result<ValidationReport, GardenServiceError>!
    
    override func createGarden(area: Double, zones: [Zone], plants: [Plant]) -> Result<Garden, GardenServiceError> {
        return createGardenResult
    }
    
    override func optimizeGarden(_ garden: Garden) -> Result<Garden, GardenServiceError> {
        return optimizeGardenResult
    }
    
    override func validateGardenSetup(_ garden: Garden) -> Result<ValidationReport, GardenServiceError> {
        return validateGardenResult
    }
}