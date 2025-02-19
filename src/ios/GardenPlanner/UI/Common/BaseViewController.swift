import UIKit
import Combine // iOS 13.0+

/// A thread-safe base view controller providing common functionality for all view controllers
/// with enhanced error handling, performance monitoring, and MVVM architecture support.
@available(iOS 14.0, *)
@MainActor
class BaseViewController<ViewModel: ViewModelType>: UIViewController {
    
    // MARK: - Types
    
    /// Represents the loading state of the view controller
    private enum LoadingState {
        case loading
        case loaded
        case error(Error)
        case retrying
    }
    
    /// Type for error recovery actions that return a publisher
    private typealias ErrorRecoveryAction = (Error) -> AnyPublisher<Void, Error>
    
    // MARK: - Properties
    
    /// The view model instance for this view controller
    let viewModel: ViewModel
    
    /// Set to store and manage cancellable subscriptions
    private var cancellables = Set<AnyCancellable>()
    
    /// Current loading state of the view controller
    private var loadingState: LoadingState = .loading {
        didSet {
            updateLoadingUI()
        }
    }
    
    /// Lock for thread-safe state updates
    private let stateLock = NSLock()
    
    /// Tracks view load start time for performance monitoring
    private var viewLoadStartTime: CFAbsoluteTime = 0
    
    // MARK: - Initialization
    
    /// Initializes the view controller with a view model
    /// - Parameter viewModel: The view model instance
    init(viewModel: ViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
        Logger.shared.debug("Initializing \(String(describing: self))")
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        viewLoadStartTime = CFAbsoluteTimeGetCurrent()
        
        setupUI()
        setupBindings()
        setupAccessibility()
        
        let loadTime = CFAbsoluteTimeGetCurrent() - viewLoadStartTime
        Logger.shared.debug("View controller loaded in \(String(format: "%.3f", loadTime))s")
    }
    
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        
        let totalTime = CFAbsoluteTimeGetCurrent() - viewLoadStartTime
        if totalTime > 3.0 {
            Logger.shared.debug("Warning: Slow view appearance (\(String(format: "%.3f", totalTime))s)")
        }
    }
    
    // MARK: - Setup Methods
    
    /// Sets up the view controller's UI elements
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Add loading indicator
        let loadingIndicator = UIActivityIndicatorView(style: .large)
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(loadingIndicator)
        
        NSLayoutConstraint.activate([
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        
        loadingIndicator.accessibilityIdentifier = "LoadingIndicator"
    }
    
    /// Sets up reactive bindings with the view model
    private func setupBindings() {
        // Ensure we're on the main thread for UI updates
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.setupBindings()
            }
            return
        }
        
        // Handle loading state changes
        viewModel.transform(viewModel.Input)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                if case .failure(let error) = completion {
                    self?.handleError(error)
                }
            } receiveValue: { [weak self] _ in
                self?.updateLoadingState(.loaded)
            }
            .store(in: &cancellables)
    }
    
    /// Sets up accessibility support
    private func setupAccessibility() {
        view.accessibilityIdentifier = String(describing: type(of: self))
        view.shouldGroupAccessibilityChildren = true
    }
    
    // MARK: - Error Handling
    
    /// Handles errors with optional recovery action
    /// - Parameters:
    ///   - error: The error to handle
    ///   - recoveryAction: Optional recovery action to attempt
    private func handleError(_ error: Error, recoveryAction: ErrorRecoveryAction? = nil) {
        Logger.shared.error(error)
        
        updateLoadingState(.error(error))
        
        if let gardenError = error as? GardenPlannerError,
           GardenPlannerError.isRecoverable(gardenError) {
            
            AlertManager.shared.showError(error, from: self) { [weak self] in
                self?.updateLoadingState(.retrying)
                
                if let recoveryAction = recoveryAction {
                    recoveryAction(error)
                        .receive(on: DispatchQueue.main)
                        .sink { [weak self] completion in
                            if case .failure(let retryError) = completion {
                                self?.handleError(retryError)
                            }
                        } receiveValue: { [weak self] _ in
                            self?.updateLoadingState(.loaded)
                        }
                        .store(in: &self!.cancellables)
                }
            }
        } else {
            AlertManager.shared.showError(error, from: self)
        }
    }
    
    // MARK: - State Management
    
    /// Updates the loading state in a thread-safe manner
    /// - Parameter newState: The new loading state
    private func updateLoadingState(_ newState: LoadingState) {
        stateLock.lock()
        defer { stateLock.unlock() }
        
        loadingState = newState
        
        Logger.shared.debug("State updated to: \(String(describing: newState))")
    }
    
    /// Updates the UI based on current loading state
    private func updateLoadingUI() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { [weak self] in
                self?.updateLoadingUI()
            }
            return
        }
        
        let loadingIndicator = view.subviews.first { $0 is UIActivityIndicatorView } as? UIActivityIndicatorView
        
        switch loadingState {
        case .loading, .retrying:
            loadingIndicator?.startAnimating()
            view.isUserInteractionEnabled = false
        case .loaded:
            loadingIndicator?.stopAnimating()
            view.isUserInteractionEnabled = true
        case .error:
            loadingIndicator?.stopAnimating()
            view.isUserInteractionEnabled = true
        }
    }
    
    // MARK: - Memory Management
    
    deinit {
        cancellables.forEach { $0.cancel() }
        cancellables.removeAll()
        Logger.shared.debug("Deinitializing \(String(describing: self))")
    }
}