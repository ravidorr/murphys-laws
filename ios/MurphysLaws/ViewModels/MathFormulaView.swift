//
//  MathFormulaView.swift
//  MurphysLaws
//
//  Renders LaTeX/TeX mathematical formulas using MathJax
//

import SwiftUI
import WebKit

struct MathFormulaView: View {
    let latex: String
    let fontSize: CGFloat
    @State private var renderedHeight: CGFloat = 60
    @State private var renderedWidth: CGFloat = 300
    
    init(_ latex: String, fontSize: CGFloat = 16) {
        self.latex = latex
        self.fontSize = fontSize
    }
    
    var body: some View {
        MathJaxWebView(
            latex: latex,
            fontSize: fontSize,
            renderedHeight: $renderedHeight,
            renderedWidth: $renderedWidth
        )
        .frame(width: renderedWidth, height: renderedHeight)
    }
}

struct MathJaxWebView: UIViewRepresentable {
    let latex: String
    let fontSize: CGFloat
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
        let html = createHTML(latex: latex, fontSize: fontSize)
        webView.loadHTMLString(html, baseURL: nil)
    }
    
    private func createHTML(latex: String, fontSize: CGFloat) -> String {
        let isDarkMode = UITraitCollection.current.userInterfaceStyle == .dark
        let textColor = isDarkMode ? "#FFFFFF" : "#000000"
        
        return """
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
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
            <style>
                * {
                    box-sizing: border-box;
                }
                html, body {
                    margin: 0;
                    padding: 0;
                    width: 100%;
                    overflow-x: visible;
                    overflow-y: hidden;
                }
                body {
                    padding: 12px 16px;
                    font-size: \(fontSize)px;
                    color: \(textColor);
                    background: transparent;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif;
                }
                .math-container {
                    display: inline-block;
                    white-space: nowrap;
                    min-width: 100%;
                    padding-right: 20px;
                }
                mjx-container {
                    display: inline-block !important;
                    margin: 0 !important;
                }
            </style>
        </head>
        <body>
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
                        self.parent.renderedHeight = max(height, 40)
                    }
                }
            }
            
            webView.evaluateJavaScript("document.body.scrollWidth") { result, error in
                if let width = result as? CGFloat {
                    DispatchQueue.main.async {
                        self.parent.renderedWidth = max(width, 100)
                    }
                }
            }
        }
        
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "sizeChanged", let dict = message.body as? [String: Any] {
                if let height = dict["height"] as? CGFloat {
                    DispatchQueue.main.async {
                        self.parent.renderedHeight = max(height, 40)
                    }
                }
                if let width = dict["width"] as? CGFloat {
                    DispatchQueue.main.async {
                        self.parent.renderedWidth = max(width, 100)
                    }
                }
            }
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        Text("Sod's Law Formula")
            .font(.headline)
        
        MathFormulaView("\\frac{(U+C+I) \\times (10-S)}{20} \\times A \\times \\frac{1}{1-\\sin(\\frac{F}{10})}", fontSize: 18)
            .background(Color(.systemGray6))
            .cornerRadius(8)
        
        Text("Einstein's Formula")
            .font(.headline)
        
        MathFormulaView("E = mc^2", fontSize: 24)
            .background(Color(.systemGray6))
            .cornerRadius(8)
        
        Text("Quadratic Formula")
            .font(.headline)
        
        MathFormulaView("x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}", fontSize: 16)
            .background(Color(.systemGray6))
            .cornerRadius(8)
    }
    .padding()
}
