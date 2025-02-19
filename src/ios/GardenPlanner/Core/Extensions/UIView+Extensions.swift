//
// UIView+Extensions.swift
// GardenPlanner
//
// Extension providing reusable UI styling and layout utilities for UIView components
// with optimized performance and accessibility support.
//
// UIKit Version: iOS 14.0+
//

import UIKit

public extension UIView {
    
    /// Adds a customizable shadow to the view with optimized performance using shadowPath
    /// - Parameters:
    ///   - opacity: The opacity of the shadow (0.0 to 1.0)
    ///   - radius: The blur radius of the shadow
    ///   - offset: The offset (in points) of the shadow
    ///   - color: The color of the shadow
    func addShadow(
        opacity: CGFloat = 0.2,
        radius: CGFloat = 4.0,
        offset: CGSize = CGSize(width: 0, height: 2),
        color: UIColor = .black
    ) {
        layer.shadowOpacity = Float(opacity)
        layer.shadowRadius = radius
        layer.shadowOffset = offset
        layer.shadowColor = color.cgColor
        
        // Optimize shadow rendering performance using shadowPath
        layer.shadowPath = UIBezierPath(rect: bounds).cgPath
        
        // Enable rasterization for better shadow performance
        layer.shouldRasterize = true
        layer.rasterizationScale = UIScreen.main.scale
    }
    
    /// Applies rounded corners to specific corners of the view
    /// - Parameters:
    ///   - radius: The radius of the rounded corners
    ///   - corners: The specific corners to round (optional, defaults to all corners)
    func roundCorners(
        radius: CGFloat,
        corners: CACornerMask? = nil
    ) {
        layer.cornerRadius = radius
        
        if let corners = corners {
            layer.maskedCorners = corners
        } else {
            layer.maskedCorners = [
                .layerMinXMinYCorner,
                .layerMaxXMinYCorner,
                .layerMinXMaxYCorner,
                .layerMaxXMaxYCorner
            ]
        }
        
        layer.masksToBounds = true
        
        // Use continuous corner curve for smoother appearance
        if #available(iOS 13.0, *) {
            layer.cornerCurve = .continuous
        }
    }
    
    /// Adds a customizable border to the view using the app's color scheme
    /// - Parameters:
    ///   - width: The width of the border
    ///   - color: The color of the border (defaults to primary app color)
    func addBorder(
        width: CGFloat = 1.0,
        color: UIColor = UIColor(red: 46/255, green: 125/255, blue: 50/255, alpha: 1.0) // #2E7D32
    ) {
        layer.borderWidth = width
        layer.borderColor = color.cgColor
        
        // Ensure proper color contrast for accessibility
        if !color.isAccessibleOnBackground(backgroundColor ?? .white) {
            print("Warning: Border color may not provide sufficient contrast for accessibility")
        }
    }
    
    /// Applies a customizable gradient background to the view
    /// - Parameters:
    ///   - colors: Array of colors for the gradient
    ///   - points: Array of points defining gradient direction (must contain start and end points)
    func setGradientBackground(
        colors: [UIColor],
        points: [CGPoint] = [CGPoint(x: 0.0, y: 0.0), CGPoint(x: 1.0, y: 1.0)]
    ) {
        // Remove any existing gradient layers
        layer.sublayers?.removeAll(where: { $0 is CAGradientLayer })
        
        let gradientLayer = CAGradientLayer()
        gradientLayer.colors = colors.map { $0.cgColor }
        
        // Ensure we have valid start and end points
        guard points.count >= 2 else {
            print("Error: Gradient requires at least start and end points")
            return
        }
        
        gradientLayer.startPoint = points[0]
        gradientLayer.endPoint = points[1]
        gradientLayer.frame = bounds
        
        // Insert gradient at index 0 to appear behind other content
        layer.insertSublayer(gradientLayer, at: 0)
        
        // Enable rasterization for better performance
        gradientLayer.shouldRasterize = true
        gradientLayer.rasterizationScale = UIScreen.main.scale
    }
}

// MARK: - Private Helper Extensions

private extension UIColor {
    /// Checks if the color provides sufficient contrast against a background color
    /// - Parameter backgroundColor: The background color to check contrast against
    /// - Returns: Boolean indicating if the contrast ratio meets accessibility guidelines
    func isAccessibleOnBackground(_ backgroundColor: UIColor) -> Bool {
        // Calculate relative luminance (simplified version)
        func luminance(for color: UIColor) -> CGFloat {
            var red: CGFloat = 0
            var green: CGFloat = 0
            var blue: CGFloat = 0
            color.getRed(&red, green: &green, blue: &blue, alpha: nil)
            
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue
        }
        
        let foregroundLuminance = luminance(for: self)
        let backgroundLuminance = luminance(for: backgroundColor)
        
        let contrastRatio = (max(foregroundLuminance, backgroundLuminance) + 0.05) /
                           (min(foregroundLuminance, backgroundLuminance) + 0.05)
        
        // WCAG 2.0 level AA requires a contrast ratio of at least 4.5:1
        return contrastRatio >= 4.5
    }
}