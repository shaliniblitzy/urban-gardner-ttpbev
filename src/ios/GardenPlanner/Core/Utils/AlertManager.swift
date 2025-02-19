import UIKit

// MARK: - Alert Types and Configuration

/// Defines different types of alerts that can be displayed
enum AlertType {
    case error
    case warning
    case success
    case info
    
    var color: UIColor {
        switch self {
        case .error: return .systemRed
        case .warning: return .systemOrange
        case .success: return .systemGreen
        case .info: return .systemBlue
        }
    }
}

/// Static configuration for alert presentation
private struct AlertConfiguration {
    static let defaultDuration: TimeInterval = 3.0
    static let maxQueueSize: Int = 5
    static let bannerHeight: CGFloat = 80
    static let cornerRadius: CGFloat = 10
    static let animationDuration: TimeInterval = 0.3
}

// MARK: - Alert Action

/// Represents an action that can be added to an alert or action sheet
struct AlertAction {
    let title: String
    let style: UIAlertAction.Style
    let handler: (() -> Void)?
}

// MARK: - Alert Queue

/// Thread-safe queue for managing multiple alerts
private final class AlertQueue {
    private var alerts: [UIAlertController] = []
    private let semaphore = DispatchSemaphore(value: 1)
    
    func enqueue(_ alert: UIAlertController) {
        semaphore.wait()
        defer { semaphore.signal() }
        
        if alerts.count < AlertConfiguration.maxQueueSize {
            alerts.append(alert)
        }
    }
    
    func dequeue() -> UIAlertController? {
        semaphore.wait()
        defer { semaphore.signal() }
        
        return alerts.isEmpty ? nil : alerts.removeFirst()
    }
    
    var isEmpty: Bool {
        semaphore.wait()
        defer { semaphore.signal() }
        return alerts.isEmpty
    }
}

// MARK: - Alert Manager

/// Thread-safe singleton class for managing alerts and notifications
@MainActor final class AlertManager {
    // MARK: - Properties
    
    static let shared = AlertManager()
    
    private let window: UIWindow? = UIApplication.shared.windows.first { $0.isKeyWindow }
    private let alertQueue = AlertQueue()
    private let alertDispatchQueue = DispatchQueue(label: "com.gardenplanner.alertmanager")
    private var isPresenting = false
    
    // MARK: - Initialization
    
    private init() {
        NotificationCenter.default.addObserver(self,
                                             selector: #selector(applicationDidBecomeActive),
                                             name: UIApplication.didBecomeActiveNotification,
                                             object: nil)
    }
    
    // MARK: - Public Methods
    
    /// Shows an error alert with optional retry capability
    func showError(_ error: Error,
                  from viewController: UIViewController? = nil,
                  retryAction: (() -> Void)? = nil) {
        Logger.shared.error(error)
        
        let alert = UIAlertController(title: "Error",
                                    message: error.localizedDescription,
                                    preferredStyle: .alert)
        
        if let retryAction = retryAction,
           let gardenError = error as? GardenPlannerError,
           GardenPlannerError.shouldRetry(gardenError) {
            alert.addAction(UIAlertAction(title: "Retry", style: .default) { _ in
                retryAction()
            })
        }
        
        alert.addAction(UIAlertAction(title: "OK", style: .cancel))
        
        alert.view.accessibilityIdentifier = "ErrorAlert"
        
        presentAlert(alert, from: viewController)
    }
    
    /// Shows a temporary notification banner
    func showNotification(_ message: String,
                         type: AlertType,
                         duration: TimeInterval? = nil,
                         completion: (() -> Void)? = nil) {
        let bannerView = createBannerView(message: message, type: type)
        
        UIView.animate(withSpringDamping: 0.8,
                      initialSpringVelocity: 0.5,
                      animations: {
            self.window?.addSubview(bannerView)
            bannerView.transform = .identity
        }, completion: { _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + (duration ?? AlertConfiguration.defaultDuration)) {
                UIView.animate(withDuration: AlertConfiguration.animationDuration,
                             animations: {
                    bannerView.transform = CGAffineTransform(translationX: 0, y: -AlertConfiguration.bannerHeight)
                }, completion: { _ in
                    bannerView.removeFromSuperview()
                    completion?()
                })
            }
        })
    }
    
    /// Shows an action sheet with multiple options
    func showActionSheet(title: String,
                        message: String,
                        actions: [AlertAction],
                        from viewController: UIViewController) {
        let alert = UIAlertController(title: title,
                                    message: message,
                                    preferredStyle: .actionSheet)
        
        actions.forEach { action in
            alert.addAction(UIAlertAction(title: action.title,
                                        style: action.style) { _ in
                action.handler?()
            })
        }
        
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel))
        
        alert.view.accessibilityIdentifier = "ActionSheet"
        
        presentAlert(alert, from: viewController)
    }
    
    // MARK: - Private Methods
    
    private func presentAlert(_ alert: UIAlertController, from viewController: UIViewController?) {
        alertQueue.enqueue(alert)
        processAlertQueue(from: viewController)
    }
    
    private func processAlertQueue(from viewController: UIViewController? = nil) {
        guard !isPresenting, !alertQueue.isEmpty else { return }
        
        isPresenting = true
        
        guard let alert = alertQueue.dequeue() else {
            isPresenting = false
            return
        }
        
        let presenter = viewController ?? window?.rootViewController
        presenter?.present(alert, animated: true) { [weak self] in
            self?.isPresenting = false
            self?.processAlertQueue(from: viewController)
        }
    }
    
    private func createBannerView(message: String, type: AlertType) -> UIView {
        let bannerView = UIView(frame: CGRect(x: 0,
                                            y: -AlertConfiguration.bannerHeight,
                                            width: window?.bounds.width ?? 0,
                                            height: AlertConfiguration.bannerHeight))
        bannerView.backgroundColor = type.color
        bannerView.layer.cornerRadius = AlertConfiguration.cornerRadius
        bannerView.layer.masksToBounds = true
        
        let label = UILabel(frame: bannerView.bounds.inset(by: UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)))
        label.text = message
        label.textColor = .white
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.font = .preferredFont(forTextStyle: .body)
        
        bannerView.addSubview(label)
        
        bannerView.accessibilityLabel = message
        bannerView.accessibilityTraits = .updates
        
        return bannerView
    }
    
    @objc private func applicationDidBecomeActive() {
        isPresenting = false
        processAlertQueue()
    }
}