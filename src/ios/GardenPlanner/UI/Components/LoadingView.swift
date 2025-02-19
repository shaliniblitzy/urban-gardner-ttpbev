//
// LoadingView.swift
// GardenPlanner
//
// A reusable loading view component that displays an activity indicator
// with optional text message for indicating loading states.
//

import UIKit

@available(iOS 14.0, *)
public final class LoadingView: UIView {
    
    // MARK: - Private Properties
    
    private let activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.translatesAutoresizingMaskIntoConstraints = false
        indicator.hidesWhenStopped = true
        // Use primary color from design system
        indicator.color = UIColor(red: 46/255, green: 125/255, blue: 50/255, alpha: 1.0) // #2E7D32
        return indicator
    }()
    
    private let messageLabel: UILabel = {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.textAlignment = .center
        label.numberOfLines = 0
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.adjustsFontForContentSizeCategory = true
        // Use primary color from design system
        label.textColor = UIColor(red: 46/255, green: 125/255, blue: 50/255, alpha: 1.0) // #2E7D32
        return label
    }()
    
    private let containerStack: UIStackView = {
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 12
        return stack
    }()
    
    private var message: String?
    private let cornerRadius: CGFloat
    private let animationDuration: TimeInterval
    
    // MARK: - Initialization
    
    public init(
        message: String? = nil,
        cornerRadius: CGFloat = 16,
        animationDuration: TimeInterval = 0.3
    ) {
        self.message = message
        self.cornerRadius = cornerRadius
        self.animationDuration = animationDuration
        super.init(frame: .zero)
        
        setupUI()
        configureAccessibility()
        
        if let message = message {
            updateMessage(message)
        }
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        backgroundColor = .systemBackground
        
        // Add shadow and corner radius using extensions
        roundCorners(radius: cornerRadius)
        addShadow(opacity: 0.1, radius: 8, offset: CGSize(width: 0, height: 4))
        
        // Configure container stack
        addSubview(containerStack)
        containerStack.addArrangedSubview(activityIndicator)
        containerStack.addArrangedSubview(messageLabel)
        
        // Set up constraints
        NSLayoutConstraint.activate([
            containerStack.centerXAnchor.constraint(equalTo: centerXAnchor),
            containerStack.centerYAnchor.constraint(equalTo: centerYAnchor),
            containerStack.leadingAnchor.constraint(greaterThanOrEqualTo: leadingAnchor, constant: 24),
            containerStack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -24),
            
            // Set minimum size for the loading view
            widthAnchor.constraint(greaterThanOrEqualToConstant: 120),
            heightAnchor.constraint(greaterThanOrEqualToConstant: 120)
        ])
        
        // Optimize layer rendering
        layer.shouldRasterize = true
        layer.rasterizationScale = UIScreen.main.scale
    }
    
    private func configureAccessibility() {
        isAccessibilityElement = true
        accessibilityTraits = .updatesFrequently
        accessibilityLabel = message ?? NSLocalizedString("Loading", comment: "Loading view accessibility label")
        accessibilityHint = NSLocalizedString("Please wait while content is loading", comment: "Loading view accessibility hint")
    }
    
    // MARK: - Public Methods
    
    public func startAnimating() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.alpha = 0
            self.isHidden = false
            self.activityIndicator.startAnimating()
            
            UIView.animate(withDuration: self.animationDuration) {
                self.alpha = 1
            } completion: { _ in
                UIAccessibility.post(notification: .layoutChanged, argument: self)
            }
        }
    }
    
    public func stopAnimating() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            UIView.animate(withDuration: self.animationDuration) {
                self.alpha = 0
            } completion: { _ in
                self.isHidden = true
                self.activityIndicator.stopAnimating()
                UIAccessibility.post(notification: .layoutChanged, argument: nil)
            }
        }
    }
    
    public func updateMessage(_ message: String?) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.message = message
            self.messageLabel.text = message
            self.messageLabel.isHidden = message == nil
            
            // Update accessibility label
            self.accessibilityLabel = message ?? NSLocalizedString("Loading", comment: "Loading view accessibility label")
            
            // Animate message update
            UIView.animate(withDuration: 0.2) {
                self.containerStack.layoutIfNeeded()
            }
        }
    }
}