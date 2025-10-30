# Quick Performance Fixes - Priority Order

**Current Score:** 54/100
**Target Score:** 70+ (with these fixes)
**Date:** 2025-10-30

---

## 🔴 CRITICAL: Fix Layout Shift (CLS: 0.961 → <0.1)
**Impact:** +25-30 points
**Time:** 1-2 hours

### Problem
`div.container.page.pt-0` is causing massive layout shift (0.961)
Also: Unsized image element detected

### Solution
1. **Find the culprit div:**
   ```bash
   grep -r "container page pt-0" src/
   ```

2. **Add min-height to prevent shift:**
   - Likely in Law of the Day component or home page
   - Reserve space before content loads

3. **Fix unsized image:**
   - Add width/height attributes to ALL images
   - Especially in Law of the Day component

### Files to check:
- `src/views/home.js`
- `src/components/law-of-day.js`
- `src/views/law-detail.js`

---

## 🟡 HIGH: Fix Font Loading (Est savings: 130ms)
**Impact:** +10 points
**Time:** 30 minutes

### Problem
- Google Fonts: 3,699 KiB (3.6MB!) - ENORMOUS
- Font Awesome fonts: No font-display set
- Fonts blocking render

### Solution

#### Option A: Add font-display to existing fonts (Quick fix)
Update `index.html`:
```html
<!-- Before -->
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap" rel="stylesheet">

<!-- After -->
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;700&display=swap" rel="stylesheet">
<style>
  @font-face {
    font-family: 'Font Awesome 6 Free';
    font-display: swap;
  }
</style>
```

#### Option B: Self-host fonts (Better solution)
1. Download Google Fonts
2. Use subset fonts (only characters you need)
3. Reduce 3.6MB to ~100KB

---

## 🟡 HIGH: Add Preconnect Hints (Est savings: 90ms)
**Impact:** +5 points
**Time:** 5 minutes

### Solution
Add to `index.html` `<head>`:
```html
<!-- Preconnect to critical origins -->
<link rel="preconnect" href="https://mirrors.creativecommons.org">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://cdnjs.cloudflare.com">

<!-- DNS prefetch for less critical origins -->
<link rel="dns-prefetch" href="https://www.googletagmanager.com">
<link rel="dns-prefetch" href="https://www.google-analytics.com">
```

---

## 🟢 MEDIUM: Reduce Unused CSS (Est savings: 22 KiB)
**Impact:** +3 points
**Time:** 30 minutes

### Problem
Font Awesome CSS: 21.9 KiB with 21.7 KiB unused (99% waste!)

### Solution
Only load icons you actually use:

#### Option A: Use Font Awesome Pro (subset)
```html
<!-- Instead of all.min.css -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/solid.min.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/brands.min.css">
```

#### Option B: Self-host only needed icons
1. Identify which Font Awesome icons you use:
   ```bash
   grep -r "fa-" src/ | grep -o "fa-[a-z-]*" | sort -u
   ```
2. Use Font Awesome subsetter
3. Host locally

---

## 🟢 MEDIUM: Reduce Unused JavaScript (Est savings: 148 KiB)
**Impact:** +5 points
**Time:** 1 hour

### Problem
- Google Tag Manager: 121.6 KiB unused
- Chrome extension: 26.6 KiB unused (ignore this)

### Solution
1. **Defer GTM loading:**
   ```html
   <!-- Load GTM after page load -->
   <script>
   window.addEventListener('load', function() {
     // GTM initialization code here
   });
   </script>
   ```

2. **Or use GTM server-side** (better for performance)

---

## 🟢 MEDIUM: Optimize Element Render Delay (540ms)
**Impact:** +5 points
**Time:** 30 minutes

### Problem
LCP element ("Radio clocks never go off." blockquote) takes 540ms to render

### Solution
1. **Ensure Law of the Day loads ASAP:**
   - Preload the API call
   - Add to `index.html`:
   ```html
   <link rel="preload" href="/api/law-of-day" as="fetch" crossorigin>
   ```

2. **Inline critical CSS for blockquote:**
   ```html
   <style>
   .lod-quote-large {
     /* Copy critical styles here */
     font-size: 1.5rem;
     font-style: italic;
     margin: 1rem 0;
   }
   </style>
   ```

---

## Quick Action Plan (Today)

### Phase 1: 30 Minutes - Quick Wins (+15 points)
1. ✅ Add preconnect hints (5 min)
2. ✅ Add font-display: swap (10 min)
3. ✅ Find and fix unsized image (15 min)

**Expected: 54 → 69**

### Phase 2: 1 Hour - Layout Shift Fix (+20 points)
4. ✅ Fix div.container.page.pt-0 layout shift
5. ✅ Add min-height to prevent shift

**Expected: 69 → 85**

### Phase 3: 1 Hour - Font Optimization (+5 points)
6. ✅ Reduce Google Font size (subset or self-host)
7. ✅ Optimize Font Awesome loading

**Expected: 85 → 90** 🎯

---

## Implementation Checklist

### Immediate (30 min):
- [ ] Add preconnect hints to index.html
- [ ] Add font-display: swap to fonts
- [ ] Find unsized image and add dimensions

### High Priority (1-2 hours):
- [ ] Fix div.container.page.pt-0 layout shift
- [ ] Add min-height to Law of the Day container
- [ ] Optimize Google Fonts (reduce from 3.6MB)

### Medium Priority (2-3 hours):
- [ ] Reduce unused Font Awesome CSS
- [ ] Defer GTM loading
- [ ] Preload law-of-day API call
- [ ] Inline critical CSS for LCP element

---

## Expected Results

| Action | Current | After | Gain |
|--------|---------|-------|------|
| Start | 54 | - | - |
| Quick wins | 54 | 69 | +15 |
| Fix CLS | 69 | 85 | +16 |
| Optimize fonts | 85 | 90 | +5 |
| **TOTAL** | **54** | **90** | **+36** |

---

## Notes

- CLS is the biggest issue (0.961 vs target <0.1)
- Google Font is 3.6MB - must optimize
- Font Awesome is 99% unused - must subset
- Layout shift in div.container.page.pt-0 is the main culprit

---

## Next Steps

Start with Phase 1 (Quick Wins) - should take 30 minutes and give you +15 points!

Would you like me to:
1. Start implementing Phase 1 now?
2. Focus on fixing the layout shift first?
3. Optimize fonts first?
