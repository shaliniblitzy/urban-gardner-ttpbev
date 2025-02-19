//
// AppConstants.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import Foundation

/// Defines current app version information and compatibility settings
enum AppVersion {
    /// Current app version string (Semantic Versioning)
    static let current = "1.0.0"
    
    /// Current build number
    static let build = 1
    
    /// Minimum supported app version
    static let minimumSupported = "1.0.0"
}

/// Constants for garden area and zone validation
enum GardenValidation {
    /// Minimum allowed garden area in square feet (1 sq ft)
    static let minArea = 1
    
    /// Maximum allowed garden area in square feet (1000 sq ft)
    static let maxArea = 1000
    
    /// Default size for a garden zone in square feet
    static let defaultZoneSize = 25
    
    /// Maximum number of allowed zones per garden
    static let maxZones = 10
}

/// Notification delivery and scheduling preferences
enum NotificationPreferences {
    /// Default reminder time (9:00 AM)
    static let defaultReminderTime: Date = {
        var components = DateComponents()
        components.hour = 9
        components.minute = 0
        return Calendar.current.date(from: components) ?? Date()
    }()
    
    /// Minimum interval between notifications (15 minutes)
    static let minimumInterval: TimeInterval = 15 * 60
    
    /// Maximum number of notifications per day
    static let maximumDailyNotifications = 10
    
    /// Number of retry attempts for failed notifications
    static let retryAttempts = 3
}

/// Database configuration and storage settings
enum DatabaseConstants {
    /// SQLite database file name
    static let fileName = "GardenPlanner.sqlite"
    
    /// Current database schema version
    static let version = 1
    
    /// Maximum database storage size (100MB)
    static let maxStorageSize: Int64 = 100 * 1024 * 1024
    
    /// Database backup interval (24 hours)
    static let backupInterval: TimeInterval = 24 * 60 * 60
}

/// Garden sunlight condition definitions
enum SunlightConditions {
    /// Full sun condition identifier
    static let fullSun = "FULL_SUN"
    
    /// Partial shade condition identifier
    static let partialShade = "PARTIAL_SHADE"
    
    /// Full shade condition identifier
    static let fullShade = "FULL_SHADE"
    
    /// Minimum hours of sunlight required for full sun (6 hours)
    static let minSunlightHours = 6
    
    /// Maximum tracked hours of sunlight (12 hours)
    static let maxSunlightHours = 12
}

/// Schedule and task management configuration
enum ScheduleConstants {
    /// Maximum number of days to schedule ahead
    static let maxScheduleDays = 365
    
    /// Minimum interval between tasks (30 minutes)
    static let minTaskInterval: TimeInterval = 30 * 60
    
    /// Maximum number of concurrent tasks
    static let maxConcurrentTasks = 5
    
    /// Default duration for a maintenance task (15 minutes)
    static let defaultTaskDuration: TimeInterval = 15 * 60
}