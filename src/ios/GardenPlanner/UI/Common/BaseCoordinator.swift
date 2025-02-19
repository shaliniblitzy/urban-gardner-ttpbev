import UIKit
import os.log

/// Thread-safe base implementation of the Coordinator pattern that provides common functionality
/// for managing navigation flows and view controller hierarchies.
/// This class implements proper memory management, thread safety, and error handling.
class BaseCoordinator: Coordinator {
    
    // MARK: - Properties
    
    /// The navigation controller responsible for managing the view hierarchy
    public let navigationController: UINavigationController
    
    /// Thread-safe array of child coordinators
    private(set) var childCoordinators: [Coordinator] = []
    
    /// Lock for ensuring thread-safe access to child coordinators
    private let coordinatorLock = NSLock()
    
    /// Weak reference to parent coordinator to avoid retain cycles
    public weak var parentCoordinator: Coordinator?
    
    /// Logger instance for debugging and tracking coordinator lifecycle
    private let logger = Logger(subsystem: Bundle.main.bundleIdentifier ?? "com.gardenplanner",
                              category: "BaseCoordinator")
    
    // MARK: - Initialization
    
    /// Initializes a new coordinator with the specified navigation controller and optional parent
    /// - Parameters:
    ///   - navigationController: The navigation controller to manage the view hierarchy
    ///   - parentCoordinator: Optional parent coordinator (default: nil)
    init(navigationController: UINavigationController, parentCoordinator: Coordinator? = nil) {
        self.navigationController = navigationController
        self.parentCoordinator = parentCoordinator
        logger.debug("Initialized \(String(describing: self))")
    }
    
    // MARK: - Coordinator Protocol Implementation
    
    /// Abstract method that must be overridden by subclasses to implement their specific navigation flow
    /// - Throws: CoordinatorError if called on the base class
    func start() {
        assertionFailure("start() must be implemented by subclass")
        logger.error("start() called on BaseCoordinator - must be implemented by subclass")
    }
    
    /// Adds a child coordinator to the hierarchy in a thread-safe manner
    /// - Parameter coordinator: The coordinator to add as a child
    public func addChildCoordinator(_ coordinator: Coordinator) {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        // Verify coordinator isn't already in hierarchy to prevent cycles
        guard !childCoordinators.contains(where: { $0 === coordinator }) else {
            logger.warning("Attempted to add duplicate coordinator: \(String(describing: coordinator))")
            return
        }
        
        childCoordinators.append(coordinator)
        coordinator.parentCoordinator = self
        logger.debug("Added child coordinator: \(String(describing: coordinator))")
    }
    
    /// Removes a child coordinator from the hierarchy in a thread-safe manner
    /// - Parameter coordinator: The coordinator to remove
    public func removeChildCoordinator(_ coordinator: Coordinator) {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        childCoordinators.removeAll { $0 === coordinator }
        logger.debug("Removed child coordinator: \(String(describing: coordinator))")
    }
    
    /// Cleans up the coordinator and notifies parent of completion
    public func finish() {
        coordinatorLock.lock()
        defer { coordinatorLock.unlock() }
        
        // Clean up child coordinators
        childCoordinators.forEach { $0.finish() }
        childCoordinators.removeAll()
        
        // Notify parent to remove self
        parentCoordinator?.removeChildCoordinator(self)
        logger.debug("Finished coordinator: \(String(describing: self))")
    }
    
    // MARK: - Deinitialization
    
    deinit {
        // Ensure proper cleanup when coordinator is deallocated
        finish()
        logger.debug("Deinitialized \(String(describing: self))")
    }
}

// MARK: - Error Handling

extension BaseCoordinator {
    /// Errors that can occur during coordinator operations
    enum CoordinatorError: Error {
        case invalidNavigation
        case coordinatorNotFound
        case invalidState
        
        var localizedDescription: String {
            switch self {
            case .invalidNavigation:
                return "Invalid navigation operation attempted"
            case .coordinatorNotFound:
                return "Referenced coordinator not found in hierarchy"
            case .invalidState:
                return "Coordinator is in an invalid state"
            }
        }
    }
    
    /// Handles coordinator-specific errors
    /// - Parameter error: The error to handle
    private func handleError(_ error: Error) {
        logger.error("Coordinator error: \(error.localizedDescription)")
        // Additional error handling logic can be implemented here
    }
}

// MARK: - Thread Safety

extension BaseCoordinator {
    /// Ensures the coordinator is operating on the main thread
    private func assertMainThread() {
        assert(Thread.isMainThread, "Coordinator must be used from main thread")
    }
    
    /// Executes a block on the main thread if necessary
    /// - Parameter block: The block to execute
    private func ensureMainThread(_ block: @escaping () -> Void) {
        if Thread.isMainThread {
            block()
        } else {
            DispatchQueue.main.async(execute: block)
        }
    }
}