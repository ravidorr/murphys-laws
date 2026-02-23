# Murphy's Laws - Shared Resources

This directory contains resources shared across all platforms (web, iOS, Android).

## Structure

```
shared/
├── content/ # Web content pages (markdown)
│   # about, origin-story, privacy, terms, contact, examples,
│   # why-murphys-law-feels-true, murphys-law-project-management
├── docs/ # Documentation
├── data/ # Shared data files
│ └── murphys-laws/ # Law markdown files
└── assets/ # Design assets
 ├── icons/ # App icons
 ├── logos/ # Logos
 └── screenshots/ # App screenshots
```

## Documentation

- [API Documentation](docs/API.md)
- [Mobile Architecture](docs/MOBILE-ARCHITECTURE.md)
- [iOS PRD](docs/MOBILE-IOS-PRD.md)
- [Android PRD](docs/MOBILE-ANDROID-PRD.md)
- [Repository Structure](docs/MOBILE-REPOSITORY-STRUCTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## Web Content (markdown)

The `content/` directory holds markdown for static and long-form web pages. Each file has a corresponding entry in `content/metadata.json` (version, lastUpdated, description). The web app renders these via `getPageContent()` in `web/src/utils/markdown-content.ts`.

**Pages:** about, origin-story, privacy, terms, contact, examples, why-murphys-law-feels-true, murphys-law-project-management.

To add a new content page: add the `.md` file, add metadata, extend the `ContentPage` type and content map in `markdown-content.ts`, add a view and route in the web app, and link from the home page or nav as needed.

## Law Data

Law content is stored in `data/murphys-laws/` as markdown files. These files are parsed by the backend to build the SQLite database.

**Format:**
```markdown
# Category Title

Law text here.

Sent by: Author Name <author@example.com>

---

Another law text.

Sent by: Different Author (https://example.com)
```

## Adding New Laws

1. Edit appropriate markdown file in `data/murphys-laws/`
2. Rebuild database: `cd backend && npm run build:db`
3. Restart API server

## Assets

Design assets for all platforms should be placed in `assets/`:
- `icons/` - App icons for iOS and Android
- `logos/` - Brand logos
- `screenshots/` - App Store / Google Play screenshots
