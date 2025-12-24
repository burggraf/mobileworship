# Free Backgrounds Import Feature

## Overview

Add a "Free Backgrounds" tab to the MediaPage that allows users to search, preview, and import backgrounds from free image sources (Unsplash, Pexels, Pixabay). Imported images are downloaded to Supabase Storage for reliable offline/live use.

## UI Structure

### MediaPage Tab Bar
- **"My Media"** tab - existing uploaded images/videos
- **"Free Backgrounds"** tab - search & import from external sources

### Free Backgrounds Tab Layout
1. **Source selector** - Pills to switch between Unsplash, Pexels, Pixabay (default: Pexels)
2. **Search bar** - Text input with search button
3. **Suggested terms** - Clickable chips: "mountains", "sky", "sunset", "bokeh", "light rays", "nature", "abstract", "church", "cross", "water"
4. **Results grid** - Thumbnails in 16:9 aspect ratio grid
5. **Load More button** - Pagination at bottom of results

### Preview Modal
- Large image preview
- SlidePreview component overlay with sample lyrics ("Amazing Grace / How Sweet the Sound")
- Attribution line ("Photo by X on Pexels")
- "Import to Library" button

## Data Flow

### Search Flow
1. User selects source (defaults to Pexels)
2. User types query or clicks suggested term
3. Frontend calls source API directly (client-side with publishable keys)
4. Results displayed as thumbnails with lazy loading
5. Pagination via "Load More" button

### Import Flow
1. User clicks thumbnail → Preview modal opens
2. User clicks "Import to Library" → Loading state
3. Edge function `import-background`:
   - Fetches full-resolution image from source
   - Resizes to max 1920px width
   - Uploads to Supabase Storage (`media` bucket)
   - Creates `media` table record with attribution metadata
4. Success toast, modal closes
5. Image appears in "My Media" tab

## API Integration

### Environment Variables
- `PEXELS_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `PIXABAY_API_KEY`

### Rate Limits
- Pexels: 200/hour (primary default)
- Pixabay: 100/minute (generous fallback)
- Unsplash: 50/hour (most restrictive)

### Search Parameters
- Orientation: landscape only
- Per page: 20 results
- Safe search: enabled

## Database Changes

Add fields to `media` table (or use existing metadata column):
- `source` - "unsplash" | "pexels" | "pixabay" | null
- `attribution` - "Photo by John Smith" | null
- `source_url` - Original page URL for compliance | null

## Edge Function: `import-background`

**Input:**
```typescript
{
  sourceUrl: string;      // Direct image URL
  source: 'unsplash' | 'pexels' | 'pixabay';
  photographer: string;
  photographerUrl?: string;
  sourcePageUrl: string;
}
```

**Process:**
1. Fetch image from sourceUrl
2. Resize to max 1920px width (maintain aspect ratio)
3. Generate unique filename
4. Upload to Supabase Storage
5. Insert media record with attribution

**Output:**
```typescript
{
  mediaId: string;
  storagePath: string;
}
```

## New Components

1. **`FreeBackgroundsTab`** - Container managing source, query, results state
2. **`SourceSelector`** - Pill buttons for source selection
3. **`BackgroundSearchBar`** - Search input + suggested term chips
4. **`BackgroundResultsGrid`** - Grid of search result thumbnails
5. **`BackgroundPreviewModal`** - Preview with SlidePreview overlay + import

## Modified Components

- **`MediaPage`** - Add tab bar, conditionally render tabs

## Edge Cases

- **No results** - "No backgrounds found for '[query]'. Try another search term."
- **Rate limited** - "Couldn't search [Source]. Try another source or wait a moment."
- **Import fails** - Toast: "Failed to import background. Please try again."
- **Duplicate import** - Allowed (no duplicate detection)

## i18n Keys Required

- `media.tabs.myMedia`
- `media.tabs.freeBackgrounds`
- `media.backgrounds.searchPlaceholder`
- `media.backgrounds.import`
- `media.backgrounds.importing`
- `media.backgrounds.noResults`
- `media.backgrounds.rateLimited`
- `media.backgrounds.importError`
- `media.backgrounds.importSuccess`
- `media.backgrounds.photoBy` (for attribution: "Photo by {name} on {source}")
- `media.backgrounds.loadMore`
