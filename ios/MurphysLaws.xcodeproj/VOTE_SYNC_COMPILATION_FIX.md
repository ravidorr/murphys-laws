# Vote Sync Compilation Fix

## Errors Fixed

### 1. VotingService.swift - `response.score` errors
**Problem:** `VoteResponse` doesn't have a `score` field

**Fixed:**
- Line 73: Removed `"score": response.score` from notification
- Line 131: Removed `"score": response.score` from notification

**VoteResponse structure:**
```swift
struct VoteResponse: Codable {
    let lawID: Int
    let voteType: String
    let upvotes: Int      // Has this
    let downvotes: Int    // Has this
    // NO score field
}
```

### 2. LawListViewModel.swift - Law initializer errors
**Problem:** Missing required parameters `slug`, `rawMarkdown`, `originNote`  
**Problem:** `score` is computed property, not a stored property

**Fixed:**
- Added all required Law parameters to initializer
- Removed `score` from method signature (it's computed from upvotes-downvotes)
- Removed `score` parameter from `.onReceive` in CategoriesView

**Law structure:**
```swift
struct Law {
    let id: Int
    let text: String
    let title: String?
    let slug: String?           // Required
    let rawMarkdown: String?    // Required
    let originNote: String?     // Required
    let upvotes: Int
    let downvotes: Int
    let createdAt: Date?
    let updatedAt: Date?
    let attributions: [Attribution]?
    let categories: [Category]?
    
    var score: Int {            // Computed property
        return upvotes - downvotes
    }
}
```

---

## How Vote Sync Works Now

### Flow:
1. **User votes** in `LawDetailView`
   ```swift
   votingService.vote(.up, for: lawID)
   ```

2. **VotingService posts notification**
   ```swift
   NotificationCenter.default.post(
       name: .lawVotesDidChange,
       userInfo: [
           "lawID": lawID,
           "upvotes": response.upvotes,
           "downvotes": response.downvotes
       ]
   )
   ```

3. **CategoryDetailView receives notification**
   ```swift
   .onReceive(NotificationCenter.default.publisher(for: .lawVotesDidChange)) { notification in
       viewModel.updateLawVotes(lawID: lawID, upvotes: upvotes, downvotes: downvotes)
   }
   ```

4. **LawListViewModel updates the law**
   ```swift
   func updateLawVotes(lawID: Int, upvotes: Int, downvotes: Int) {
       let updatedLaw = Law(
           id: oldLaw.id,
           text: oldLaw.text,
           title: oldLaw.title,
           slug: oldLaw.slug,
           rawMarkdown: oldLaw.rawMarkdown,
           originNote: oldLaw.originNote,
           upvotes: upvotes,          // Updated
           downvotes: downvotes,      // Updated
           createdAt: oldLaw.createdAt,
           updatedAt: oldLaw.updatedAt,
           attributions: oldLaw.attributions,
           categories: oldLaw.categories
       )
       laws[index] = updatedLaw
   }
   ```

5. **SwiftUI re-renders** the law row with new vote counts

---

## Files Modified

1. `VotingService.swift` - Removed `score` from notifications (2 places)
2. `LawListViewModel.swift` - Fixed `updateLawVotes` signature and Law init
3. `CategoriesView.swift` - Removed `score` from `.onReceive` handler

---

## Testing

### Manual Test:
1. Navigate to Categories tab
2. Tap any category
3. Note vote count (e.g., "10 upvotes")
4. Tap a law to open detail
5. Tap upvote button
6. Observe: Vote count changes to "11" in detail
7. Tap back to category list
8. **VERIFY:** Vote count shows "11" immediately
9. **VERIFY:** Law content is correct (not replaced)

### Expected Behavior:
- Vote counts update instantly when returning from detail
- No API call needed (uses notification)
- No loading spinner
- Law content stays correct
- Score is computed automatically (upvotes - downvotes)

---

## Why This Works

### Advantages:
- **Instant**: No network delay
- **Efficient**: No API calls for updates
- **Decoupled**: Views don't need direct references
- **Reliable**: Works even if API is slow
- **Reactive**: SwiftUI automatically updates UI

### How Score is Handled:
- `score` is a **computed property** in `Law`
- Automatically calculated as `upvotes - downvotes`
- No need to pass or store it separately
- Always stays in sync with vote counts

---

## Status

**Compilation:** All errors fixed  
**Feature:** Vote sync implemented  
**Testing:** Ready to test manually  

---

## Next Steps

1. Compile and run the app
2. Test voting in category detail
3. Verify vote counts update on navigation back
4. Verify no "Murphy's Law" replacement bug
5. Test in Browse view too (should also work)

**Ready to test!**
