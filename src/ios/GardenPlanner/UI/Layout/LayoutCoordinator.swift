//
// LayoutCoordinator.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit
import Combine

/// A coordinator responsible for managing the garden layout feature flow and navigation
/// with comprehensive error handling and performance monitoring.
@available(iOS 13.0, *)
public final class LayoutCoordinator: BaseCoordinator {
    
    // MARK: - Properties
    
    private var garden: Garden?
    private var layoutViewModel: LayoutViewModel?
    private var layoutViewController: LayoutViewController?
    private let performanceMonitor: PerformanceMonitor
    private let errorHandler: ErrorHandler
    private var cancellables = Set<AnyCancellable>()
    private var layoutCompletionCallback: ((Result<Void, Error>) -> Void)?
    
    // MARK: - Initialization
    
    /// Initializes the layout coordinator with required dependencies
    /// - Parameters:
    ///   - navigationController: Navigation controller for managing view hierarchy
    ///   - garden: Garden instance to optimize
    ///   - performanceMonitor: Monitor for tracking performance metrics
    ///   - errorHandler: Handler for managing error states
    public init(navigationController: UINavigationController,
               garden: Garden,
               performanceMonitor: PerformanceMonitor,
               errorHandler: ErrorHandler) {
        self.garden = garden
        self.performanceMonitor = performanceMonitor
        self.errorHandler = errorHandler
        
        super.init(navigationController: navigationController)
        
        Logger.shared.debug("Initialized LayoutCoordinator for garden: \(garden.id)")
    }
    
    // MARK: - Coordinator Methods
    
    /// Starts the layout feature flow with performance tracking
    public override func start() {
        performanceMonitor.startTracking(operation: "layout_flow")
        
        guard let garden = garden else {
            handleError(GardenPlannerError.customError(.invalidGarden, "No garden available"))
            return
        }
        
        // Initialize view model
        layoutViewModel = LayoutViewModel(garden: garden)
        
        // Initialize view controller
        layoutViewController = LayoutViewController(viewModel: layoutViewModel!)
        
        // Configure navigation items
        layoutViewController?.navigationItem.leftBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "chevron.left"),
            style: .plain,
            target: self,
            action: #selector(handleBackButton)
        )
        
        layoutViewController?.navigationItem.rightBarButtonItem = UIBarButtonItem(
            image: UIImage(systemName: "arrow.clockwise"),
            style: .plain,
            target: self,
            action: #selector(handleRegenerateLayout)
        )
        
        // Set up error handling
        setupErrorHandling()
        
        // Push view controller
        navigationController.pushViewController(layoutViewController!, animated: true)
        
        // Set up performance monitoring
        setupPerformanceMonitoring()
        
        Logger.shared.debug("Started layout flow for garden: \(garden.id)")
    }
    
    /// Cleans up resources and subscriptions
    public func cleanupResources() {
        cancellables.removeAll()
        layoutViewModel = nil
        layoutViewController = nil
        performanceMonitor.stopTracking(operation: "layout_flow")
        
        Logger.shared.debug("Cleaned up layout coordinator resources")
    }
    
    // MARK: - Private Methods
    
    private func setupErrorHandling() {
        layoutViewModel?.$error
            .compactMap { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.handleError(error)
            }
            .store(in: &cancellables)
    }
    
    private func setupPerformanceMonitoring() {
        layoutViewModel?.$performanceMetrics
            .compactMap { $0 }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] metrics in
                self?.performanceMonitor.logMetrics(
                    operation: "layout_optimization",
                    metrics: [
                        "duration": metrics.optimizationDuration,
                        "utilization": metrics.spaceUtilization,
                        "sunlight_score": metrics.sunlightScore,
                        "compatibility": metrics.plantCompatibility,
                        "memory_usage": metrics.memoryUsage
                    ]
                )
            }
            .store(in: &cancellables)
    }
    
    private func handleError(_ error: Error) {
        errorHandler.handle(error) { [weak self] retryAction in
            switch retryAction {
            case .retry:
                self?.handleRegenerateLayout()
            case .cancel:
                self?.navigationController.popViewController(animated: true)
            case .ignore:
                break
            }
        }
        
        layoutCompletionCallback?(.failure(error))
        Logger.shared.error(error)
    }
    
    @objc private func handleBackButton() {
        navigationController.popViewController(animated: true)
        cleanupResources()
    }
    
    @objc private func handleRegenerateLayout() {
        performanceMonitor.startTracking(operation: "layout_regeneration")
        
        layoutViewModel?.generateOptimizedLayout()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                guard let self = self else { return }
                
                self.performanceMonitor.stopTracking(operation: "layout_regeneration")
                
                if case .failure(let error) = completion {
                    self.handleError(error)
                }
            } receiveValue: { [weak self] success in
                if success {
                    self?.layoutCompletionCallback?(.success(()))
                    
                    // Announce success for accessibility
                    UIAccessibility.post(
                        notification: .announcement,
                        argument: "Garden layout successfully regenerated"
                    )
                }
            }
            .store(in: &cancellables)
    }
}

// MARK: - Error Handler

private class ErrorHandler {
    enum RetryAction {
        case retry
        case cancel
        case ignore
    }
    
    func handle(_ error: Error, completion: @escaping (RetryAction) -> Void) {
        let alert = UIAlertController(
            title: "Layout Error",
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        
        if GardenPlannerError.shouldRetry(error) {
            alert.addAction(UIAlertAction(title: "Retry", style: .default) { _ in
                completion(.retry)
            })
        }
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            completion(.cancel)
        })
        
        if let topViewController = UIApplication.shared.windows.first?.rootViewController {
            topViewController.present(alert, animated: true)
        }
    }
}

// MARK: - Performance Monitor

private class PerformanceMonitor {
    private var operations: [String: CFAbsoluteTime] = [:]
    private let logger = Logger.shared
    
    func startTracking(operation: String) {
        operations[operation] = CFAbsoluteTimeGetCurrent()
    }
    
    func stopTracking(operation: String) {
        guard let startTime = operations[operation] else { return }
        
        let duration = CFAbsoluteTimeGetCurrent() - startTime
        logger.debug("Operation \(operation) completed in \(String(format: "%.3f", duration))s")
        
        operations.removeValue(forKey: operation)
    }
    
    func logMetrics(operation: String, metrics: [String: Double]) {
        logger.debug("Performance metrics for \(operation): \(metrics)")
    }
}