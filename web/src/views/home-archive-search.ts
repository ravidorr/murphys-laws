// Markup of the home page's "Search the Archive" card. The app renders it at runtime (views/home.ts) and the
// static build prerenders the same string (scripts/ssg.ts). Keeping them identical is what lets the prerendered
// Law of the Day paint at the exact position the app later renders it: the app replaces the prerendered page,
// and a later element only avoids becoming a new, later largest-contentful-paint if it is no larger than the
// early one. Do not change the layout of one without the other; this module keeps them one string.
// The form works without JavaScript (GET /browse?q=...); the app intercepts the submit.
export const ARCHIVE_SEARCH_HTML = `
  <section class="section card card--section section-card mb-12 browse-cta" data-home-zone="archive-search" aria-labelledby="browse-cta-heading">
    <div class="section-header">
      <h1 id="browse-cta-heading" class="section-title"><span class="accent-text">Search</span> the Archive</h1>
    </div>
    <div class="section-subheader">
      <p class="section-subtitle">Start with the complete Murphy's Law archive, then save, vote, share, or submit the next inevitable discovery.</p>
    </div>
    <div class="section-body">
      <form action="/browse" method="get" role="search" class="not-found-search-form" aria-label="Search the archive">
        <input type="search" name="q" class="form-control" placeholder="Search laws, categories, and mishaps" aria-label="Search laws">
        <button type="submit" class="btn primary">
          <span class="btn-text">Search the Archive</span>
          <span class="icon" data-icon="search" aria-hidden="true"></span>
        </button>
      </form>
      <div class="home-proof-points" aria-label="Archive facts">
        <span class="home-proof-point"><strong>Complete</strong> <span>archive</span></span>
        <span class="home-proof-point"><strong>55+</strong> <span>categories</span></span>
        <span class="home-proof-point"><strong>Human-reviewed</strong> <span>submissions</span></span>
        <span class="home-proof-point"><strong>Curated</strong> <span>since 1998</span></span>
      </div>
      <a href="/browse" class="btn primary" data-nav="browse">
        <span class="btn-text">Browse All Laws</span>
        <span class="icon" data-icon="list" aria-hidden="true"></span>
      </a>
    </div>
  </section>
`;
