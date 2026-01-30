# Vote State Synchronization Issue

## Problem
When viewing a category's laws and voting on a law in the detail view, the vote counts in the category list don't update automatically when navigating back.

## Why This Is Complex

### Attempted Solutions That Failed:

1. **Fetch single law on `.onDisappear`**
   - Problem: `fetchLawDetail` returns wrong/default law
   - Result: Correct law gets replaced with "Murphy's Law"
   - Reason: API endpoint issue or fallback behavior

2. **Refresh on `.onAppear`**  
   - Problem: Triggers on every scroll/focus change
   - Result: Constant API calls, poor performance
   - Reason: `.onAppear` fires too frequently

3. **Full list refresh on navigation**
   - Problem: Too slow, wastes bandwidth
   - Result: Loading spinner, bad UX
   - Reason: Fetches all laws when only one changed

### The Core Challenge:
- `LawDetailView` and `CategoryDetailView` don't share state
- `NavigationLink` creates separate view hierarchies  
- No built-in SwiftUI mechanism to propagate vote changes back
- API has no reliable single-law endpoint for updates

---

## Current Workaround

### Manual Refresh (Pull-to-Refresh)
Users can pull down on the category list to refresh and see updated votes.

**How to use:**
1. Vote on a law in detail view
2. Navigate back to category list
3. Pull down to refresh
4. See updated vote counts

**Pros:**
- Works reliably
- User has control
- Standard iOS pattern
- No bugs

**Cons:**
- Requires manual action
- Not immediate feedback

---

## Proper Solutions (For Future Implementation)

### Option 1: Shared Observable State RECOMMENDED
Use a shared state manager that both views observe:

```swift
@MainActor
class LawStateManager: ObservableObject {
    @Published var laws: [Int: Law] = [:] // ID → Law mapping
    
    func updateLaw(_ law: Law) {
        laws[law.id] = law
    }
    
    func getLaw(id: Int) -> Law? {
        laws[id]
    }
}

// In both CategoryDetailView and LawDetailView:
@EnvironmentObject var lawStateManager: LawStateManager

// When voting:
lawStateManager.updateLaw(updatedLaw)
```

**Benefits:**
- Automatic UI updates everywhere
- Single source of truth
- No API calls needed
- Real-time sync

### Option 2: NotificationCenter Pattern
Post notifications when votes change:

```swift
extension Notification.Name {
    static let lawVotesUpdated = Notification.Name("lawVotesUpdated")
}

// In LawDetailView after voting:
NotificationCenter.default.post(
    name: .lawVotesUpdated,
    object: nil,
    userInfo: ["lawID": lawID, "upvotes": upvotes, "downvotes": downvotes]
)

// In CategoryDetailView:
.onReceive(NotificationCenter.default.publisher(for: .lawVotesUpdated)) { notification in
    if let lawID = notification.userInfo?["lawID"] as? Int,
       let upvotes = notification.userInfo?["upvotes"] as? Int,
       let downvotes = notification.userInfo?["downvotes"] as? Int {
        viewModel.updateLawVotes(lawID: lawID, upvotes: upvotes, downvotes: downvotes)
    }
}
```

**Benefits:**
- Decoupled views
- Works across navigation
- No shared state needed
- Simple implementation

### Option 3: Combine Publishers
Use Combine to share vote state:

```swift
class VotingService: ObservableObject {
    @Published var voteUpdates = PassthroughSubject<(lawID: Int, upvotes: Int, downvotes: Int), Never>()
    
    func vote(_ voteType: VoteType, for lawID: Int) async {
        // ... vote logic ...
        voteUpdates.send((lawID, newUpvotes, newDownvotes))
    }
}

// Subscribe in CategoryDetailView:
.onReceive(votingService.voteUpdates) { update in
    viewModel.updateLawVotes(lawID: update.lawID, ...)
}
```

**Benefits:**
- Reactive programming
- Type-safe
- Integrates with VotingService
- Flexible

### Option 4: Fix API Endpoint
Ensure `fetchLawDetail` returns the correct law:

```swift
// In LawRepository:
func fetchLawDetail(id: Int) async throws -> Law {
    // Verify response has correct ID
    let law = try await apiService.fetchLaw(id: id)
    
    guard law.id == id else {
        throw LawRepositoryError.mismatchedLawID(requested: id, received: law.id)
    }
    
    return law
}
```

Then use the original `.onDisappear` approach.

---

## Recommendation for Next Steps

### Immediate (Low Effort):
1. Keep current pull-to-refresh behavior
2. Document that users should refresh after voting
3. Consider adding a toast: "Pull to refresh for updated votes"

### Short-term (Medium Effort):  
1. Implement **Option 2: NotificationCenter**
   - Add notification in `LawDetailView` after voting
   - Listen in `CategoryDetailView`
   - Update local law data without API call
   - ~30 minutes of work

### Long-term (High Effort):
1. Implement **Option 1: Shared State Manager**
   - Create `LawStateManager` class
   - Inject as environment object
   - Refactor all law lists to use it
   - ~2-3 hours of work
   - Best long-term solution

---

## Why The Quick Fix Failed

The `fetchLawDetail(id: Int)` method in `LawRepository` has a fallback that returns a default law when the API call fails or returns unexpected data. This is why we saw the "Murphy's Law" replacement bug.

**Root cause chain:**
1. User votes on Law ID 42
2. `.onDisappear` calls `refreshSingleLaw(lawID: 42)`  
3. `refreshSingleLaw` calls `fetchLawDetail(id: 42)`
4. API returns error or wrong data
5. Repository fallback returns `Law.mock` (Murphy's Law)
6. Law 42 gets replaced with mock law
7. User sees wrong law in list

---

## Current Status

**State:** Reverted broken fix  
**Behavior:** Vote counts don't auto-update (need manual refresh)  
**Workaround:** Pull-to-refresh works correctly  
**Next Action:** Implement NotificationCenter pattern (Option 2)

---

## Test After Fix

When proper solution is implemented:

1. Navigate to Categories
2. Tap a category
3. Note vote count for first law (e.g., "10 upvotes")
4. Tap that law
5. Vote (upvote or downvote)
6. Navigate back
7. **VERIFY:** Vote count updated automatically (e.g., now "11 upvotes")
8. **VERIFY:** Law title and text are CORRECT (not Murphy's Law)
9. **VERIFY:** No loading spinner or delay

---

**Files Modified (Reverted):**
- `CategoriesView.swift` - Removed broken `.onDisappear`
- `LawListViewModel.swift` - Removed broken `refreshSingleLaw()`
- `VOTE_SYNC_BUG_FIX.md` - Marked as incorrect approach

**Status:** Known issue - requires proper state management solution
