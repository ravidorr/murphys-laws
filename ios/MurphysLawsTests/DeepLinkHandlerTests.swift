import XCTest
@testable import MurphysLaws

final class DeepLinkHandlerTests: XCTestCase {
    func testParsesHostBasedLawURL() {
        let url = URL(string: "murphyslaws://law/123")!

        XCTAssertEqual(DeepLink(url: url), .law(id: 123))
    }

    func testParsesHostBasedCategoryURL() {
        let url = URL(string: "murphyslaws://category/5")!

        XCTAssertEqual(DeepLink(url: url), .category(id: 5))
    }

    func testParsesHostBasedCalculatorURL() {
        let url = URL(string: "murphyslaws://calculator")!

        XCTAssertEqual(DeepLink(url: url), .calculator)
    }

    func testBuilderOutputParsesAsDeepLinks() {
        XCTAssertEqual(DeepLink(url: DeepLinkBuilder.lawURL(id: 123)), .law(id: 123))
        XCTAssertEqual(DeepLink(url: DeepLinkBuilder.categoryURL(id: 5)), .category(id: 5))
        XCTAssertEqual(DeepLink(url: DeepLinkBuilder.calculatorURL()), .calculator)
        XCTAssertEqual(DeepLink(url: DeepLinkBuilder.submitURL()), .submit)
    }

    func testPathBasedURLsStillParse() {
        let url = URL(string: "murphyslaws:///law/123")!

        XCTAssertEqual(DeepLink(url: url), .law(id: 123))
    }

    func testRejectsWrongScheme() {
        let url = URL(string: "https://law/123")!

        XCTAssertNil(DeepLink(url: url))
    }
}
