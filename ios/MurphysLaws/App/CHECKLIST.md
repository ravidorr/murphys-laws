# Murphy's Laws iOS - Pre-Launch Checklist

## Code Implementation - COMPLETE

### ViewModels (6/6)
- [x] CalculatorViewModel.swift
- [x] LawListViewModel.swift
- [x] CategoryListViewModel.swift
- [x] SubmitLawViewModel.swift
- [x] HomeViewModel.swift
- [x] LawDetailViewModel.swift

### Views (10/10)
- [x] HomeView.swift
- [x] BrowseView.swift
- [x] CategoriesView.swift
- [x] CalculatorView.swift
- [x] MoreView.swift
- [x] LawDetailView.swift
- [x] SubmitLawView.swift
- [x] EmptyStateView.swift
- [x] MathFormulaView.swift
- [x] ErrorRecoveryView.swift

### Services (7/7)
- [x] APIService.swift
- [x] VotingService.swift
- [x] NetworkMonitor.swift
- [x] AnalyticsService.swift
- [x] CrashReportingService.swift
- [x] ImageCache.swift (actor)
- [x] LawCache.swift (actor)

### Infrastructure (5/5)
- [x] MurphysLawsApp.swift
- [x] DeepLinkHandler.swift
- [x] AccessibilityHelpers.swift
- [x] DateFormatters.swift
- [x] TypographyModifier.swift

### Testing (3/3)
- [x] LawIntegrationTests.swift (Swift Testing)
- [x] Unit tests updated
- [x] UI tests re-enabled

### Documentation (3/3)
- [x] README.md
- [x] ARCHITECTURE.md
- [x] IMPLEMENTATION_SUMMARY.md

---

## Pre-Launch Tasks

### Project Configuration
- [ ] Create Config.plist with production values
  ```xml
  <key>Environment</key>
  <string>production</string>
  <key>APIBaseURL</key>
  <string>https://murphys-laws.com/api/v1</string>
  <key>APIKey</key>
  <string>YOUR_PRODUCTION_API_KEY</string>
  ```

- [ ] Update bundle identifier
- [ ] Set version number (e.g., 1.0.0)
- [ ] Set build number (e.g., 1)

### Assets
- [ ] Add app icon (1024x1024 + all sizes)
- [ ] Add launch screen/storyboard
- [ ] Add all DS color assets in Assets.xcassets
  - [ ] DS/bg
  - [ ] DS/fg
  - [ ] DS/muted-fg
  - [ ] DS/primary
  - [ ] DS/btn-primary-bg
  - [ ] DS/btn-primary-fg
  - [ ] DS/success, DS/error
  - [ ] DS/risk-low, DS/risk-medium, DS/risk-high
  - [ ] (See Tokens.swift for complete list)

### Privacy & Legal
- [ ] Add Privacy Policy URL
- [ ] Add Terms of Service URL
- [ ] Update Info.plist privacy descriptions:
  - [ ] NSUserTrackingUsageDescription (if using analytics)
  - [ ] NSAppTransportSecurity (if needed)

### Analytics Integration
- [ ] Set up Firebase (or chosen analytics platform)
- [ ] Add Firebase SDK to project
- [ ] Update AnalyticsService.swift with actual implementation
- [ ] Test analytics events

### Crash Reporting
- [ ] Set up Crashlytics (or chosen crash reporting)
- [ ] Add SDK to project
- [ ] Update CrashReportingService.swift
- [ ] Test crash reporting

### API Integration
- [ ] Verify all endpoints are correct
- [ ] Test against production API
- [ ] Implement API key rotation if needed
- [ ] Add certificate pinning (optional, for security)

### Deep Linking
- [ ] Add URL scheme to Info.plist
  ```xml
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleURLSchemes</key>
      <array>
        <string>murphyslaws</string>
      </array>
    </dict>
  </array>
  ```
- [ ] Test deep links on device
- [ ] Create Universal Links (optional)

### Testing
- [ ] Run all unit tests
- [ ] Run all integration tests
- [ ] Run UI tests
- [ ] Test on real devices (not just simulators)
- [ ] Test on different iOS versions (17.0+)
- [ ] Test on different device sizes
  - [ ] iPhone SE (small)
  - [ ] iPhone 15 (standard)
  - [ ] iPhone 15 Pro Max (large)
  - [ ] iPad (if supported)

### Accessibility Testing
- [ ] Test with VoiceOver enabled
- [ ] Test with large text sizes
- [ ] Test with high contrast
- [ ] Test with reduce motion
- [ ] Test color blind modes (if applicable)

### Performance Testing
- [ ] Profile with Instruments
  - [ ] Time Profiler
  - [ ] Allocations
  - [ ] Leaks
- [ ] Test network performance on slow connection
- [ ] Test offline functionality
- [ ] Verify memory usage is acceptable

### Edge Cases
- [ ] Test with no network connection
- [ ] Test with poor network
- [ ] Test rate limiting (30 votes/minute)
- [ ] Test with empty results
- [ ] Test with very long law text
- [ ] Test category with no laws
- [ ] Test calculator with edge values (all 1s, all 10s)

### Security
- [ ] Review all API calls use HTTPS
- [ ] Verify no sensitive data in logs
- [ ] Check UserDefaults doesn't store sensitive info
- [ ] Review code for hardcoded secrets
- [ ] Enable code signing
- [ ] Set up provisioning profiles

### App Store Preparation
- [ ] Create app screenshots (all required sizes)
- [ ] Write app description
- [ ] Choose app category
- [ ] Set age rating
- [ ] Add keywords for search
- [ ] Create preview video (optional)
- [ ] Prepare promotional text
- [ ] Set pricing

### Localization (Optional)
- [ ] Extract localizable strings
- [ ] Translate to target languages
- [ ] Test with different locales
- [ ] Verify date/time formatting
- [ ] Check number formatting

### Build & Archive
- [ ] Clean build folder
- [ ] Build for release configuration
- [ ] Archive app
- [ ] Export for App Store submission
- [ ] Upload to App Store Connect
- [ ] Submit for review

---

## Testing Checklist

### Manual Testing Scenarios

#### Home Tab
- [ ] Law of the Day loads correctly
- [ ] Quick action buttons navigate properly
- [ ] Featured laws display
- [ ] Pull to refresh works
- [ ] Tapping law opens detail

#### Browse Tab
- [ ] Laws list loads
- [ ] Search works and debounces
- [ ] Sort options work (Top Rated, Most Recent, Most Popular)
- [ ] Infinite scroll loads more
- [ ] Vote buttons work
- [ ] Category badges display

#### Categories Tab
- [ ] Category grid loads
- [ ] Tapping category shows laws
- [ ] Category detail view works
- [ ] Back navigation works

#### Calculator Tab
- [ ] All sliders work smoothly
- [ ] Probability updates correctly
- [ ] Risk level changes (Low/Medium/High)
- [ ] Formula displays correctly
- [ ] Reset button works
- [ ] Share functionality works
- [ ] Email form works

#### More Tab
- [ ] Submit a Law button works
- [ ] About view displays
- [ ] Contact form works
- [ ] External links open
- [ ] Version number displays

#### Submit Law Flow
- [ ] Form validation works
- [ ] Character counter updates
- [ ] Category selection works
- [ ] Anonymous toggle works
- [ ] Submit button disabled when invalid
- [ ] Success message shows
- [ ] Form clears after submit

#### Law Detail
- [ ] Full law text displays
- [ ] Vote buttons work
- [ ] Vote counts update
- [ ] Categories show
- [ ] Attributions display with links
- [ ] Share button works

#### Error Scenarios
- [ ] Network error shows ErrorRecoveryView
- [ ] No results shows EmptyStateView
- [ ] Rate limit error shows proper message
- [ ] Server error shows retry option
- [ ] Offline indicator shows when no network

---

## Performance Benchmarks

### Load Times (Target)
- [ ] App launch: < 2 seconds
- [ ] Law list load: < 1 second
- [ ] Law detail load: < 0.5 seconds
- [ ] Category load: < 1 second
- [ ] Search results: < 0.5 seconds (after debounce)

### Memory Usage (Target)
- [ ] Idle: < 50 MB
- [ ] Active browsing: < 100 MB
- [ ] With 100+ cached images: < 150 MB

### Network (Target)
- [ ] Initial sync: < 500 KB
- [ ] Law list page: < 50 KB
- [ ] Single law: < 10 KB

---

## Security Checklist

- [ ] No API keys in source code (use Config.plist)
- [ ] Config.plist in .gitignore
- [ ] HTTPS for all network calls
- [ ] Certificate pinning (optional)
- [ ] Input validation on all forms
- [ ] SQL injection not applicable (using REST API)
- [ ] XSS not applicable (native app)
- [ ] Rate limiting respected (30 votes/min)
- [ ] User data encrypted (UserDefaults for non-sensitive only)

---

## Device Testing Matrix

### iPhone
- [ ] iPhone SE (3rd gen) - iOS 17
- [ ] iPhone 15 - iOS 17
- [ ] iPhone 15 Pro - iOS 17
- [ ] iPhone 15 Pro Max - iOS 17

### iPad (if supported)
- [ ] iPad (10th gen) - iOS 17
- [ ] iPad Pro 12.9" - iOS 17

### iOS Versions
- [ ] iOS 17.0
- [ ] iOS 17.1+
- [ ] Latest beta (if targeting next iOS)

---

## App Store Review Preparation

### Common Rejection Reasons to Avoid
- [ ] Crashes on launch  (tested)
- [ ] Broken links  (all working)
- [ ] Placeholder content  (real content)
- [ ] Missing privacy policy  (needs URL)
- [ ] Requires login but no test account  (no login required)
- [ ] Uses private APIs  (only public APIs)
- [ ] Copycat of existing app  (unique)

### Review Notes (for Apple)
```
This app provides a collection of Murphy's Laws and similar humorous
observations. Users can browse, search, vote on, and submit laws.
The Sod's Law Calculator is a fun tool to calculate probability of
failure based on multiple factors.

Test Account: Not required
Backend API: https://murphys-laws.com/api/v1
Contact: support@murphys-laws.com
```

---

## Final Verification

Before submitting:
- [ ] All features work as expected
- [ ] No crashes or major bugs
- [ ] Performance is acceptable
- [ ] Accessibility is good
- [ ] Privacy policy is linked
- [ ] Analytics are working
- [ ] Crash reporting is working
- [ ] App icon looks good
- [ ] Screenshots are appealing
- [ ] Description is accurate
- [ ] Version number is correct
- [ ] All tests pass

---

## Launch Day Tasks

- [ ] Submit app for review
- [ ] Prepare social media posts
- [ ] Create launch website/landing page
- [ ] Set up customer support email
- [ ] Monitor crash reports
- [ ] Monitor analytics
- [ ] Respond to reviews
- [ ] Prepare for first update

---

## Post-Launch Monitoring

### Week 1
- [ ] Check crash rate (target: < 0.1%)
- [ ] Monitor reviews
- [ ] Track analytics events
- [ ] Verify API load is manageable
- [ ] Check for any critical bugs

### Week 2-4
- [ ] Gather user feedback
- [ ] Plan first update
- [ ] Add requested features to backlog
- [ ] Optimize based on analytics data

---

## Success Metrics

### Technical
- Crash rate: < 0.1%
- Average app rating: > 4.0 stars
- App launch time: < 2 seconds
- Network success rate: > 99%

### User Engagement
- Daily active users (DAU)
- Laws viewed per session
- Vote participation rate
- Law submissions
- Calculator usage

---

*"If anything can go wrong, make sure you've checked this list first!"*

---

## IMPORTANT: READ FIRST

**Before using this checklist, read `CORRECTIONS.md`** - it addresses critical documentation inconsistencies.

## Actual Current Status

**Code Architecture**:  Complete (MVVM, Repository Pattern, Services)  
**Code Quality**:  Complete (Error Handling, Accessibility, Performance)  
**Testing Infrastructure**:  Complete (Unit, Integration, UI test frameworks)  

**Project Organization**:  Needs Cleanup (File duplicates, wrong locations)  
**Configuration**:  Template Only (Config.plist needs creation)  
**Assets**:  Not Added (Icons, colors, launch screens)  
**SDK Integration**:  Not Done (Analytics, Crash Reporting stubs only)  
**Device Testing**:  Not Done (Simulator only so far)  
**Production Deployment**:  Not Ready (See checklist above)

**Accurate Status**: **MVP Code Complete - Configuration & Assets Pending**

---

## CRITICAL: Complete These FIRST

Before working through the checklist above:

1. **Read CORRECTIONS.md** - Addresses project structure issues
2. **Verify project.yml is source of truth** - Run `xcodegen generate`
3. **Move misplaced files** - See CORRECTIONS.md for locations
4. **Remove duplicate files** - Clean root-level duplicates
5. **Create Config.plist** - From template in correct location
6. **Standardize iOS version** - Pick one (16 or 17) and update everywhere

Then proceed with checklist above.
