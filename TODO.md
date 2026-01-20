# TODO for Murphy's Laws Project

This document outlines additional tasks and potential improvements for the Murphy's Laws project.

## SEO Recommendations (External / Manual)
- [ ] **Link Reclamation:** Identify broken links on high-authority sites (e.g., .edu domains) that mention 'Murphy\'s Law' and reach out to suggest our archive as a replacement reference.
- [ ] **Calculator Outreach:** Pitch the 'Buttered Toast Landing Calculator' to physics and science education blogs as a fun, interactive teaching tool to generate fresh backlinks.

## UX Improvements
- [ ] **Search Autocomplete/Suggestions:** Add debounced search suggestions as the user types in the header search field. Requires a new backend endpoint (`/api/v1/laws/suggestions`) to return top matching laws. Include keyboard navigation (arrow keys, Enter) for the dropdown.
- [ ] **Related Laws Section on Law Detail Page:** Show 3-5 related laws from the same category on the law detail page. Requires adding a `getRelatedLaws(lawId, categoryId)` method to `backend/src/services/laws.service.mjs` and a new API endpoint.
- [ ] **Category Descriptions:** Add descriptions to category pages. Requires database migration to add `description` column to categories table, then populate descriptions for all 55 categories. (See also: Content-Rich Category Pages below)
- [ ] **Site Statistics API Endpoint:** Create `/api/v1/stats` endpoint to expose aggregate statistics (total laws count, category count, total votes). This would enable displaying live stats on the About page (e.g., "Browse over X laws across Y categories").

## Content Strategy (Future Enhancements)
- [ ] **Content-Rich Category Pages:** Enhance category landing pages with more descriptive text, unique images, and curated content beyond just a list of laws. This might require adding 'long_description' to the `categories` table.
- [ ] **User Generated Content Moderation Interface:** Develop an admin interface to review, approve, edit, or reject submitted laws. This would build upon the existing `status` column in the `laws` table.

## Technical Debt / Code Quality
- [ ] **Refactor `main.js` `onSearch`:** The `onSearch` function in `web/src/main.js` currently handles both search queries and category navigation. Consider separating these concerns for better modularity and clarity.
- [ ] **Error Handling:** Implement more robust error handling and user feedback for API calls, especially in cases where data fails to load.
- [ ] **Lazy Loading Images/Components:** Investigate lazy loading for images and potentially less critical components to improve initial page load performance.
- [ ] **Accessibility Audit:** Conduct a thorough accessibility audit to ensure the site is usable by individuals with disabilities.

## Performance
- [ ] **Image Optimization:** Implement automated image optimization (e.g., WebP conversion, responsive images) for all images used on the site.
- [ ] **Critical CSS Generation:** Explore tools to automatically generate critical CSS for each page to further improve LCP.