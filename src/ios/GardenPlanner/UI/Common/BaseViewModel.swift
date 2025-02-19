//
// BaseViewModel.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+

/// Base view model class providing common functionality for all view models
/// in the Garden Planner application with enhanced error handling and state management.
@available(iOS 13.0, *)
class BaseViewModel {
    
    // MARK: - Properties
    
    /// Subscription container to prevent memory leaks
    private(set) var disposeBag = Set<AnyCancellable>()
    
    /// Publisher for general error events
    let errorSubject = PassthroughSubject<Void, Never>()
    
    /// Publisher for detailed error information
    let errorDetailsSubject = PassthroughSubject<Error, Never>()
    
    /// Publisher for loading state changes
    let loadingSubject = PassthroughSubject<Bool, Never>()
    
    /// Tracks retry attempts for error recovery
    private(set) var retryAttempts = CurrentValueSubject<Int, Never>(0)
    
    /// Timer for loading state timeout protection
    private var loadingTimeoutTimer: Timer?
    
    /// Loading timeout duration
    private let loadingTimeout: TimeInterval = 30.0
    
    // MARK: - Initialization
    
    init() {
        setupErrorHandling()
    }
    
    deinit {
        loadingTimeoutTimer?.invalidate()
        disposeBag.removeAll()
    }
    
    // MARK: - Error Handling
    
    /// Handles errors with retry mechanism and logging
    /// - Parameters:
    ///   - error: The error to handle
    ///   - shouldRetry: Flag indicating if retry should be attempted
    func handleError(_ error: Error, shouldRetry: Bool = false) {
        Logger.shared.error(error)
        
        if shouldRetry && retryAttempts.value < RetryConfiguration.maxAttempts {
            let nextRetryDelay = TimeInterval(pow(2.0, Double(retryAttempts.value))) * RetryConfiguration.retryInterval
            
            DispatchQueue.main.asyncAfter(deadline: .now() + nextRetryDelay) { [weak self] in
                self?.retryAttempts.send(self?.retryAttempts.value ?? 0 + 1)
                // Subclasses should implement retry logic in transform
            }
        } else {
            setLoading(false)
            errorDetailsSubject.send(error)
            errorSubject.send()
            retryAttempts.send(0)
        }
    }
    
    // MARK: - Loading State Management
    
    /// Updates loading state with timeout protection
    /// - Parameter isLoading: New loading state
    func setLoading(_ isLoading: Bool) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            if isLoading {
                self.configureLoadingTimeout()
            } else {
                self.loadingTimeoutTimer?.invalidate()
                self.loadingTimeoutTimer = nil
            }
            
            self.loadingSubject.send(isLoading)
        }
    }
    
    // MARK: - Private Methods
    
    private func setupErrorHandling() {
        // Reset retry attempts when error is handled
        errorSubject
            .sink { [weak self] _ in
                self?.retryAttempts.send(0)
            }
            .store(in: &disposeBag)
    }
    
    private func configureLoadingTimeout() {
        loadingTimeoutTimer?.invalidate()
        
        loadingTimeoutTimer = Timer.scheduledTimer(withTimeInterval: loadingTimeout, repeats: false) { [weak self] _ in
            guard let self = self else { return }
            
            Logger.shared.warning("Loading timeout occurred after \(self.loadingTimeout) seconds")
            self.setLoading(false)
            
            let timeoutError = GardenPlannerError.customError(.databaseError, "Operation timed out after \(self.loadingTimeout) seconds")
            self.handleError(timeoutError)
        }
    }
}