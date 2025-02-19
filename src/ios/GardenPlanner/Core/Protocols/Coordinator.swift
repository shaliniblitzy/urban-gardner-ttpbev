import UIKit

/// Protocol defining the comprehensive requirements for implementing the Coordinator pattern
/// in the iOS app. Coordinators are responsible for managing navigation flows, dependencies,
/// and view controller hierarchies in a type-safe manner.
///
/// Usage:
/// ```
/// class MainCoordinator: Coordinator {
///     var navigationController: UINavigationController
///     var childCoordinators: [Coordinator] = []
///     weak var parentCoordinator: Coordinator?
///
///     init(navigationController: UINavigationController) {
///         self.navigationController = navigationController
///     }
///
///     func start() {
///         // Implementation
///     }
///
///     func finish() {
///         // Implementation
///     }
/// }
/// ```
protocol Coordinator: AnyObject {
    
    /// The navigation controller responsible for managing the view hierarchy
    /// and handling navigation transitions within this coordinator's flow.
    var navigationController: UINavigationController { get }
    
    /// Array of child coordinators. Used to maintain reference to child coordinators
    /// and prevent them from being deallocated while active.
    /// Child coordinators should be added when starting a new flow and removed when finished.
    var childCoordinators: [Coordinator] { get set }
    
    /// Reference to the parent coordinator. Weak reference to avoid retain cycles
    /// in the coordinator hierarchy.
    /// This property helps maintain proper cleanup when a flow is completed.
    weak var parentCoordinator: Coordinator? { get set }
    
    /// Initiates the coordinator's navigation flow.
    ///
    /// This method should be called to start the coordinator's responsibilities, such as:
    /// - Setting up the initial view controller
    /// - Configuring dependencies
    /// - Presenting the first screen
    /// - Initializing child coordinators if needed
    func start()
    
    /// Cleans up the coordinator and notifies the parent coordinator of completion.
    ///
    /// This method should handle:
    /// - Cleanup of any resources or subscriptions
    /// - Removal from parent's childCoordinators array
    /// - Dismissal of any presented view controllers
    /// - Notification to parent coordinator about completion
    /// - Release of retained objects
    func finish()
}

// MARK: - Default Implementation
extension Coordinator {
    
    /// Default implementation to remove a child coordinator from the childCoordinators array.
    /// This method should be called when a child coordinator completes its flow.
    ///
    /// - Parameter coordinator: The child coordinator to remove
    func removeChildCoordinator(_ coordinator: Coordinator) {
        childCoordinators.removeAll { $0 === coordinator }
    }
    
    /// Default implementation to add a child coordinator to the childCoordinators array.
    /// This method should be called when starting a new child coordinator flow.
    ///
    /// - Parameter coordinator: The child coordinator to add
    func addChildCoordinator(_ coordinator: Coordinator) {
        childCoordinators.append(coordinator)
        coordinator.parentCoordinator = self
    }
}