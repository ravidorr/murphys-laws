//
//  MarkdownContentView.swift
//  MurphysLaws
//
//  Renders shared markdown content with native SwiftUI
//

import SwiftUI

public struct MarkdownContentView: View {
    public let page: ContentPage
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var tabCoordinator: TabNavigationCoordinator

    @State private var sections: [MarkdownSection] = []
    @State private var isLoading = true
    @State private var error: String?

    public init(page: ContentPage) {
        self.page = page
    }

    public var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    ProgressView("Loading...")
                } else if let error = error {
                    errorView(error)
                } else {
                    ScrollView {
                        VStack(alignment: .leading, spacing: Constants.UI.spacingL) {
                            // Show last updated date if available
                            if let lastUpdated = SharedContentLoader.shared.getLastUpdated(for: page) {
                                Text("Last updated: \(lastUpdated)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .padding(.horizontal)
                            }

                            // Render markdown sections with proper spacing
                            ForEach(sections) { section in
                                section.view(onNavigate: handleNavigation)
                                    .textSelection(.enabled)
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle(page.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .onAppear {
                loadContent()
            }
        }
    }
    
    private func handleNavigation(_ destination: String) {
        // Parse data-nav attribute or hash link
        let target = destination.lowercased()
        
        // Check what kind of navigation this is
        let isTabNavigation = target.contains("browse") || target == "#browse" ||
                              target.contains("categories") || target == "#categories" ||
                              target.contains("calculator") || target == "#calculator" ||
                              target.contains("home") || target == "#home"
        
        let isSheetNavigation = target.contains("contact") || target == "#contact" ||
                                target.contains("submit") || target == "#submit"
        
        if isTabNavigation {
            // For tab navigation, set target then dismiss
            if target.contains("browse") || target == "#browse" {
                tabCoordinator.navigate(to: .browse)
            } else if target.contains("categories") || target == "#categories" {
                tabCoordinator.navigate(to: .categories)
            } else if target.contains("calculator") || target == "#calculator" {
                tabCoordinator.navigate(to: .calculator)
            } else if target.contains("home") || target == "#home" {
                tabCoordinator.navigate(to: .home)
            }
            
            // Dismiss with a delay to allow tab change to process
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                dismiss()
            }
        } else if isSheetNavigation {
            // For sheet-to-sheet navigation, just dismiss current sheet
            // The coordinator flags will be checked when user returns to More tab
            if target.contains("contact") || target == "#contact" {
                // If we're not already on the contact page, note it for later
                if page != .contact {
                    tabCoordinator.showingContact = true
                }
            } else if target.contains("submit") || target == "#submit" {
                tabCoordinator.showingSubmit = true
            }
            dismiss()
        } else {
            // Unknown navigation target, just dismiss
            dismiss()
        }
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: Constants.UI.spacingM) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 48))
                .foregroundColor(.orange)

            Text("Content Unavailable")
                .font(.headline)

            Text(message)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .padding()
    }

    private func loadContent() {
        isLoading = true
        error = nil

        // Load markdown content from shared directory
        guard let content = SharedContentLoader.shared.loadContent(for: page) else {
            error = "Could not load \(page.title) content. Please try again later."
            isLoading = false
            return
        }

        // Parse markdown into structured sections
        sections = parseMarkdown(content)
        isLoading = false
    }

    private func parseMarkdown(_ markdown: String) -> [MarkdownSection] {
        var sections: [MarkdownSection] = []
        let lines = markdown.components(separatedBy: .newlines)
        
        var currentParagraph = ""
        var sectionId = 0
        
        for line in lines {
            let trimmedLine = line.trimmingCharacters(in: .whitespaces)
            
            // Skip empty lines
            if trimmedLine.isEmpty {
                // If we have accumulated paragraph text, save it
                if !currentParagraph.isEmpty {
                    sections.append(MarkdownSection(id: sectionId, type: .paragraph, content: currentParagraph, htmlLinks: extractHTMLLinks(from: currentParagraph)))
                    sectionId += 1
                    currentParagraph = ""
                }
                continue
            }
            
            // Handle headers
            if trimmedLine.hasPrefix("###") {
                // Save any accumulated paragraph
                if !currentParagraph.isEmpty {
                    sections.append(MarkdownSection(id: sectionId, type: .paragraph, content: currentParagraph, htmlLinks: extractHTMLLinks(from: currentParagraph)))
                    sectionId += 1
                    currentParagraph = ""
                }
                let headerText = trimmedLine.dropFirst(3).trimmingCharacters(in: .whitespaces)
                sections.append(MarkdownSection(id: sectionId, type: .header3, content: headerText, htmlLinks: []))
                sectionId += 1
            } else if trimmedLine.hasPrefix("##") {
                // Save any accumulated paragraph
                if !currentParagraph.isEmpty {
                    sections.append(MarkdownSection(id: sectionId, type: .paragraph, content: currentParagraph, htmlLinks: extractHTMLLinks(from: currentParagraph)))
                    sectionId += 1
                    currentParagraph = ""
                }
                let headerText = trimmedLine.dropFirst(2).trimmingCharacters(in: .whitespaces)
                sections.append(MarkdownSection(id: sectionId, type: .header2, content: headerText, htmlLinks: []))
                sectionId += 1
            } else if trimmedLine.hasPrefix("#") {
                // Save any accumulated paragraph
                if !currentParagraph.isEmpty {
                    sections.append(MarkdownSection(id: sectionId, type: .paragraph, content: currentParagraph, htmlLinks: extractHTMLLinks(from: currentParagraph)))
                    sectionId += 1
                    currentParagraph = ""
                }
                let headerText = trimmedLine.dropFirst(1).trimmingCharacters(in: .whitespaces)
                sections.append(MarkdownSection(id: sectionId, type: .header1, content: headerText, htmlLinks: []))
                sectionId += 1
            } else if trimmedLine.hasPrefix(">") {
                // Save any accumulated paragraph
                if !currentParagraph.isEmpty {
                    sections.append(MarkdownSection(id: sectionId, type: .paragraph, content: currentParagraph, htmlLinks: extractHTMLLinks(from: currentParagraph)))
                    sectionId += 1
                    currentParagraph = ""
                }
                let quoteText = trimmedLine.dropFirst(1).trimmingCharacters(in: .whitespaces)
                sections.append(MarkdownSection(id: sectionId, type: .quote, content: quoteText, htmlLinks: extractHTMLLinks(from: quoteText)))
                sectionId += 1
            } else if trimmedLine.hasPrefix("- ") {
                // Save any accumulated paragraph
                if !currentParagraph.isEmpty {
                    sections.append(MarkdownSection(id: sectionId, type: .paragraph, content: currentParagraph, htmlLinks: extractHTMLLinks(from: currentParagraph)))
                    sectionId += 1
                    currentParagraph = ""
                }
                let bulletText = trimmedLine.dropFirst(2).trimmingCharacters(in: .whitespaces)
                sections.append(MarkdownSection(id: sectionId, type: .bullet, content: bulletText, htmlLinks: extractHTMLLinks(from: bulletText)))
                sectionId += 1
            } else {
                // Regular paragraph line - accumulate it
                if !currentParagraph.isEmpty {
                    currentParagraph += " "
                }
                currentParagraph += trimmedLine
            }
        }
        
        // Save any remaining paragraph
        if !currentParagraph.isEmpty {
            sections.append(MarkdownSection(id: sectionId, type: .paragraph, content: currentParagraph, htmlLinks: extractHTMLLinks(from: currentParagraph)))
        }
        
        return sections
    }
    
    // Extract HTML links from text and return structured data
    private func extractHTMLLinks(from text: String) -> [HTMLLink] {
        var links: [HTMLLink] = []
        let pattern = #"<a\s+(?:[^>]*?\s+)?href=["\']([^"\']*)["\'][^>]*>([^<]*)</a>"#
        
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return links
        }
        
        let nsString = text as NSString
        let matches = regex.matches(in: text, options: [], range: NSRange(location: 0, length: nsString.length))
        
        for match in matches {
            if match.numberOfRanges == 3 {
                let hrefRange = match.range(at: 1)
                let textRange = match.range(at: 2)
                let fullRange = match.range(at: 0)
                
                if hrefRange.location != NSNotFound, textRange.location != NSNotFound {
                    let href = nsString.substring(with: hrefRange)
                    let linkText = nsString.substring(with: textRange)
                    let fullMatch = nsString.substring(with: fullRange)
                    
                    links.append(HTMLLink(
                        href: href,
                        text: linkText,
                        fullMatch: fullMatch,
                        range: fullRange
                    ))
                }
            }
        }
        
        return links
    }
}

// MARK: - Markdown Section Model
struct MarkdownSection: Identifiable {
    let id: Int
    let type: SectionType
    let content: String
    let htmlLinks: [HTMLLink]
    
    enum SectionType {
        case header1, header2, header3, paragraph, quote, bullet
    }
    
    @ViewBuilder
    func view(onNavigate: @escaping (String) -> Void) -> some View {
        switch type {
        case .header1:
            Text(content)
                .font(.title)
                .fontWeight(.bold)
                .padding(.horizontal)
                .padding(.top, Constants.UI.spacingM)
            
        case .header2:
            Text(content)
                .font(.title2)
                .fontWeight(.semibold)
                .padding(.horizontal)
                .padding(.top, Constants.UI.spacingM)
            
        case .header3:
            Text(content)
                .font(.title3)
                .fontWeight(.semibold)
                .padding(.horizontal)
                .padding(.top, Constants.UI.spacingS)
            
        case .paragraph:
            renderTextWithLinks(content: content, font: .body, isItalic: false, onNavigate: onNavigate)
                .padding(.horizontal)
            
        case .quote:
            HStack(alignment: .top, spacing: Constants.UI.spacingS) {
                Rectangle()
                    .fill(Color.accentColor.opacity(0.3))
                    .frame(width: 4)
                
                renderTextWithLinks(content: content, font: .body, isItalic: true, onNavigate: onNavigate)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal)
            
        case .bullet:
            HStack(alignment: .top, spacing: Constants.UI.spacingS) {
                Text("•")
                    .font(.body)
                    .foregroundColor(.accentColor)
                renderTextWithLinks(content: content, font: .body, isItalic: false, onNavigate: onNavigate)
            }
            .padding(.horizontal)
            .padding(.leading, Constants.UI.spacingM)
        }
    }
    
    // Render text with HTML links replaced by SwiftUI Links or navigation actions
    @ViewBuilder
    private func renderTextWithLinks(content: String, font: Font, isItalic: Bool, onNavigate: @escaping (String) -> Void) -> some View {
        if htmlLinks.isEmpty {
            // No HTML links, use standard markdown parsing
            let text = Text(parseInlineMarkdown(content))
                .font(font)
            
            if isItalic {
                text.italic()
            } else {
                text
            }
        } else {
            // Has HTML links - render as flow layout with Text + Link components
            FlowTextWithLinks(
                content: content,
                htmlLinks: htmlLinks,
                font: font,
                isItalic: isItalic,
                onNavigate: onNavigate
            )
        }
    }
    
    // Parse inline markdown like **bold**, *italic*, and links
    private func parseInlineMarkdown(_ text: String) -> AttributedString {
        do {
            return try AttributedString(markdown: text, options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnly))
        } catch {
            return AttributedString(text)
        }
    }
}

// MARK: - HTML Link Model
struct HTMLLink {
    let href: String
    let text: String
    let fullMatch: String
    let range: NSRange
}

// MARK: - Flow Text with Links
struct FlowTextWithLinks: View {
    let content: String
    let htmlLinks: [HTMLLink]
    let font: Font
    let isItalic: Bool
    let onNavigate: (String) -> Void
    
    @Environment(\.openURL) private var openURL
    
    private enum Segment {
        case text(String)
        case link(HTMLLink)
    }
    
    var body: some View {
        // Build text segments between links
        let segments = buildSegments()
        
        // Create horizontal flow of text and links by concatenating Text views
        let combinedText = segments.map { segment -> Text in
            switch segment {
            case .text(let string):
                var text = parseMarkdownText(string)
                if isItalic {
                    text = text.italic()
                }
                return text
                
            case .link(let link):
                // Check if it's an internal navigation link
                if isInternalLink(link.href) {
                    // For internal links, create tappable button-style text
                    var text = Text(link.text)
                        .foregroundColor(.accentColor)
                        .underline()
                    if isItalic {
                        text = text.italic()
                    }
                    return text
                } else {
                    // Convert external HTML link to markdown link format
                    let markdownLink = "[\(link.text)](\(link.href))"
                    var text = parseMarkdownText(markdownLink)
                    if isItalic {
                        text = text.italic()
                    }
                    return text
                }
            }
        }.reduce(Text(""), +)
        
        combinedText
            .font(font)
            .onTapGesture {
                handleTap()
            }
    }
    
    private func isInternalLink(_ href: String) -> Bool {
        // A link is internal if it starts with # (these links will have data-nav in fullMatch)
        return href.hasPrefix("#") || href.isEmpty
    }
    
    private func handleTap() {
        // Find if there's an internal link in this text
        for link in htmlLinks where isInternalLink(link.href) {
            // Check if fullMatch contains data-nav attribute
            if link.fullMatch.contains("data-nav") {
                // Extract the data-nav value from the original HTML
                if let navMatch = link.fullMatch.range(of: #"data-nav="([^"]+)""#, options: .regularExpression) {
                    let navString = String(link.fullMatch[navMatch])
                    if let valueMatch = navString.range(of: #"="([^"]+)""#, options: .regularExpression) {
                        let value = navString[valueMatch].replacingOccurrences(of: "=\"", with: "").replacingOccurrences(of: "\"", with: "")
                        onNavigate(value)
                        return
                    }
                }
            } else if link.href.hasPrefix("#") {
                // Use the hash fragment
                onNavigate(link.href)
                return
            }
        }
    }
    
    private func buildSegments() -> [Segment] {
        var segments: [Segment] = []
        var remainingContent = content
        
        // Sort links by position
        let sortedLinks = htmlLinks.sorted { $0.range.location < $1.range.location }
        
        for link in sortedLinks {
            // Find where this link starts in the remaining content
            if let linkRange = remainingContent.range(of: link.fullMatch) {
                // Add text before the link
                let beforeText = String(remainingContent[..<linkRange.lowerBound])
                if !beforeText.isEmpty {
                    segments.append(.text(beforeText))
                }
                
                // Add the link
                segments.append(.link(link))
                
                // Update remaining content
                remainingContent = String(remainingContent[linkRange.upperBound...])
            }
        }
        
        // Add any remaining text
        if !remainingContent.isEmpty {
            segments.append(.text(remainingContent))
        }
        
        return segments
    }
    
    private func parseMarkdownText(_ text: String) -> Text {
        if let attributed = try? AttributedString(markdown: text, options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnly)) {
            return Text(attributed)
        }
        return Text(text)
    }
}

#Preview("About") {
    MarkdownContentView(page: .about)
        .environmentObject(TabNavigationCoordinator.shared)
}

#Preview("Privacy") {
    MarkdownContentView(page: .privacy)
        .environmentObject(TabNavigationCoordinator.shared)
}

#Preview("Terms") {
    MarkdownContentView(page: .terms)
        .environmentObject(TabNavigationCoordinator.shared)
}

#Preview("Contact") {
    MarkdownContentView(page: .contact)
        .environmentObject(TabNavigationCoordinator.shared)
}
