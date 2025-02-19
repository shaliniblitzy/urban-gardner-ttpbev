//
// LayoutViewModelTests.swift
// GardenPlannerTests
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import XCTest
import Combine
@testable import GardenPlanner

@available(iOS 13.0, *)
class LayoutViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: LayoutViewModel!
    private var mockGarden: Garden!
    private var mockOptimizer: GardenOptimizer!
    private var cancellables: Set<AnyCancellable>!
    private var testQueue: DispatchQueue!
    private var optimizationExpectation: XCTestExpectation!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        
        // Initialize thread-safe test queue
        testQueue = DispatchQueue(label: "com.gardenplanner.tests.layout",
                                qos: .userInitiated,
                                attributes: .concurrent)
        
        // Create mock garden with controlled test data
        mockGarden = Garden(
            id: "test_garden_1",
            area: 100.0,
            zones: [
                Zone(id: "zone_1", area: 50.0, sunlightCondition: SunlightConditions.fullSun),
                Zone(id: "zone_2", area: 50.0, sunlightCondition: SunlightConditions.partialShade)
            ],
            plants: []
        )
        
        // Initialize mock optimizer
        mockOptimizer = GardenOptimizer(garden: mockGarden)
        
        // Create view model under test
        sut = LayoutViewModel(garden: mockGarden)
        
        // Initialize cancellables set
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        // Cancel all subscriptions
        cancellables.forEach { $0.cancel() }
        cancellables = nil
        
        // Clear references
        sut = nil
        mockGarden = nil
        mockOptimizer = nil
        optimizationExpectation = nil
        testQueue = nil
        
        super.tearDown()
    }
    
    // MARK: - Initial State Tests
    
    func testInitialState() {
        // Verify initial published properties
        XCTAssertEqual(sut.garden?.id, mockGarden.id)
        XCTAssertTrue(sut.optimizedLayout.isEmpty)
        XCTAssertEqual(sut.utilizationScore, 0.0)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
    }
    
    // MARK: - Layout Generation Tests
    
    func testGenerateOptimizedLayout() {
        // Set up expectations
        optimizationExpectation = expectation(description: "Layout optimization completed")
        let performanceExpectation = expectation(description: "Performance requirements met")
        
        // Start performance metrics
        let startTime = Date()
        
        // Subscribe to optimization result
        sut.generateOptimizedLayout()
            .sink(receiveCompletion: { completion in
                switch completion {
                case .finished:
                    self.optimizationExpectation.fulfill()
                case .failure(let error):
                    XCTFail("Optimization failed with error: \(error)")
                }
            }, receiveValue: { success in
                XCTAssertTrue(success)
                
                // Verify optimization completed within 3 seconds
                let duration = Date().timeIntervalSince(startTime)
                XCTAssertLessThanOrEqual(duration, 3.0)
                
                // Verify layout data
                XCTAssertFalse(self.sut.optimizedLayout.isEmpty)
                XCTAssertGreaterThanOrEqual(self.sut.utilizationScore, 30.0)
                
                performanceExpectation.fulfill()
            })
            .store(in: &cancellables)
        
        // Verify loading state transitions
        XCTAssertTrue(sut.isLoading)
        
        wait(for: [optimizationExpectation, performanceExpectation], timeout: 5.0)
        XCTAssertFalse(sut.isLoading)
    }
    
    // MARK: - Concurrent Operation Tests
    
    func testConcurrentOperations() {
        // Set up expectations for multiple concurrent requests
        let concurrentExpectation = expectation(description: "Concurrent operations completed")
        concurrentExpectation.expectedFulfillmentCount = 3
        
        // Track optimization results
        var completedOperations = 0
        let operationLock = NSLock()
        
        // Execute multiple concurrent optimization requests
        for _ in 0..<3 {
            testQueue.async {
                self.sut.generateOptimizedLayout()
                    .sink(receiveCompletion: { completion in
                        switch completion {
                        case .finished:
                            operationLock.lock()
                            completedOperations += 1
                            operationLock.unlock()
                            concurrentExpectation.fulfill()
                        case .failure(let error):
                            XCTFail("Concurrent operation failed: \(error)")
                        }
                    }, receiveValue: { success in
                        XCTAssertTrue(success)
                    })
                    .store(in: &self.cancellables)
            }
        }
        
        wait(for: [concurrentExpectation], timeout: 10.0)
        
        // Verify all operations completed successfully
        XCTAssertEqual(completedOperations, 3)
        XCTAssertFalse(sut.optimizedLayout.isEmpty)
        XCTAssertGreaterThanOrEqual(sut.utilizationScore, 30.0)
    }
    
    // MARK: - Error Handling Tests
    
    func testErrorHandling() {
        // Set up invalid garden data
        let invalidGarden = Garden(
            id: "invalid_garden",
            area: 0.0, // Invalid area
            zones: [],
            plants: []
        )
        sut = LayoutViewModel(garden: invalidGarden)
        
        // Set up expectation
        let errorExpectation = expectation(description: "Error handled correctly")
        
        // Attempt optimization with invalid data
        sut.generateOptimizedLayout()
            .sink(receiveCompletion: { completion in
                switch completion {
                case .finished:
                    XCTFail("Optimization should fail with invalid garden")
                case .failure(let error):
                    // Verify correct error handling
                    XCTAssertEqual(error, LayoutViewModel.LayoutOptimizationError.invalidGarden)
                    errorExpectation.fulfill()
                }
            }, receiveValue: { _ in
                XCTFail("Should not receive success value")
            })
            .store(in: &cancellables)
        
        wait(for: [errorExpectation], timeout: 5.0)
        
        // Verify error state
        XCTAssertNotNil(sut.error)
        XCTAssertFalse(sut.isLoading)
        XCTAssertTrue(sut.optimizedLayout.isEmpty)
    }
    
    // MARK: - Memory Management Tests
    
    func testMemoryManagement() {
        // Create weak reference to view model
        weak var weakSut: LayoutViewModel?
        
        // Create autoreleasepool for controlled memory testing
        autoreleasepool {
            let temporarySut = LayoutViewModel(garden: mockGarden)
            weakSut = temporarySut
            XCTAssertNotNil(weakSut)
        }
        
        // Verify proper cleanup
        XCTAssertNil(weakSut, "LayoutViewModel should be deallocated")
    }
}