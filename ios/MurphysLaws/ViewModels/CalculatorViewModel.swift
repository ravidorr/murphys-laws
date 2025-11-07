//
//  CalculatorViewModel.swift
//  MurphysLaws
//
//  ViewModel for Sod's Law Calculator
//

import Foundation

@MainActor
class CalculatorViewModel: ObservableObject {
    // Input parameters (1-10)
    @Published var urgency: Double = 5
    @Published var complexity: Double = 5
    @Published var importance: Double = 5
    @Published var skillLevel: Double = 5
    @Published var frequency: Double = 5

    // Calculation result
    @Published var probability: Double = 0
    @Published var riskLevel: RiskLevel = .medium

    @Published var isSharing = false
    @Published var shareError: Error?

    private let apiService = APIService.shared

    enum RiskLevel: String {
        case low = "Low"
        case medium = "Medium"
        case high = "High"

        var description: String {
            switch self {
            case .low:
                return "Low risk of failure"
            case .medium:
                return "Moderate risk of failure"
            case .high:
                return "High risk of failure"
            }
        }

        var emoji: String {
            switch self {
            case .low: return "🟢"
            case .medium: return "🟡"
            case .high: return "🔴"
            }
        }
    }

    init() {
        calculate()
    }

    // MARK: - Calculate Sod's Law Probability
    func calculate() {
        // Formula from PRD:
        // P = ((U+C+I) × (10-S))/20 × A × 1/(1-sin(F/10))
        // Where A (adversity factor) is typically 1.0

        let u = urgency
        let c = complexity
        let i = importance
        let s = skillLevel
        let f = frequency
        let a: Double = 1.0 // Adversity factor

        // Calculate base probability
        let numerator = (u + c + i) * (10 - s)
        let baseProbability = numerator / 20.0

        // Apply frequency modifier
        let sinValue = sin(f / 10.0)
        let frequencyModifier = 1.0 / (1.0 - sinValue)

        // Final probability (clamped to 0-100%)
        let rawProbability = baseProbability * a * frequencyModifier
        probability = min(max(rawProbability, 0), 100)

        // Determine risk level
        if probability < 30 {
            riskLevel = .low
        } else if probability < 60 {
            riskLevel = .medium
        } else {
            riskLevel = .high
        }
    }

    // MARK: - Formula String
    var formulaString: String {
        "((U+C+I) × (10-S)) / 20 × A × 1/(1-sin(F/10))"
    }

    var formulaWithValues: String {
        let u = Int(urgency)
        let c = Int(complexity)
        let i = Int(importance)
        let s = Int(skillLevel)
        let f = Int(frequency)

        return "((\(u)+\(c)+\(i)) × (10-\(s))) / 20 × 1.0 × 1/(1-sin(\(f)/10))"
    }

    // MARK: - Share Results
    func shareViaEmail(to email: String) async {
        isSharing = true
        shareError = nil

        do {
            _ = try await apiService.shareCalculation(
                email: email,
                urgency: Int(urgency),
                complexity: Int(complexity),
                importance: Int(importance),
                skillLevel: Int(skillLevel),
                frequency: Int(frequency),
                probability: probability
            )
        } catch {
            shareError = error
            print("Error sharing calculation: \(error)")
        }

        isSharing = false
    }

    // MARK: - Share Text (for iOS share sheet)
    var shareText: String {
        """
        My task has a \(String(format: "%.1f", probability))% chance of going wrong! \(riskLevel.emoji)

        Sod's Law Calculator
        Urgency: \(Int(urgency))
        Complexity: \(Int(complexity))
        Importance: \(Int(importance))
        Skill Level: \(Int(skillLevel))
        Frequency: \(Int(frequency))

        #MurphysLaw
        """
    }

    // MARK: - Reset
    func reset() {
        urgency = 5
        complexity = 5
        importance = 5
        skillLevel = 5
        frequency = 5
        calculate()
    }
}
