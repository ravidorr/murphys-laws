//
//  MathFormulaView.swift
//  MurphysLaws
//
//  Renders LaTeX/TeX mathematical formulas using MathJax
//

import SwiftUI
import WebKit

enum MathFormulaSize: String {
    case bodySm = "body-sm"
    case bodyMd = "body-md"
    case bodyLg = "body-lg"
    case h3
}

struct MathFormulaView: View {
    let latex: String
    let size: MathFormulaSize
    @State private var renderedHeight: CGFloat = DS.Spacing.s16
    @State private var renderedWidth: CGFloat = DS.Layout.contentRailWidth
    
    init(_ latex: String, size: MathFormulaSize = .bodyMd) {
        self.latex = latex
        self.size = size
    }
    
    var body: some View {
        MathJaxWebView(
            latex: latex,
            size: size,
            renderedHeight: $renderedHeight,
            renderedWidth: $renderedWidth
        )
        .frame(width: renderedWidth, height: renderedHeight)
    }
}

struct MathJaxWebView: UIViewRepresentable {
    let latex: String
    let size: MathFormulaSize
    @Binding var renderedHeight: CGFloat
    @Binding var renderedWidth: CGFloat
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.showsHorizontalScrollIndicator = false
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.scrollView.bounces = false
        
        return webView
    }
    
    func updateUIView(_ webView: WKWebView, context: Context) {
        let html = createHTML(latex: latex, size: size)
        webView.loadHTMLString(html, baseURL: Bundle.main.resourceURL)
    }
    
    private func createHTML(latex: String, size: MathFormulaSize) -> String {
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <link rel="stylesheet" href="math-formula.css">
            <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
            <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
            <script>
                MathJax = {
                    tex: {
                        inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                        displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
                    },
                    startup: {
                        ready: () => {
                            MathJax.startup.defaultReady();
                            MathJax.startup.promise.then(() => {
                                updateHeight();
                            });
                        }
                    },
                    svg: {
                        scale: 1,
                        minScale: 0.5,
                        mtextInheritFont: true,
                        merrorInheritFont: true,
                        mathmlSpacing: false,
                        skipAttributes: {},
                        exFactor: 0.5,
                        displayAlign: 'center',
                        displayIndent: '0'
                    }
                };
                
                function updateHeight() {
                    const height = document.body.scrollHeight;
                    const width = document.body.scrollWidth;
                    window.webkit.messageHandlers.sizeChanged.postMessage({height: height, width: width});
                }
            </script>
        </head>
        <body class="formula-size--\(size.rawValue)">
            <div class="math-container">
                $$\(latex)$$
            </div>
        </body>
        </html>
        """
    }
    
    class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var parent: MathJaxWebView
        
        init(_ parent: MathJaxWebView) {
            self.parent = parent
            super.init()
        }
        
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            // Add message handler for size updates
            webView.configuration.userContentController.removeScriptMessageHandler(forName: "sizeChanged")
            webView.configuration.userContentController.add(self, name: "sizeChanged")
            
            // Evaluate JavaScript to get the content dimensions
            webView.evaluateJavaScript("document.body.scrollHeight") { result, error in
                if let height = result as? CGFloat {
                    DispatchQueue.main.async {
                        self.parent.renderedHeight = max(height, DS.Spacing.s10)
                    }
                }
            }
            
            webView.evaluateJavaScript("document.body.scrollWidth") { result, error in
                if let width = result as? CGFloat {
                    DispatchQueue.main.async {
                        self.parent.renderedWidth = max(width, DS.Layout.thumbnailSize)
                    }
                }
            }
        }
        
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "sizeChanged", let dict = message.body as? [String: Any] {
                if let height = dict["height"] as? CGFloat {
                    DispatchQueue.main.async {
                        self.parent.renderedHeight = max(height, DS.Spacing.s10)
                    }
                }
                if let width = dict["width"] as? CGFloat {
                    DispatchQueue.main.async {
                        self.parent.renderedWidth = max(width, DS.Layout.thumbnailSize)
                    }
                }
            }
        }
    }
}

#Preview {
    VStack(spacing: DS.Spacing.s5) {
        Text("Sod's Law Formula")
            .dsTypography(DS.Typography.h4)
        
        MathFormulaView("\\frac{(U+C+I) \\times (10-S)}{20} \\times A \\times \\frac{1}{1-\\sin(\\frac{F}{10})}", size: .bodyLg)
            .background(DS.Color.surface)
            .cornerRadius(DS.Radius.lg)
        
        Text("Einstein's Formula")
            .dsTypography(DS.Typography.h4)
        
        MathFormulaView("E = mc^2", size: .h3)
            .background(DS.Color.surface)
            .cornerRadius(DS.Radius.lg)
        
        Text("Quadratic Formula")
            .dsTypography(DS.Typography.h4)
        
        MathFormulaView("x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}")
            .background(DS.Color.surface)
            .cornerRadius(DS.Radius.lg)
    }
    .padding()
}
