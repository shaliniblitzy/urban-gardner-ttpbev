//
// ScheduleViewModel.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation // iOS 14.0+
import Combine // iOS 14.0+

/// Thread-safe view model implementing MVVM architecture for schedule management
/// with enhanced performance optimizations and error handling.
@available(iOS 14.0, *)
final class ScheduleViewModel: ViewModelType {
    
    // MARK: - Types
    
    /// Input events from view layer
    struct Input {
        /// Trigger to load schedules when view appears
        let viewDidLoad: AnyPublisher<Void, Never>
        /// Event when schedule is completed
        let scheduleCompleted: AnyPublisher<Schedule, Never>
        /// Event when notification preferences are updated
        let notificationPreferencesUpdated: AnyPublisher<NotificationPreferences, Never>
    }
    
    /// Output events for view consumption
    struct Output {
        /// Current schedules with loading state
        let schedules: AnyPublisher<[Schedule], Never>
        /// Error events for user display
        let error: AnyPublisher<Error, Never>
        /// Loading state for UI updates
        let isLoading: AnyPublisher<Bool, Never>
    }
    
    // MARK: - Properties
    
    private let scheduleService: ScheduleService
    private let scheduleLock = NSLock()
    private let viewDidLoadSubject = PassthroughSubject<Void, Never>()
    private let scheduleCompletedSubject = PassthroughSubject<Schedule, Never>()
    private let notificationPreferencesSubject = PassthroughSubject<NotificationPreferences, Never>()
    private let schedulesSubject = CurrentValueSubject<[Schedule], Never>([])
    private let errorSubject = PassthroughSubject<Error, Never>()
    private let loadingSubject = CurrentValueSubject<Bool, Never>(false)
    
    private var cancellables = Set<AnyCancellable>()
    private let scheduleCache = NSCache<NSString, NSArray>()
    private let notificationQueue: DispatchQueue
    private let performanceMonitor = PerformanceMonitor()
    
    // MARK: - Initialization
    
    /// Initializes view model with required dependencies
    /// - Parameter scheduleService: Service for schedule management
    init(scheduleService: ScheduleService) {
        self.scheduleService = scheduleService
        self.notificationQueue = DispatchQueue(
            label: "com.gardenplanner.schedule.notifications",
            qos: .userInitiated
        )
        
        // Configure cache limits
        scheduleCache.countLimit = 100
        
        setupPerformanceMonitoring()
    }
    
    // MARK: - ViewModelType Implementation
    
    /// Transforms input events into output data with enhanced error handling
    /// - Parameter input: Input events from view layer
    /// - Returns: Transformed output for view consumption
    func transform(_ input: Input) -> Output {
        // Handle view load events
        input.viewDidLoad
            .handleEvents(receiveOutput: { [weak self] _ in
                self?.loadingSubject.send(true)
            })
            .flatMap { [weak self] _ -> AnyPublisher<[Schedule], Error> in
                guard let self = self else {
                    return Empty().eraseToAnyPublisher()
                }
                return Future { promise in
                    self.loadSchedules { result in
                        switch result {
                        case .success(let schedules):
                            promise(.success(schedules))
                        case .failure(let error):
                            promise(.failure(error))
                        }
                    }
                }.eraseToAnyPublisher()
            }
            .catch { [weak self] error -> AnyPublisher<[Schedule], Never> in
                self?.errorSubject.send(error)
                return Just([]).eraseToAnyPublisher()
            }
            .handleEvents(receiveOutput: { [weak self] _ in
                self?.loadingSubject.send(false)
            })
            .subscribe(schedulesSubject)
            .store(in: &cancellables)
        
        // Handle schedule completion
        input.scheduleCompleted
            .throttle(for: .milliseconds(500), scheduler: DispatchQueue.main, latest: true)
            .sink { [weak self] schedule in
                self?.completeSchedule(schedule)
            }
            .store(in: &cancellables)
        
        // Handle notification preference updates
        input.notificationPreferencesUpdated
            .receive(on: notificationQueue)
            .sink { [weak self] preferences in
                self?.updateNotificationPreferences(preferences)
            }
            .store(in: &cancellables)
        
        return Output(
            schedules: schedulesSubject.eraseToAnyPublisher(),
            error: errorSubject.eraseToAnyPublisher(),
            isLoading: loadingSubject.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func loadSchedules(completion: @escaping (Result<[Schedule], Error>) -> Void) {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        let perfStartTime = Date()
        
        // Check cache first
        if let cachedSchedules = scheduleCache.object(forKey: "all_schedules") as? [Schedule] {
            performanceMonitor.logMetric("cache_hit", Date().timeIntervalSince(perfStartTime))
            completion(.success(cachedSchedules))
            return
        }
        
        // Fetch from service if cache miss
        switch scheduleService.getOverdueSchedules() {
        case let schedules:
            // Sort by priority and due date
            let sortedSchedules = schedules.sorted { schedule1, schedule2 in
                if schedule1.dueDate == schedule2.dueDate {
                    return schedule1.taskType == "WATERING"
                }
                return schedule1.dueDate < schedule2.dueDate
            }
            
            // Update cache
            scheduleCache.setObject(sortedSchedules as NSArray, forKey: "all_schedules")
            performanceMonitor.logMetric("schedule_load", Date().timeIntervalSince(perfStartTime))
            
            completion(.success(sortedSchedules))
        }
    }
    
    private func completeSchedule(_ schedule: Schedule) {
        scheduleLock.lock()
        defer { scheduleLock.unlock() }
        
        let result = scheduleService.completeSchedule(schedule)
        
        switch result {
        case .success(let nextSchedule):
            var currentSchedules = schedulesSubject.value
            
            // Remove completed schedule
            currentSchedules.removeAll { $0.id == schedule.id }
            
            // Add next schedule if recurring
            if let nextSchedule = nextSchedule {
                currentSchedules.append(nextSchedule)
            }
            
            // Sort and update
            let sortedSchedules = currentSchedules.sorted { $0.dueDate < $1.dueDate }
            scheduleCache.setObject(sortedSchedules as NSArray, forKey: "all_schedules")
            schedulesSubject.send(sortedSchedules)
            
        case .failure(let error):
            errorSubject.send(error)
        }
    }
    
    private func updateNotificationPreferences(_ preferences: NotificationPreferences) {
        let result = scheduleService.updateNotificationPreferences(preferences)
        
        switch result {
        case .success:
            // Reload schedules to reflect changes
            loadSchedules { [weak self] result in
                switch result {
                case .success(let schedules):
                    self?.schedulesSubject.send(schedules)
                case .failure(let error):
                    self?.errorSubject.send(error)
                }
            }
            
        case .failure(let error):
            errorSubject.send(error)
        }
    }
    
    private func setupPerformanceMonitoring() {
        performanceMonitor.setThreshold("schedule_load", threshold: 3.0)
        performanceMonitor.setThreshold("cache_hit", threshold: 0.1)
        
        performanceMonitor.onThresholdExceeded = { [weak self] (metric, value, threshold) in
            self?.errorSubject.send(GardenPlannerError.customError(
                .scheduleGenerationFailed,
                "Performance threshold exceeded for \(metric): \(value)s (threshold: \(threshold)s)"
            ))
        }
    }
}

// MARK: - Performance Monitoring

private final class PerformanceMonitor {
    private var thresholds: [String: TimeInterval] = [:]
    var onThresholdExceeded: ((String, TimeInterval, TimeInterval) -> Void)?
    
    func setThreshold(_ metric: String, threshold: TimeInterval) {
        thresholds[metric] = threshold
    }
    
    func logMetric(_ metric: String, _ value: TimeInterval) {
        if let threshold = thresholds[metric], value > threshold {
            onThresholdExceeded?(metric, value, threshold)
        }
    }
}