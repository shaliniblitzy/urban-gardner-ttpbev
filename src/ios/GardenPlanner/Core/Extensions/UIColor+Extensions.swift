//
// UIColor+Extensions.swift
// GardenPlanner
//
// Extends UIColor with app-specific colors and utility methods
// for consistent theming across the Garden Planner iOS app.
//

import UIKit

extension UIColor {
    // MARK: - App Theme Colors
    
    /// Primary brand color (#2E7D32)
    static let primary = UIColor(hexString: "#2E7D32")
    
    /// Secondary brand color (#81C784)
    static let secondary = UIColor(hexString: "#81C784")
    
    /// Background color (#F5F5F5)
    static let background = UIColor(hexString: "#F5F5F5")
    
    /// Primary text color (#212121)
    static let textPrimary = UIColor(hexString: "#212121")
    
    /// Alert/Error color (#F44336)
    static let alert = UIColor(hexString: "#F44336")
    
    // MARK: - Garden Zone Colors
    
    /// Color representing full sun zones
    static let gardenZoneFullSun = UIColor(hexString: "#FFB74D")
    
    /// Color representing partial shade zones
    static let gardenZonePartialShade = UIColor(hexString: "#90CAF9")
    
    /// Color representing full shade zones
    static let gardenZoneFullShade = UIColor(hexString: "#7986CB")
    
    // MARK: - Plant Status Colors
    
    /// Color indicating healthy plant status
    static let plantStatusHealthy = UIColor(hexString: "#4CAF50")
    
    /// Color indicating plant needs attention
    static let plantStatusNeedsAttention = UIColor(hexString: "#FFC107")
    
    /// Color indicating critical plant status
    static let plantStatusCritical = UIColor(hexString: "#F44336")
    
    // MARK: - Utility Methods
    
    /// Creates a UIColor instance from a hex string.
    /// - Parameter hex: The hex string (can be 3, 6, or 8 characters, with or without #)
    /// - Returns: A UIColor instance representing the hex color, or clear if invalid
    static func hexStringToColor(_ hex: String) -> UIColor {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")
        
        var rgb: UInt64 = 0
        var r: CGFloat = 0.0
        var g: CGFloat = 0.0
        var b: CGFloat = 0.0
        var a: CGFloat = 1.0
        
        let length = hexSanitized.count
        
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else {
            return .clear
        }
        
        switch length {
        case 3: // RGB (12-bit)
            r = CGFloat((rgb >> 8) & 0xF) / 15.0
            g = CGFloat((rgb >> 4) & 0xF) / 15.0
            b = CGFloat(rgb & 0xF) / 15.0
            
        case 6: // RGB (24-bit)
            r = CGFloat((rgb >> 16) & 0xFF) / 255.0
            g = CGFloat((rgb >> 8) & 0xFF) / 255.0
            b = CGFloat(rgb & 0xFF) / 255.0
            
        case 8: // RGBA (32-bit)
            r = CGFloat((rgb >> 24) & 0xFF) / 255.0
            g = CGFloat((rgb >> 16) & 0xFF) / 255.0
            b = CGFloat((rgb >> 8) & 0xFF) / 255.0
            a = CGFloat(rgb & 0xFF) / 255.0
            
        default:
            return .clear
        }
        
        return UIColor(red: r, green: g, blue: b, alpha: a)
    }
    
    /// Convenience initializer for creating a color from a hex string
    /// - Parameter hexString: The hex color string
    convenience init(hexString: String) {
        self.init(cgColor: UIColor.hexStringToColor(hexString).cgColor)
    }
}