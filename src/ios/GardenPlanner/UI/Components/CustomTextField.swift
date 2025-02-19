//
// CustomTextField.swift
// GardenPlanner
//
// A custom UITextField component providing consistent styling, validation,
// and enhanced functionality for garden planning input fields.
//
// UIKit Version: iOS 14.0+
//

import UIKit

@IBDesignable
class CustomTextField: UITextField {
    
    // MARK: - IBInspectable Properties
    
    @IBInspectable var cornerRadius: CGFloat = 8.0 {
        didSet {
            setupAppearance()
        }
    }
    
    @IBInspectable var borderColor: UIColor = UIColor(red: 46/255, green: 125/255, blue: 50/255, alpha: 1.0) { // #2E7D32
        didSet {
            setupAppearance()
        }
    }
    
    @IBInspectable var borderWidth: CGFloat = 1.0 {
        didSet {
            setupAppearance()
        }
    }
    
    @IBInspectable override var placeholder: String? {
        didSet {
            updatePlaceholder()
        }
    }
    
    @IBInspectable var placeholderColor: UIColor = UIColor(red: 129/255, green: 199/255, blue: 132/255, alpha: 1.0) { // #81C784
        didSet {
            updatePlaceholder()
        }
    }
    
    // MARK: - Public Properties
    
    public var isValid: Bool = true {
        didSet {
            updateValidationState()
        }
    }
    
    // MARK: - Private Properties
    
    private var validationRule: ((String) -> Bool)?
    private var textPadding: UIEdgeInsets = .zero
    private let errorColor = UIColor(red: 244/255, green: 67/255, blue: 54/255, alpha: 1.0) // #F44336
    private let normalColor = UIColor(red: 46/255, green: 125/255, blue: 50/255, alpha: 1.0) // #2E7D32
    
    // Screen size-based padding values
    private let smallScreenPadding: CGFloat = 8.0  // < 375px
    private let mediumScreenPadding: CGFloat = 12.0 // 376-768px
    private let largeScreenPadding: CGFloat = 16.0  // > 768px
    
    // MARK: - Initialization
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        commonInit()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }
    
    private func commonInit() {
        setupAppearance()
        updatePaddingForScreenSize()
        
        // Add validation on text change
        addTarget(self, action: #selector(textDidChange), for: .editingChanged)
        
        // Configure accessibility
        isAccessibilityElement = true
        accessibilityTraits = .textField
        accessibilityLabel = placeholder
    }
    
    // MARK: - Public Methods
    
    public func setValidationRule(_ rule: @escaping (String) -> Bool) {
        validationRule = rule
        validate()
    }
    
    public func validate() -> Bool {
        guard let rule = validationRule else {
            return true
        }
        
        isValid = rule(text ?? "")
        updateValidationState()
        
        // Update accessibility state
        accessibilityValue = text
        if !isValid {
            accessibilityHint = "Input is invalid. Please check the requirements."
            UIAccessibility.post(notification: .announcement, argument: "Input validation failed")
        }
        
        // Post validation notification for observers
        NotificationCenter.default.post(
            name: NSNotification.Name("CustomTextFieldValidationChanged"),
            object: self,
            userInfo: ["isValid": isValid]
        )
        
        return isValid
    }
    
    public func updatePaddingForScreenSize() {
        let screenWidth = UIScreen.main.bounds.width
        
        switch screenWidth {
        case ..<375:
            textPadding = UIEdgeInsets(top: smallScreenPadding,
                                     left: smallScreenPadding,
                                     bottom: smallScreenPadding,
                                     right: smallScreenPadding)
        case 375..<768:
            textPadding = UIEdgeInsets(top: mediumScreenPadding,
                                     left: mediumScreenPadding,
                                     bottom: mediumScreenPadding,
                                     right: mediumScreenPadding)
        default:
            textPadding = UIEdgeInsets(top: largeScreenPadding,
                                     left: largeScreenPadding,
                                     bottom: largeScreenPadding,
                                     right: largeScreenPadding)
        }
        
        setNeedsLayout()
    }
    
    // MARK: - Private Methods
    
    private func setupAppearance() {
        roundCorners(radius: cornerRadius)
        addBorder(width: borderWidth, color: borderColor)
        
        backgroundColor = .white
        textColor = UIColor(red: 33/255, green: 33/255, blue: 33/255, alpha: 1.0) // #212121
        
        addShadow(
            opacity: 0.1,
            radius: 4,
            offset: CGSize(width: 0, height: 2),
            color: .black
        )
        
        updatePlaceholder()
    }
    
    private func updatePlaceholder() {
        if let placeholder = placeholder {
            attributedPlaceholder = NSAttributedString(
                string: placeholder,
                attributes: [
                    .foregroundColor: placeholderColor,
                    .font: font ?? .systemFont(ofSize: 16)
                ]
            )
        }
    }
    
    private func updateValidationState() {
        borderColor = isValid ? normalColor : errorColor
        setupAppearance()
    }
    
    @objc private func textDidChange() {
        validate()
    }
    
    // MARK: - Layout
    
    override func textRect(forBounds bounds: CGRect) -> CGRect {
        bounds.inset(by: textPadding)
    }
    
    override func editingRect(forBounds bounds: CGRect) -> CGRect {
        bounds.inset(by: textPadding)
    }
    
    override func placeholderRect(forBounds bounds: CGRect) -> CGRect {
        bounds.inset(by: textPadding)
    }
    
    // MARK: - Trait Collection
    
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        updatePaddingForScreenSize()
    }
}