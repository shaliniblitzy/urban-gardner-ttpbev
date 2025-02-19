//
// SceneDelegate.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit

/// Scene delegate class responsible for managing UI scene lifecycle events, configuring
/// the initial view hierarchy, and implementing performance monitoring.
@available(iOS 14.0, *)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    
    // MARK: - Properties
    
    var window: UIWindow?
    private var coordinator: GardenCoordinator?
    private var isRestoringState: Bool = false
    private let performanceMonitor = PerformanceMonitor()
    private let errorHandler = ErrorHandler()
    
    // MARK: - Scene Lifecycle
    
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        performanceMonitor.begin(operation: "scene_setup")
        
        guard let windowScene = (scene as? UIWindowScene) else {
            Logger.shared.error(GardenPlannerError.systemError(NSError(domain: "SceneSetup", code: -1)))
            return
        }
        
        // Create and configure main window
        window = UIWindow(windowScene: windowScene)
        window?.backgroundColor = .systemBackground
        
        // Create navigation controller with restoration support
        let navigationController = UINavigationController()
        navigationController.restorationIdentifier = "MainNavigationController"
        
        // Configure error handler
        errorHandler.configure(
            retryAttempts: RetryConfiguration.maxAttempts,
            retryInterval: RetryConfiguration.retryInterval
        )
        
        // Initialize garden coordinator
        coordinator = GardenCoordinator(
            navigationController: navigationController,
            gardenService: GardenService.shared,
            performanceMonitor: performanceMonitor,
            errorHandler: errorHandler
        )
        
        // Configure error handling for coordinator
        coordinator?.errorHandler = { [weak self] error in
            guard let self = self else { return }
            AlertManager.shared.showError(error, from: self.window?.rootViewController) {
                // Retry coordinator start on error
                self.coordinator?.start()
            }
        }
        
        // Start coordinator flow with retry mechanism
        do {
            try retryOperation(
                maxAttempts: RetryConfiguration.maxAttempts,
                operation: { [weak self] in
                    self?.coordinator?.start()
                }
            )
        } catch {
            Logger.shared.error(error)
            AlertManager.shared.showError(error, from: window?.rootViewController)
        }
        
        // Configure window root and make visible
        window?.rootViewController = navigationController
        window?.makeKeyAndVisible()
        
        // Handle any state restoration
        if let userActivity = connectionOptions.userActivities.first {
            self.scene(scene, continue: userActivity)
        }
        
        performanceMonitor.end(operation: "scene_setup")
    }
    
    func sceneDidDisconnect(_ scene: UIScene) {
        performanceMonitor.begin(operation: "scene_cleanup")
        
        // Save current state
        if let userActivity = window?.rootViewController?.view.window?.windowScene?.userActivity {
            GardenService.shared.saveState(userActivity)
        }
        
        // Perform coordinator cleanup
        coordinator?.cleanup()
        coordinator = nil
        
        // Clear window reference
        window = nil
        
        performanceMonitor.end(operation: "scene_cleanup")
    }
    
    func sceneDidBecomeActive(_ scene: UIScene) {
        performanceMonitor.begin(operation: "scene_activation")
        
        // Restore previous state if needed
        if isRestoringState {
            coordinator?.start()
            isRestoringState = false
        }
        
        // Resume coordinator activities
        coordinator?.resume()
        
        // Update UI accessibility state
        window?.rootViewController?.view.accessibilityElementsHidden = false
        
        performanceMonitor.end(operation: "scene_activation")
    }
    
    func sceneWillResignActive(_ scene: UIScene) {
        performanceMonitor.begin(operation: "scene_deactivation")
        
        // Save current state
        if let userActivity = window?.rootViewController?.view.window?.windowScene?.userActivity {
            GardenService.shared.saveState(userActivity)
        }
        
        // Pause ongoing activities
        coordinator?.pause()
        
        // Update accessibility announcements
        UIAccessibility.post(notification: .screenChanged, argument: "Garden Planner is now in background")
        
        performanceMonitor.end(operation: "scene_deactivation")
    }
    
    // MARK: - State Restoration
    
    func stateRestorationActivity(for scene: UIScene) -> NSUserActivity? {
        performanceMonitor.begin(operation: "state_restoration")
        
        guard let windowScene = scene as? UIWindowScene,
              let userActivity = windowScene.userActivity else {
            performanceMonitor.end(operation: "state_restoration")
            return nil
        }
        
        // Add scene state to activity
        userActivity.addUserInfoEntries(from: [
            "timestamp": Date().timeIntervalSince1970,
            "version": AppVersion.current
        ])
        
        performanceMonitor.end(operation: "state_restoration")
        return userActivity
    }
    
    // MARK: - Private Methods
    
    private func retryOperation(maxAttempts: Int, operation: @escaping () -> Void) throws {
        var attempts = 0
        var lastError: Error?
        
        repeat {
            do {
                operation()
                return
            } catch {
                lastError = error
                attempts += 1
                if attempts < maxAttempts {
                    Thread.sleep(forTimeInterval: RetryConfiguration.retryInterval)
                }
            }
        } while attempts < maxAttempts
        
        if let error = lastError {
            throw error
        }
    }
}

// MARK: - Error Handler

private class ErrorHandler {
    private var maxRetryAttempts: Int = 3
    private var retryInterval: TimeInterval = 5.0
    
    func configure(retryAttempts: Int, retryInterval: TimeInterval) {
        self.maxRetryAttempts = retryAttempts
        self.retryInterval = retryInterval
    }
    
    func handle(_ error: Error) {
        Logger.shared.error(error)
        
        if let gardenError = error as? GardenPlannerError,
           GardenPlannerError.shouldRetry(gardenError) {
            // Implement retry logic
            retryOperation(maxAttempts: maxRetryAttempts) {
                // Retry operation
            }
        }
    }
    
    private func retryOperation(maxAttempts: Int, operation: @escaping () -> Void) {
        var attempts = 0
        
        repeat {
            operation()
            attempts += 1
            if attempts < maxAttempts {
                Thread.sleep(forTimeInterval: retryInterval)
            }
        } while attempts < maxAttempts
    }
}