//
//  MarkdownContentTests.swift
//  MurphysLawsTests
//
//  Tests for markdown content loading and link handling
//

import XCTest
@testable import MurphysLaws

final class MarkdownContentTests: XCTestCase {
    
    func testContentPageRawValues() {
        XCTAssertEqual(ContentPage.about.rawValue, "about")
        XCTAssertEqual(ContentPage.privacy.rawValue, "privacy")
        XCTAssertEqual(ContentPage.terms.rawValue, "terms")
        XCTAssertEqual(ContentPage.contact.rawValue, "contact")
    }
    
    func testContentPageTitles() {
        XCTAssertEqual(ContentPage.about.title, "About")
        XCTAssertEqual(ContentPage.privacy.title, "Privacy Policy")
        XCTAssertEqual(ContentPage.terms.title, "Terms of Service")
        XCTAssertEqual(ContentPage.contact.title, "Contact")
    }
    
    func testSharedContentLoaderExists() {
        let loader = SharedContentLoader.shared
        XCTAssertNotNil(loader)
    }
}

final class HTMLLinkParsingTests: XCTestCase {
    
    func testSimpleDataNavLink() {
        let html = ##"<a href="#" data-nav="contact">Reach out</a>"##
        let pattern = ##"data-nav="([^"]+)""##
        
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            XCTFail("Failed to create regex")
            return
        }
        
        let nsString = html as NSString
        if let match = regex.firstMatch(in: html, options: [], range: NSRange(location: 0, length: nsString.length)) {
            XCTAssertGreaterThanOrEqual(match.numberOfRanges, 2, "Should capture the value")
            
            if match.numberOfRanges >= 2 {
                let valueRange = match.range(at: 1)
                if valueRange.location != NSNotFound {
                    let value = nsString.substring(with: valueRange)
                    XCTAssertEqual(value, "contact", "Should extract 'contact' from data-nav")
                }
            }
        } else {
            XCTFail("Failed to match data-nav pattern")
        }
    }
    
    func testMultipleDataNavLinks() {
        let html = ##"Have a story? <a href="#" data-nav="contact">Reach out</a> or <a href="#" data-nav="browse">browse</a>."##
        let pattern = ##"data-nav="([^"]+)""##
        
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            XCTFail("Failed to create regex")
            return
        }
        
        let matches = regex.matches(in: html, options: [], range: NSRange(location: 0, length: (html as NSString).length))
        XCTAssertEqual(matches.count, 2, "Should find 2 data-nav attributes")
    }
    
    func testExternalLink() {
        let html = ##"<a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0 1.0</a>"##
        let pattern = ##"data-nav="([^"]+)""##
        
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            XCTFail("Failed to create regex")
            return
        }
        
        let matches = regex.matches(in: html, options: [], range: NSRange(location: 0, length: (html as NSString).length))
        XCTAssertTrue(matches.isEmpty, "External links should not have data-nav attribute")
    }
    
    func testHTMLLinkExtraction() {
        let pattern = ##"<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["\'][^>]*>([^<]*)</a>"##
        let html = ##"<a href="#" data-nav="contact">Reach out</a>"##
        
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            XCTFail("Failed to create regex")
            return
        }
        
        let nsString = html as NSString
        if let match = regex.firstMatch(in: html, options: [], range: NSRange(location: 0, length: nsString.length)) {
            XCTAssertEqual(match.numberOfRanges, 3, "Should capture href and text")
            
            if match.numberOfRanges == 3 {
                let hrefRange = match.range(at: 1)
                let textRange = match.range(at: 2)
                
                if hrefRange.location != NSNotFound {
                    let href = nsString.substring(with: hrefRange)
                    XCTAssertEqual(href, "#")
                }
                
                if textRange.location != NSNotFound {
                    let text = nsString.substring(with: textRange)
                    XCTAssertEqual(text, "Reach out")
                }
            }
        } else {
            XCTFail("Failed to match HTML link pattern")
        }
    }
}

final class NavigationTargetTests: XCTestCase {
    
    func testInternalNavigationTargets() {
        let internalTargets = ["contact", "browse", "categories", "calculator", "home", "submit", "privacy", "terms"]
        
        for target in internalTargets {
            XCTAssertFalse(target.hasPrefix("http"), "\(target) should not be an external URL")
            XCTAssertFalse(target.contains("://"), "\(target) should not be an external URL")
        }
    }
    
    func testExternalURLs() {
        let externalURLs = [
            "https://creativecommons.org/publicdomain/zero/1.0/",
            "mailto:contact@murphys-laws.com",
            "https://murphys-laws.com"
        ]
        
        for url in externalURLs {
            XCTAssertTrue(url.contains("://") || url.hasPrefix("mailto:"), "\(url) should be identified as external")
        }
    }
    
    func testNavigationTargetNormalization() {
        // Test that various formats can be normalized to targets
        let testCases: [(input: String, expected: String)] = [
            ("contact", "contact"),
            ("#contact", "contact"),
            ("Browse", "browse"),
            ("CATEGORIES", "categories")
        ]
        
        for testCase in testCases {
            let normalized = testCase.input.lowercased().replacingOccurrences(of: "#", with: "")
            XCTAssertEqual(normalized, testCase.expected, "'\(testCase.input)' should normalize to '\(testCase.expected)'")
        }
    }
}

final class ContentPageIntegrationTests: XCTestCase {
    
    func testMarkdownFilesExist() async {
        let pages: [ContentPage] = [.about, .privacy, .terms, .contact]
        let loader = SharedContentLoader.shared
        
        for page in pages {
            let content = loader.loadContent(for: page)
            XCTAssertNotNil(content, "\(page.rawValue).md should exist and load successfully")
            
            if let content = content {
                XCTAssertFalse(content.isEmpty, "\(page.rawValue).md should not be empty")
            }
        }
    }
    
    func testAboutPageInternalLinks() async {
        let loader = SharedContentLoader.shared
        guard let content = loader.loadContent(for: .about) else {
            XCTFail("Failed to load about.md")
            return
        }
        
        // Check for known internal navigation links
        XCTAssertTrue(content.contains("data-nav=\"contact\""), "About page should have contact link")
        XCTAssertTrue(content.contains("data-nav=\"browse\""), "About page should have browse link")
    }
    
    func testPrivacyPageContactLink() async {
        let loader = SharedContentLoader.shared
        guard let content = loader.loadContent(for: .privacy) else {
            XCTFail("Failed to load privacy.md")
            return
        }
        
        XCTAssertTrue(content.contains("data-nav=\"contact\""), "Privacy page should have contact link")
    }
    
    func testTermsPageNavigationLinks() async {
        let loader = SharedContentLoader.shared
        guard let content = loader.loadContent(for: .terms) else {
            XCTFail("Failed to load terms.md")
            return
        }
        
        // Terms page should link to privacy and contact
        XCTAssertTrue(content.contains("data-nav=\"privacy\"") || content.contains("data-nav=\"contact\""), 
                      "Terms page should have navigation links")
    }
    
    func testContactPageSubmitLink() async {
        let loader = SharedContentLoader.shared
        guard let content = loader.loadContent(for: .contact) else {
            XCTFail("Failed to load contact.md")
            return
        }
        
        XCTAssertTrue(content.contains("data-nav=\"submit\""), "Contact page should have submit link")
    }
}
