import UIKit
import Combine

/// Thread-safe coordinator implementation that manages navigation flow and dependency injection 
/// for Settings screens with comprehensive error handling and performance monitoring.
@available(iOS 14.0, *)
@MainActor
final class SettingsCoordinator: Coordinator {
    
    // MARK: - Properties
    
    weak var parentCoordinator: Coordinator?
    var childCoordinators: [Coordinator] = []
    var navigationController: UINavigationController
    
    private let preferencesService: UserPreferencesService
    private let performanceMonitor: PerformanceMonitor
    private let coordinatorLock = NSLock()
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    init(navigationController: UINavigationController,
         preferencesService: UserPreferencesService,
         performanceMonitor: PerformanceMonitor) {
        self.navigationController = navigationController
        self.preferencesService = preferencesService
        self.performanceMonitor = performanceMonitor
        
        Logger.shared.debug("SettingsCoordinator initialized")
    }
    
    // MARK: - Coordinator Protocol
    
    func start() {
        performanceMonitor.start()
        
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        do {
            // Initialize view model with dependencies
            let viewModel = SettingsViewModel(preferencesService: preferencesService)
            
            // Initialize settings view controller
            let settingsViewController = SettingsViewController(viewModel: viewModel)
            settingsViewController.title = "Settings"
            
            // Configure navigation item
            let closeButton = UIBarButtonItem(
                barButtonSystemItem: .close,
                target: self,
                action: #selector(dismissSettings)
            )
            settingsViewController.navigationItem.leftBarButtonItem = closeButton
            
            // Push view controller
            navigationController.pushViewController(settingsViewController, animated: true)
            
            performanceMonitor.stop()
            Logger.shared.debug("Settings flow started in \(performanceMonitor.elapsedTime)s")
            
        } catch {
            Logger.shared.error(GardenPlannerError.systemError(error))
            AlertManager.shared.showError(error, from: navigationController.topViewController)
        }
    }
    
    func finish() {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        // Clean up any resources
        cancellables.removeAll()
        
        // Remove self from parent's child coordinators
        parentCoordinator?.removeChildCoordinator(self)
        
        Logger.shared.debug("SettingsCoordinator finished")
    }
    
    // MARK: - Navigation Methods
    
    /// Shows notification settings screen with performance monitoring
    func showNotificationSettings() -> Result<Void, CoordinatorError> {
        performanceMonitor.start()
        
        coordinatorLock.lock()
        defer { 
            coordinatorLock.unlock()
            performanceMonitor.stop()
        }
        
        do {
            // Initialize notification settings view model
            let notificationViewModel = NotificationSettingsViewModel(
                preferencesService: preferencesService,
                notificationManager: NotificationManager.shared
            )
            
            // Initialize view controller
            let notificationSettingsVC = NotificationSettingsViewController(
                viewModel: notificationViewModel
            )
            notificationSettingsVC.title = "Notification Settings"
            
            // Push view controller
            navigationController.pushViewController(notificationSettingsVC, animated: true)
            
            Logger.shared.debug("Notification settings shown in \(performanceMonitor.elapsedTime)s")
            return .success(())
            
        } catch {
            let coordinatorError = CoordinatorError.navigationFailed(error)
            Logger.shared.error(GardenPlannerError.systemError(error))
            return .failure(coordinatorError)
        }
    }
    
    /// Shows measurement settings screen with error handling
    func showMeasurementSettings() -> Result<Void, CoordinatorError> {
        performanceMonitor.start()
        
        coordinatorLock.lock()
        defer { 
            coordinatorLock.unlock()
            performanceMonitor.stop()
        }
        
        do {
            // Initialize measurement settings view model
            let measurementViewModel = MeasurementSettingsViewModel(
                preferencesService: preferencesService
            )
            
            // Initialize view controller
            let measurementSettingsVC = MeasurementSettingsViewController(
                viewModel: measurementViewModel
            )
            measurementSettingsVC.title = "Measurement Settings"
            
            // Push view controller
            navigationController.pushViewController(measurementSettingsVC, animated: true)
            
            Logger.shared.debug("Measurement settings shown in \(performanceMonitor.elapsedTime)s")
            return .success(())
            
        } catch {
            let coordinatorError = CoordinatorError.navigationFailed(error)
            Logger.shared.error(GardenPlannerError.systemError(error))
            return .failure(coordinatorError)
        }
    }
    
    // MARK: - Private Methods
    
    @objc private func dismissSettings() {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        navigationController.dismiss(animated: true) { [weak self] in
            self?.finish()
        }
    }
}

// MARK: - Error Types

enum CoordinatorError: Error {
    case navigationFailed(Error)
    case invalidConfiguration
    case childCoordinatorFailed
    
    var localizedDescription: String {
        switch self {
        case .navigationFailed(let error):
            return "Navigation failed: \(error.localizedDescription)"
        case .invalidConfiguration:
            return "Invalid coordinator configuration"
        case .childCoordinatorFailed:
            return "Child coordinator operation failed"
        }
    }
}