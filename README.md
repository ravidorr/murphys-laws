# Murphy's Laws Database

A comprehensive database of Murphy's Laws with structured data, search functionality, and a web interface.

## Overview

This project builds a comprehensive database of Murphy's Laws from various categories, including Bus Laws, Technology Laws, Love Laws, and many more. Each law is structured with:

- **Text**: The actual Murphy's Law
- **Category**: The domain/category it belongs to
- **Tags**: Descriptive keywords for search and filtering
- **Sender Name**: Contributor's name (if available)
- **Sender Email**: Contributor's email (if available)
- **Source**: The original source document

## Database Statistics

- **Total Laws**: 135
- **Categories**: 11
- **Tags**: 288
- **Sources**: Multiple PDF collections

### Categories

1. **General** (10 laws) - Fundamental Murphy's Laws
2. **Transportation** (27 laws) - Bus and car-related laws
3. **Technology** (20 laws) - Computer and software laws
4. **Work** (10 laws) - Office and workplace laws
5. **Relationships** (10 laws) - Love and dating laws
6. **Parenting** (10 laws) - Mother and child-related laws
7. **Education** (10 laws) - Teaching and school laws
8. **Law Enforcement** (10 laws) - Police and traffic laws
9. **Military** (10 laws) - War and military laws
10. **Commerce** (10 laws) - Shopping and business laws
11. **Gambling** (8 laws) - Lottery and gambling laws

## Files

### Core Database Files
- `murphys_laws_database.py` - Core database classes and functionality
- `pdf_content_extractor.py` - Basic Murphy's Laws extractor
- `extended_murphy_laws.py` - Extended database with additional categories

### Database Output
- `murphys_laws_comprehensive.json` - Complete database with metadata
- `murphys_laws_simple.json` - Simplified version for web interface

### Web Interface
- `murphy_laws_viewer.html` - Interactive web interface for browsing laws
- `Murphys Laws/Sod's Law Calculator/` - Sod's Law probability calculator

## Usage

### 1. Generate the Database

```bash
# Generate basic database
python3 pdf_content_extractor.py

# Generate comprehensive database
python3 extended_murphy_laws.py
```

### 2. View the Web Interface

Open `murphy_laws_viewer.html` in your browser to:
- Browse all Murphy's Laws
- Search by text, category, or contributor
- Filter by category or tag
- View statistics and metadata

### 3. Use the Database Programmatically

```python
from murphys_laws_database import MurphysLawsDatabase

# Load the database
db = MurphysLawsDatabase()
db.load_from_json("murphys_laws_comprehensive.json")

# Search laws
results = db.search_laws("computer")
print(f"Found {len(results)} computer-related laws")

# Get laws by category
tech_laws = db.get_laws_by_category("Technology")

# Get laws by tag
timing_laws = db.get_laws_by_tag("timing")

# Print statistics
db.print_statistics()
```

## Example Laws

### General Laws
- "If anything can go wrong, it will."
- "If anything can go wrong, it will go wrong at the worst possible time."
- "Murphy was an optimist." (O'Toole's Law)

### Transportation Laws
- "If you run after a bus, it will pull away just as you reach it." (Contributed by: Anthony Sullivan)
- "Traffic will be heaviest when you're running late."
- "Your car will break down in the worst possible place at the worst possible time."

### Technology Laws
- "The computer will crash just before you save your work."
- "Your computer will work perfectly when the technician arrives."
- "The software update will break something that was working perfectly."

### Relationships Laws
- "The person you're most attracted to will be the least interested in you."
- "You will meet the love of your life when you're already in a relationship."
- "Your ex will look great when you look terrible."

## Data Structure

Each Murphy's Law in the database has the following structure:

```json
{
  "id": "unique-uuid",
  "text": "The law text",
  "category": "Category name",
  "tags": ["tag1", "tag2", "tag3"],
  "sender_name": "Contributor name",
  "sender_email": "contributor@email.com",
  "source": "Source document",
  "created_at": "ISO timestamp"
}
```

## Search and Filtering

The database supports multiple search methods:

1. **Text Search**: Search within law text, tags, categories, or contributor names
2. **Category Filter**: Filter by specific categories
3. **Tag Filter**: Filter by specific tags
4. **Contributor Search**: Find laws by contributor name

## Web Interface Features

- **Responsive Design**: Works on desktop and mobile
- **Real-time Search**: Filter laws as you type
- **Multiple Filters**: Combine text search with category and tag filters
- **Statistics Display**: Shows total laws, categories, tags, and current results
- **Card Layout**: Clean, readable display of each law
- **Contributor Attribution**: Shows contributor information when available

## Technical Details

### Database Class Features
- `MurphysLaw` dataclass for structured law representation
- `MurphysLawsDatabase` class for database management
- JSON serialization/deserialization
- Search and filtering methods
- Statistics generation
- Tag generation based on content analysis

### Tag Generation
Tags are automatically generated based on:
- Category keywords
- Content analysis for common themes
- Manual tagging for specific laws

Common tag themes include:
- `timing` - Laws about bad timing
- `irony` - Ironic situations
- `failure` - Things that fail
- `technology` - Tech-related issues
- `work` - Workplace situations

## Contributing

The database was built from various PDF collections of Murphy's Laws. To add new laws:

1. Add laws to the appropriate extractor method
2. Include proper categorization and tagging
3. Add contributor information if available
4. Regenerate the database files

## Future Enhancements

- Add more categories (Medical, Sports, Weather, etc.)
- Implement voting/rating system
- Add Murphy's Law variants and corollaries
- Create API endpoints for programmatic access
- Add export functionality (PDF, CSV)
- Implement favorites/bookmarking system

## License

This project is for educational and entertainment purposes. The Murphy's Laws themselves are traditional wisdom and not subject to copyright.