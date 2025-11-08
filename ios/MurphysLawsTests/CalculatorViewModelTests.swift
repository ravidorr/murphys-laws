import XCTest
@testable import MurphysLaws

@MainActor
final class CalculatorViewModelTests: XCTestCase {
    var viewModel: CalculatorViewModel!

    override func setUp() {
        super.setUp()
        viewModel = CalculatorViewModel()
    }

    override func tearDown() {
        viewModel = nil
        super.tearDown()
    }

    func testInitialState() {
        XCTAssertEqual(viewModel.urgency, 5.0)
        XCTAssertEqual(viewModel.complexity, 5.0)
        XCTAssertEqual(viewModel.importance, 5.0)
        XCTAssertEqual(viewModel.skillLevel, 5.0)
        XCTAssertEqual(viewModel.frequency, 5.0)
    }

    func testCalculateProbability_MediumValues() {
        // Given
        viewModel.urgency = 5.0
        viewModel.complexity = 5.0
        viewModel.importance = 5.0
        viewModel.skillLevel = 5.0
        viewModel.frequency = 5.0

        // When
        let probability = viewModel.calculateProbability()

        // Then
        XCTAssertGreaterThan(probability, 0)
        XCTAssertLessThanOrEqual(probability, 100)
    }

    func testCalculateProbability_HighRisk() {
        // Given - High urgency, complexity, importance, low skill
        viewModel.urgency = 10.0
        viewModel.complexity = 10.0
        viewModel.importance = 10.0
        viewModel.skillLevel = 1.0
        viewModel.frequency = 10.0

        // When
        let probability = viewModel.calculateProbability()

        // Then
        XCTAssertGreaterThan(probability, 50) // Should be high risk
    }

    func testCalculateProbability_LowRisk() {
        // Given - Low urgency, complexity, importance, high skill
        viewModel.urgency = 1.0
        viewModel.complexity = 1.0
        viewModel.importance = 1.0
        viewModel.skillLevel = 10.0
        viewModel.frequency = 1.0

        // When
        let probability = viewModel.calculateProbability()

        // Then
        XCTAssertLessThan(probability, 50) // Should be lower risk
    }

    func testRiskLevel_Low() {
        // Given
        viewModel.urgency = 1.0
        viewModel.complexity = 1.0
        viewModel.importance = 1.0
        viewModel.skillLevel = 10.0
        viewModel.frequency = 1.0

        // When
        viewModel.calculate()
        let riskLevel = viewModel.riskLevel

        // Then
        XCTAssertEqual(riskLevel.rawValue, "Low")
    }

    func testRiskLevel_Medium() {
        // Given
        viewModel.urgency = 5.0
        viewModel.complexity = 5.0
        viewModel.importance = 5.0
        viewModel.skillLevel = 5.0
        viewModel.frequency = 5.0

        // When
        viewModel.calculate()
        let riskLevel = viewModel.riskLevel

        // Then
        XCTAssertEqual(riskLevel.rawValue, "Medium")
    }

    func testRiskLevel_High() {
        // Given
        viewModel.urgency = 10.0
        viewModel.complexity = 10.0
        viewModel.importance = 10.0
        viewModel.skillLevel = 1.0
        viewModel.frequency = 10.0

        // When
        viewModel.calculate()
        let riskLevel = viewModel.riskLevel

        // Then
        XCTAssertEqual(riskLevel.rawValue, "High")
    }

    func testRiskColor_Low() {
        // Given
        viewModel.urgency = 1.0
        viewModel.complexity = 1.0
        viewModel.importance = 1.0
        viewModel.skillLevel = 10.0
        viewModel.frequency = 1.0

        // When
        viewModel.calculate()
        let color = viewModel.riskColor

        // Then
        // Color should be green for low risk
        XCTAssertNotNil(color)
        XCTAssertEqual(color, "green")
    }

    func testRiskColor_Medium() {
        // Given
        viewModel.urgency = 5.0
        viewModel.complexity = 5.0
        viewModel.importance = 5.0
        viewModel.skillLevel = 5.0
        viewModel.frequency = 5.0

        // When
        viewModel.calculate()
        let color = viewModel.riskColor

        // Then
        // Color should be yellow/orange for medium risk
        XCTAssertNotNil(color)
        XCTAssertEqual(color, "yellow")
    }

    func testRiskColor_High() {
        // Given
        viewModel.urgency = 10.0
        viewModel.complexity = 10.0
        viewModel.importance = 10.0
        viewModel.skillLevel = 1.0
        viewModel.frequency = 10.0

        // When
        viewModel.calculate()
        let color = viewModel.riskColor

        // Then
        // Color should be red for high risk
        XCTAssertNotNil(color)
        XCTAssertEqual(color, "red")
    }

    func testResetValues() {
        // Given
        viewModel.urgency = 8.0
        viewModel.complexity = 7.0
        viewModel.importance = 9.0
        viewModel.skillLevel = 3.0
        viewModel.frequency = 6.0

        // When
        viewModel.reset()

        // Then
        XCTAssertEqual(viewModel.urgency, 5.0)
        XCTAssertEqual(viewModel.complexity, 5.0)
        XCTAssertEqual(viewModel.importance, 5.0)
        XCTAssertEqual(viewModel.skillLevel, 5.0)
        XCTAssertEqual(viewModel.frequency, 5.0)
    }

    func testFormulaDescription() {
        // When
        let formula = viewModel.formulaDescription

        // Then
        XCTAssertFalse(formula.isEmpty)
        XCTAssertTrue(formula.contains("U")) // Contains urgency
        XCTAssertTrue(formula.contains("C")) // Contains complexity
        XCTAssertTrue(formula.contains("I")) // Contains importance
        XCTAssertTrue(formula.contains("S")) // Contains skill level
    }
}
