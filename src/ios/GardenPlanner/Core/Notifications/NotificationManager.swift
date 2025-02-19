import UserNotifications
import Foundation

/// Thread-safe singleton class managing local notifications for garden maintenance tasks
final class NotificationManager {
    
    // MARK: - Constants
    
    private let NOTIFICATION_CATEGORY_MAINTENANCE = "com.gardenplanner.notification.maintenance"
    private let MAX_PENDING_NOTIFICATIONS = 64
    private let NOTIFICATION_QUEUE = DispatchQueue(label: "com.gardenplanner.notification.queue", qos: .userInitiated)
    
    // MARK: - Properties
    
    /// Shared instance of the NotificationManager
    static let shared = NotificationManager()
    
    private let notificationCenter: UNUserNotificationCenter
    private var isNotificationsAuthorized = false
    private var categories: [String: UNNotificationCategory] = [:]
    private let notificationQueue: DispatchQueue
    private let notificationCache: NSCache<NSString, UNNotificationRequest>
    
    // MARK: - Initialization
    
    private init() {
        notificationCenter = UNUserNotificationCenter.current()
        notificationQueue = NOTIFICATION_QUEUE
        
        notificationCache = NSCache<NSString, UNNotificationRequest>()
        notificationCache.countLimit = MAX_PENDING_NOTIFICATIONS
        
        setupNotificationCategories()
        checkAuthorizationStatus()
    }
    
    // MARK: - Public Methods
    
    /// Requests notification permissions with enhanced error handling
    /// - Parameter completion: Callback with authorization result and potential error
    func requestAuthorization(completion: @escaping (Bool, Error?) -> Void) {
        let options: UNAuthorizationOptions = [.alert, .sound, .badge]
        
        notificationCenter.requestAuthorization(options: options) { [weak self] granted, error in
            guard let self = self else { return }
            
            self.notificationQueue.async {
                self.isNotificationsAuthorized = granted
                
                if let error = error {
                    Logger.shared.error(GardenPlannerError.customError(.notificationDeliveryFailed, error.localizedDescription))
                    completion(false, error)
                    return
                }
                
                if granted {
                    Logger.shared.debug("Notification authorization granted")
                    self.registerNotificationCategories()
                } else {
                    Logger.shared.debug("Notification authorization denied")
                }
                
                DispatchQueue.main.async {
                    completion(granted, nil)
                }
            }
        }
    }
    
    /// Schedules a local notification with delivery validation and caching
    /// - Parameters:
    ///   - identifier: Unique identifier for the notification
    ///   - title: Notification title
    ///   - body: Notification body text
    ///   - date: Scheduled delivery date
    ///   - userInfo: Optional additional data
    ///   - completion: Callback with potential error
    func scheduleNotification(
        identifier: String,
        title: String,
        body: String,
        date: Date,
        userInfo: [String: Any]? = nil,
        completion: @escaping (Error?) -> Void
    ) {
        guard isNotificationsAuthorized else {
            completion(GardenPlannerError.customError(.notificationDeliveryFailed, "Notifications not authorized"))
            return
        }
        
        notificationQueue.async { [weak self] in
            guard let self = self else { return }
            
            // Validate pending notification count
            self.notificationCenter.getPendingNotificationRequests { requests in
                if requests.count >= self.MAX_PENDING_NOTIFICATIONS {
                    Logger.shared.error(GardenPlannerError.customError(.notificationDeliveryFailed, "Maximum pending notifications reached"))
                    completion(GardenPlannerError.customError(.notificationDeliveryFailed, "Maximum pending notifications reached"))
                    return
                }
                
                // Create notification content
                let content = UNMutableNotificationContent()
                content.title = title
                content.body = body
                content.sound = .default
                content.categoryIdentifier = self.NOTIFICATION_CATEGORY_MAINTENANCE
                content.threadIdentifier = "maintenance"
                content.relevanceScore = 1.0
                
                if let userInfo = userInfo {
                    content.userInfo = userInfo
                }
                
                // Create time trigger with 1-second tolerance
                let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
                let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
                
                // Create and cache notification request
                let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
                self.notificationCache.setObject(request, forKey: identifier as NSString)
                
                // Schedule notification
                self.notificationCenter.add(request) { error in
                    if let error = error {
                        Logger.shared.error(GardenPlannerError.customError(.notificationDeliveryFailed, error.localizedDescription))
                        completion(error)
                        return
                    }
                    
                    Logger.shared.debug("Successfully scheduled notification: \(identifier)")
                    completion(nil)
                }
            }
        }
    }
    
    /// Cancels scheduled notification with cache cleanup
    /// - Parameter identifier: Notification identifier to cancel
    func cancelNotification(identifier: String) {
        notificationQueue.async { [weak self] in
            guard let self = self else { return }
            
            self.notificationCache.removeObject(forKey: identifier as NSString)
            self.notificationCenter.removePendingNotificationRequests(withIdentifiers: [identifier])
            Logger.shared.debug("Cancelled notification: \(identifier)")
        }
    }
    
    /// Retrieves pending notifications with enhanced filtering
    /// - Parameter completion: Callback with array of pending notification requests
    func getPendingNotifications(completion: @escaping ([UNNotificationRequest]) -> Void) {
        notificationQueue.async { [weak self] in
            guard let self = self else { return }
            
            self.notificationCenter.getPendingNotificationRequests { requests in
                let maintenanceRequests = requests.filter {
                    $0.content.categoryIdentifier == self.NOTIFICATION_CATEGORY_MAINTENANCE
                }.sorted {
                    guard let trigger1 = $0.trigger as? UNCalendarNotificationTrigger,
                          let trigger2 = $1.trigger as? UNCalendarNotificationTrigger,
                          let date1 = trigger1.nextTriggerDate(),
                          let date2 = trigger2.nextTriggerDate() else {
                        return false
                    }
                    return date1 < date2
                }
                
                Logger.shared.debug("Retrieved \(maintenanceRequests.count) pending maintenance notifications")
                completion(maintenanceRequests)
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func setupNotificationCategories() {
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
            identifier: NOTIFICATION_CATEGORY_MAINTENANCE,
            actions: [completeAction, postponeAction],
            intentIdentifiers: [],
            options: .customDismissAction
        )
        
        categories[NOTIFICATION_CATEGORY_MAINTENANCE] = category
    }
    
    private func registerNotificationCategories() {
        notificationCenter.setNotificationCategories(Set(categories.values))
        Logger.shared.debug("Registered notification categories")
    }
    
    private func checkAuthorizationStatus() {
        notificationCenter.getNotificationSettings { [weak self] settings in
            guard let self = self else { return }
            
            self.notificationQueue.async {
                self.isNotificationsAuthorized = settings.authorizationStatus == .authorized
                Logger.shared.debug("Notification authorization status: \(settings.authorizationStatus.rawValue)")
            }
        }
    }
}