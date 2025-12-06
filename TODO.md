# TODO for Murphy's Laws Project

This document outlines additional tasks and potential improvements for the Murphy's Laws project.

## SEO Recommendations (External / Manual)
- [ ] **Link Reclamation:** Identify broken links on high-authority sites (e.g., .edu domains) that mention 'Murphy\'s Law' and reach out to suggest our archive as a replacement reference.
- [ ] **Calculator Outreach:** Pitch the 'Buttered Toast Landing Calculator' to physics and science education blogs as a fun, interactive teaching tool to generate fresh backlinks.

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