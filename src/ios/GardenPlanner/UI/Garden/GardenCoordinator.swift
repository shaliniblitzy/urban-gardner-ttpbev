//
// GardenCoordinator.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit

/// Thread-safe coordinator responsible for managing the garden setup and optimization navigation flow
/// with comprehensive performance monitoring and state restoration.
@available(iOS 14.0, *)
public class GardenCoordinator: Coordinator {
    
    // MARK: - Properties
    
    public var navigationController: UINavigationController
    private let coordinatorLock = NSLock()
    private(set) public var childCoordinators: [Coordinator]
    private let gardenService: GardenService
    private let performanceMonitor: PerformanceMonitor
    private let errorHandler: ErrorHandler
    private let stateRestoration: StateRestoration
    
    // MARK: - Initialization
    
    /// Initializes the garden coordinator with required dependencies and performance monitoring
    /// - Parameters:
    ///   - navigationController: Navigation controller for managing view hierarchy
    ///   - gardenService: Service for garden-related operations
    ///   - performanceMonitor: Monitor for tracking navigation performance
    ///   - errorHandler: Handler for coordinator-level errors
    public init(
        navigationController: UINavigationController,
        gardenService: GardenService,
        performanceMonitor: PerformanceMonitor,
        errorHandler: ErrorHandler
    ) {
        self.navigationController = navigationController
        self.childCoordinators = []
        self.gardenService = gardenService
        self.performanceMonitor = performanceMonitor
        self.errorHandler = errorHandler
        self.stateRestoration = StateRestoration()
        
        // Configure performance monitoring
        performanceMonitor.configure(
            subsystem: "com.gardenplanner.coordinator",
            category: "garden_navigation"
        )
    }
    
    // MARK: - Coordinator Protocol Implementation
    
    public weak var parentCoordinator: Coordinator?
    
    /// Starts the garden setup and optimization flow with performance tracking
    public func start() {
        performanceMonitor.begin(operation: "garden_flow_start")
        
        // Create view model with dependencies
        let viewModel = GardenViewModel(
            gardenService: gardenService,
            performanceMonitor: performanceMonitor
        )
        
        // Initialize garden view controller
        let gardenViewController = GardenViewController(viewModel: viewModel)
        gardenViewController.title = "Garden Setup"
        
        // Configure navigation items
        let closeButton = UIBarButtonItem(
            barButtonSystemItem: .close,
            target: self,
            action: #selector(handleClose)
        )
        gardenViewController.navigationItem.leftBarButtonItem = closeButton
        
        // Setup accessibility
        gardenViewController.navigationItem.leftBarButtonItem?.accessibilityLabel = "Close garden setup"
        gardenViewController.navigationItem.leftBarButtonItem?.accessibilityHint = "Closes the garden setup screen"
        
        // Configure state restoration
        stateRestoration.register(viewController: gardenViewController, with: "GardenViewController")
        
        // Push view controller with animation
        navigationController.pushViewController(gardenViewController, animated: true)
        
        performanceMonitor.end(operation: "garden_flow_start")
    }
    
    /// Cleans up coordinator resources and notifies parent
    public func finish() {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        // Remove child coordinators
        childCoordinators.forEach { $0.finish() }
        childCoordinators.removeAll()
        
        // Save state
        stateRestoration.saveState()
        
        // Notify parent coordinator
        parentCoordinator?.removeChildCoordinator(self)
    }
    
    // MARK: - Navigation Methods
    
    /// Thread-safe navigation to the garden layout screen with performance monitoring
    /// - Parameter garden: Garden instance to display layout for
    public func showGardenLayout(_ garden: Garden) {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        performanceMonitor.begin(operation: "show_garden_layout")
        
        // Validate garden data
        guard case .success = garden.validate() else {
            errorHandler.handle(GardenPlannerError.invalidInput(.invalidGardenDimensions))
            return
        }
        
        // Create layout view model
        let layoutViewModel = GardenLayoutViewModel(
            garden: garden,
            performanceMonitor: performanceMonitor
        )
        
        // Initialize layout view controller
        let layoutViewController = GardenLayoutViewController(
            viewModel: layoutViewModel,
            errorHandler: errorHandler
        )
        layoutViewController.title = "Garden Layout"
        
        // Configure accessibility
        layoutViewController.view.accessibilityIdentifier = "GardenLayoutView"
        
        // Push with custom transition
        let transition = CATransition()
        transition.duration = 0.3
        transition.type = .push
        transition.subtype = .fromRight
        navigationController.view.layer.add(transition, forKey: nil)
        
        navigationController.pushViewController(layoutViewController, animated: false)
        
        performanceMonitor.end(operation: "show_garden_layout")
    }
    
    /// Thread-safe navigation to maintenance schedule with error recovery
    /// - Parameter garden: Garden instance to create schedule for
    public func showSchedule(_ garden: Garden) {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        performanceMonitor.begin(operation: "show_schedule")
        
        // Validate garden data
        guard case .success = garden.validate() else {
            errorHandler.handle(GardenPlannerError.invalidInput(.invalidGardenDimensions))
            return
        }
        
        // Create and configure schedule coordinator
        let scheduleCoordinator = ScheduleCoordinator(
            navigationController: navigationController,
            garden: garden,
            errorHandler: errorHandler
        )
        scheduleCoordinator.parentCoordinator = self
        
        // Add to child coordinators with thread safety
        childCoordinators.append(scheduleCoordinator)
        
        // Configure state restoration
        stateRestoration.register(coordinator: scheduleCoordinator, with: "ScheduleCoordinator")
        
        // Start schedule flow
        scheduleCoordinator.start()
        
        performanceMonitor.end(operation: "show_schedule")
    }
    
    // MARK: - Private Methods
    
    @objc private func handleClose() {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        performanceMonitor.begin(operation: "handle_close")
        
        // Show confirmation alert
        AlertManager.shared.showActionSheet(
            title: "Close Garden Setup",
            message: "Are you sure you want to close the garden setup? Any unsaved changes will be lost.",
            actions: [
                AlertAction(
                    title: "Close",
                    style: .destructive,
                    handler: { [weak self] in
                        self?.cleanup()
                    }
                )
            ],
            from: navigationController.topViewController!
        )
        
        performanceMonitor.end(operation: "handle_close")
    }
    
    /// Performs proper cleanup of coordinator resources
    private func cleanup() {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        // Remove child coordinators
        childCoordinators.forEach { $0.finish() }
        childCoordinators.removeAll()
        
        // Clear navigation stack
        navigationController.popToRootViewController(animated: true)
        
        // Save state
        stateRestoration.saveState()
        
        // Release resources
        performanceMonitor.end(operation: "coordinator_cleanup")
        
        // Notify parent coordinator
        finish()
    }
}