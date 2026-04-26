//
//  ImageCache.swift
//  MurphysLaws
//
//  Image caching for performance
//

import SwiftUI

// MARK: - Image Cache
actor ImageCache {
    static let shared = ImageCache()
    
    private var cache: [URL: CachedImage] = [:]
    private let maxCacheSize = 100 // Maximum number of images to cache
    
    private struct CachedImage {
        let image: UIImage
        let timestamp: Date
    }
    
    private init() {}
    
    func image(for url: URL) -> UIImage? {
        // Clean up old cache entries
        cleanCacheIfNeeded()
        
        // Return cached image if available
        guard let cached = cache[url] else { return nil }
        
        // Check if cache is still fresh (within 1 hour)
        let cacheAge = Date().timeIntervalSince(cached.timestamp)
        if cacheAge > Constants.Performance.cacheMaxAge {
            cache.removeValue(forKey: url)
            return nil
        }
        
        return cached.image
    }
    
    func cache(_ image: UIImage, for url: URL) {
        cleanCacheIfNeeded()
        cache[url] = CachedImage(image: image, timestamp: Date())
    }
    
    func clear() {
        cache.removeAll()
    }
    
    private func cleanCacheIfNeeded() {
        guard cache.count > maxCacheSize else { return }
        
        // Remove oldest entries
        let sortedCache = cache.sorted { $0.value.timestamp < $1.value.timestamp }
        let entriesToRemove = sortedCache.prefix(cache.count - maxCacheSize)
        
        for (url, _) in entriesToRemove {
            cache.removeValue(forKey: url)
        }
    }
}

// MARK: - Cached Async Image View
struct CachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL?
    @ViewBuilder let content: (Image) -> Content
    @ViewBuilder let placeholder: () -> Placeholder
    
    @State private var image: UIImage?
    @State private var isLoading = false
    
    var body: some View {
        Group {
            if let image = image {
                content(Image(uiImage: image))
            } else {
                placeholder()
                    .task {
                        await loadImage()
                    }
            }
        }
    }
    
    private func loadImage() async {
        guard let url = url, image == nil, !isLoading else { return }
        
        isLoading = true
        
        // Check cache first
        if let cachedImage = await ImageCache.shared.image(for: url) {
            image = cachedImage
            isLoading = false
            return
        }
        
        // Download image
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            if let downloadedImage = UIImage(data: data) {
                await ImageCache.shared.cache(downloadedImage, for: url)
                image = downloadedImage
            }
        } catch {
            print("Failed to load image: \(error)")
        }
        
        isLoading = false
    }
}

// MARK: - Convenience Initializer
extension CachedAsyncImage where Content == Image, Placeholder == ProgressView<EmptyView, EmptyView> {
    init(url: URL?) {
        self.url = url
        self.content = { $0.resizable() }
        self.placeholder = { ProgressView() }
    }
}

#Preview {
    CachedAsyncImage(url: URL(string: "https://example.com/image.jpg")) { image in
        image
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: 100, height: 100)
            .clipShape(RoundedRectangle(cornerRadius: 8))
    } placeholder: {
        Rectangle()
            .fill(DS.Color.surface)
            .frame(width: 100, height: 100)
            .overlay(ProgressView())
    }
}
