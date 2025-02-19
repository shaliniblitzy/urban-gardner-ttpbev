//
// AppDelegate.swift
// GardenPlanner
//
// Created by Garden Planner Team
// Copyright © 2024 Garden Planner. All rights reserved.
//

import UIKit // iOS 14.0+
import UserNotifications // iOS 14.0+

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    // MARK: - Properties
    
    var window: UIWindow?
    
    private let initializationQueue = DispatchQueue(
        label: "com.gardenplanner.initialization",
        qos: .userInitiated
    )
    
    private let logger = Logger.shared
    private var isInitialized = false
    private var notificationStatus: UNAuthorizationStatus = .notDetermined
    
    // MARK: - Application Lifecycle
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        logger.info("Application launching - Version: \(AppVersion.current)")
        
        // Initialize core services on background queue
        initializationQueue.async { [weak self] in
            guard let self = self else { return }
            
            do {
                // Initialize database
                try DatabaseManager.shared.initialize()
                
                // Perform database migrations if needed
                try DatabaseManager.shared.performMigrations()
                
                // Request notification authorization
                NotificationManager.shared.requestAuthorization { authorized, error in
                    if let error = error {
                        self.logger.error(GardenPlannerError.customError(.notificationDeliveryFailed, error.localizedDescription))
                        self.handleAuthorizationFailure(error)
                    } else {
                        self.notificationStatus = authorized ? .authorized : .denied
                        if authorized {
                            DispatchQueue.main.async {
                                application.registerForRemoteNotifications()
                            }
                        }
                    }
                }
                
                self.isInitialized = true
                self.logger.info("Application initialization completed successfully")
                
            } catch {
                self.logger.error(error)
                self.isInitialized = false
            }
        }
        
        return true
    }
    
    func applicationWillTerminate(_ application: UIApplication) {
        logger.info("Application will terminate")
        
        // Perform cleanup operations
        initializationQueue.sync {
            do {
                // Perform database cleanup
                try DatabaseManager.shared.executeInTransaction {
                    // Save any pending changes
                    try DatabaseManager.shared.performBackup()
                }
                
                // Clear notification cache
                NotificationManager.shared.getPendingNotifications { notifications in
                    notifications.forEach { notification in
                        NotificationManager.shared.cancelNotification(identifier: notification.identifier)
                    }
                }
                
                logger.info("Application cleanup completed successfully")
                
            } catch {
                logger.error(error)
            }
        }
    }
    
    // MARK: - Push Notification Registration
    
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        logger.debug("Registered for remote notifications with token: \(tokenString)")
        
        // Configure notification settings
        let notificationCenter = UNUserNotificationCenter.current()
        notificationCenter.getNotificationSettings { settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional:
                self.notificationStatus = .authorized
                self.configureNotificationSettings()
            case .denied:
                self.notificationStatus = .denied
                self.logger.info("Push notifications denied by user")
            default:
                self.notificationStatus = .notDetermined
            }
        }
    }
    
    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        logger.error(GardenPlannerError.customError(.notificationDeliveryFailed, error.localizedDescription))
        handleAuthorizationFailure(error)
    }
    
    // MARK: - Private Methods
    
    private func configureNotificationSettings() {
        let notificationCenter = UNUserNotificationCenter.current()
        
        // Configure notification categories
        let completeAction = UNNotificationAction(
            identifier: "COMPLETE_TASK",
            title: "Mark Complete",
            options: .foreground
        )
        
        let postponeAction = UNNotificationAction(
            identifier: "POSTPONE_TASK",
            title: "Postpone",
            options: .foreground
        )
        
        let category = UNNotificationCategory(
            identifier: "MAINTENANCE_TASK",
            actions: [completeAction, postponeAction],
            intentIdentifiers: [],
            options: .customDismissAction
        )
        
        notificationCenter.setNotificationCategories([category])
        logger.debug("Notification categories configured")
    }
    
    private func handleAuthorizationFailure(_ error: Error) {
        notificationStatus = .denied
        
        // Post notification for UI update
        NotificationCenter.default.post(
            name: NSNotification.Name("NotificationAuthorizationFailed"),
            object: nil,
            userInfo: ["error": error]
        )
        
        logger.error(GardenPlannerError.customError(.notificationDeliveryFailed, "Authorization failed: \(error.localizedDescription)"))
    }
}