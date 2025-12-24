# Mobile Worship MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the core web app functionality for managing songs, events, and live presentation control.

**Architecture:** Web-first approach - complete the Vite+React web app with full CRUD for songs/events/media, then build the live control experience. Edge functions for AI features. React Native apps after web is solid.

**Tech Stack:** Vite, React 18, TailwindCSS, TanStack Query, Supabase (Auth, DB, Storage, Realtime, Edge Functions)

---

## Phase 1: Song Library (Core Feature)

### Task 1: Create Song Modal Component

**Files:**
- Create: `apps/web/src/components/CreateSongModal.tsx`
- Modify: `apps/web/src/pages/SongsPage.tsx`

**Step 1: Create the modal component**

```tsx
// apps/web/src/components/CreateSongModal.tsx
import { useState } from 'react';
import { useSongs } from '@mobileworship/shared';

interface CreateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSongModal({ isOpen, onClose }: CreateSongModalProps) {
  const { createSong } = useSongs();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Parse lyrics into sections (simple format: blank line = new section)
      const sections = lyrics
        .split(/\n\n+/)
        .filter(Boolean)
        .map((text, i) => ({
          type: 'verse' as const,
          label: `Verse ${i + 1}`,
          lines: text.split('\n').filter(Boolean),
        }));

      await createSong.mutateAsync({
        title,
        author: author || undefined,
        content: { sections },
      });

      // Reset form and close
      setTitle('');
      setAuthor('');
      setLyrics('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create song');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold">Add New Song</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Author</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Lyrics *</label>
            <p className="text-xs text-gray-500 mb-2">
              Separate sections with a blank line
            </p>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={12}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
              required
            />
          </div>
        </form>

        <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !title || !lyrics}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Song'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Integrate modal into SongsPage**

Update `apps/web/src/pages/SongsPage.tsx` to import and use the modal:
- Add import: `import { CreateSongModal } from '../components/CreateSongModal';`
- Replace the TODO comment with: `<CreateSongModal isOpen={showCreate} onClose={() => setShowCreate(false)} />`

**Step 3: Test manually**
- Navigate to /dashboard/songs
- Click "Add Song"
- Fill in title, author, lyrics
- Submit and verify song appears in list

**Step 4: Commit**
```bash
git add apps/web/src/components/CreateSongModal.tsx apps/web/src/pages/SongsPage.tsx
git commit -m "feat(web): add create song modal"
```

---

### Task 2: Song Detail/Edit View

**Files:**
- Create: `apps/web/src/pages/SongDetailPage.tsx`
- Create: `apps/web/src/components/SongEditor.tsx`
- Modify: `apps/web/src/App.tsx` (add route)

**Step 1: Create SongEditor component**

```tsx
// apps/web/src/components/SongEditor.tsx
import { useState } from 'react';
import type { SongContent, SongSection } from '@mobileworship/shared';

interface SongEditorProps {
  content: SongContent;
  onChange: (content: SongContent) => void;
  readOnly?: boolean;
}

const sectionTypes = ['verse', 'chorus', 'bridge', 'pre-chorus', 'tag', 'intro', 'outro'] as const;

export function SongEditor({ content, onChange, readOnly = false }: SongEditorProps) {
  const [activeSection, setActiveSection] = useState<number | null>(null);

  function updateSection(index: number, updates: Partial<SongSection>) {
    const newSections = [...content.sections];
    newSections[index] = { ...newSections[index], ...updates };
    onChange({ ...content, sections: newSections });
  }

  function addSection() {
    onChange({
      ...content,
      sections: [
        ...content.sections,
        { type: 'verse', label: `Verse ${content.sections.length + 1}`, lines: [''] },
      ],
    });
  }

  function removeSection(index: number) {
    onChange({
      ...content,
      sections: content.sections.filter((_, i) => i !== index),
    });
  }

  function moveSection(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= content.sections.length) return;
    const newSections = [...content.sections];
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    onChange({ ...content, sections: newSections });
  }

  return (
    <div className="space-y-4">
      {content.sections.map((section, index) => (
        <div
          key={index}
          className={`border dark:border-gray-700 rounded-lg overflow-hidden ${
            activeSection === index ? 'ring-2 ring-primary-500' : ''
          }`}
        >
          <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 flex items-center gap-3">
            <select
              value={section.type}
              onChange={(e) => updateSection(index, { type: e.target.value as SongSection['type'] })}
              disabled={readOnly}
              className="text-sm bg-transparent border-none focus:ring-0"
            >
              {sectionTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={section.label}
              onChange={(e) => updateSection(index, { label: e.target.value })}
              disabled={readOnly}
              className="flex-1 text-sm bg-transparent border-none focus:ring-0"
            />
            {!readOnly && (
              <div className="flex gap-1">
                <button
                  onClick={() => moveSection(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSection(index, 'down')}
                  disabled={index === content.sections.length - 1}
                  className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeSection(index)}
                  className="p-1 text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            )}
          </div>
          <textarea
            value={section.lines.join('\n')}
            onChange={(e) => updateSection(index, { lines: e.target.value.split('\n') })}
            onFocus={() => setActiveSection(index)}
            onBlur={() => setActiveSection(null)}
            disabled={readOnly}
            rows={Math.max(3, section.lines.length + 1)}
            className="w-full px-4 py-3 bg-white dark:bg-gray-900 border-none focus:ring-0 font-mono text-sm resize-none"
          />
        </div>
      ))}

      {!readOnly && (
        <button
          onClick={addSection}
          className="w-full py-3 border-2 border-dashed dark:border-gray-700 rounded-lg text-gray-500 hover:text-gray-700 hover:border-gray-400 transition"
        >
          + Add Section
        </button>
      )}
    </div>
  );
}
```

**Step 2: Create SongDetailPage**

```tsx
// apps/web/src/pages/SongDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSongs, useAuth } from '@mobileworship/shared';
import { SongEditor } from '../components/SongEditor';

export function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { songs, isLoading, updateSong, deleteSong } = useSongs();
  const { can } = useAuth();

  const song = songs.find((s) => s.id === id);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState({ sections: [] });
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (song) {
      setTitle(song.title);
      setAuthor(song.author || '');
      setContent(song.content || { sections: [] });
    }
  }, [song]);

  if (isLoading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (!song) {
    return <div className="text-red-500">Song not found</div>;
  }

  const canEdit = can('songs:write');

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateSong.mutateAsync({
        id: song.id,
        title,
        author: author || undefined,
        content,
      });
      setHasChanges(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this song?')) return;
    await deleteSong.mutateAsync(song.id);
    navigate('/dashboard/songs');
  }

  function handleChange<T>(setter: React.Dispatch<React.SetStateAction<T>>) {
    return (value: T) => {
      setter(value);
      setHasChanges(true);
    };
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('/dashboard/songs')}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back to Songs
        </button>
        {canEdit && (
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-600 hover:text-red-700"
            >
              Delete
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => handleChange(setTitle)(e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Author</label>
            <input
              type="text"
              value={author}
              onChange={(e) => handleChange(setAuthor)(e.target.value)}
              disabled={!canEdit}
              className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-3">Lyrics</label>
          <SongEditor
            content={content}
            onChange={handleChange(setContent)}
            readOnly={!canEdit}
          />
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Add route in App.tsx**

Add import and route:
```tsx
import { SongDetailPage } from './pages/SongDetailPage';
// In routes:
<Route path="songs/:id" element={<SongDetailPage />} />
```

**Step 4: Update SongsPage to link to detail**

Wrap song cards in Link component to `/dashboard/songs/${song.id}`

**Step 5: Commit**
```bash
git add -A
git commit -m "feat(web): add song detail/edit view with section editor"
```

---

### Task 3: Song Search and Filtering

**Files:**
- Modify: `apps/web/src/pages/SongsPage.tsx`

**Step 1: Add search state and filter logic**

Add to SongsPage:
- Search input for title/author
- Tag filter dropdown
- Filter songs array before rendering

**Step 2: Commit**
```bash
git add apps/web/src/pages/SongsPage.tsx
git commit -m "feat(web): add song search and tag filtering"
```

---

## Phase 2: Event Management

### Task 4: Event List and Create Modal

**Files:**
- Create: `apps/web/src/components/CreateEventModal.tsx`
- Modify: `apps/web/src/pages/EventsPage.tsx`

Similar pattern to songs - modal with title, date picker, status.

**Step 1: Create modal with date picker**
**Step 2: Integrate into EventsPage**
**Step 3: Commit**

---

### Task 5: Event Detail with Service Order Builder

**Files:**
- Create: `apps/web/src/pages/EventDetailPage.tsx`
- Create: `apps/web/src/components/ServiceOrderEditor.tsx`

**Key Features:**
- Drag-and-drop song ordering
- Add songs from library
- Set per-song arrangements
- Preview slides

---

## Phase 3: Media Library

### Task 6: Media Upload and Grid

**Files:**
- Modify: `apps/web/src/pages/MediaPage.tsx`
- Create: `apps/web/src/components/MediaUploader.tsx`

**Step 1: Create upload component using Supabase Storage**
**Step 2: Display media grid with thumbnails**
**Step 3: Commit**

---

### Task 7: Media Selection in Songs/Events

**Files:**
- Create: `apps/web/src/components/MediaPicker.tsx`

Allow selecting background images for songs and events.

---

## Phase 4: Live Control

### Task 8: Control Page with Realtime

**Files:**
- Modify: `apps/web/src/pages/ControlPage.tsx`
- Create: `packages/shared/src/hooks/useRealtime.ts`

**Key Features:**
- Select event to go live
- Show current slide
- Navigate slides/sections
- Broadcast state via Supabase Realtime

---

### Task 9: Presentation Output View

**Files:**
- Create: `apps/web/src/pages/PresentationPage.tsx`

**Key Features:**
- Full-screen slide display
- Subscribe to realtime updates
- Smooth transitions

---

## Phase 5: Edge Functions (AI Features)

### Task 10: AI Lyrics Formatter

**Files:**
- Create: `supabase/functions/ai-format-lyrics/index.ts`

Parse raw lyrics text into structured sections using Gemini.

---

### Task 11: AI Scripture Slides

**Files:**
- Create: `supabase/functions/ai-scripture/index.ts`

Fetch scripture and split into readable slides.

---

## Phase 6: Settings & User Management

### Task 12: Settings Page

**Files:**
- Modify: `apps/web/src/pages/SettingsPage.tsx`

**Sections:**
- Church profile (name, CCLI number)
- User management (invite, roles)
- Default transitions
- Theme preferences

---

## Phase 7: Polish & Deploy

### Task 13: Error Handling & Loading States

Add consistent error boundaries and loading skeletons.

---

### Task 14: Cloudflare Pages Deployment

**Files:**
- Create: `apps/web/wrangler.toml`
- Modify: `package.json` (add deploy script)

---

## Execution Order

| Priority | Phase | Tasks | Effort |
|----------|-------|-------|--------|
| 1 | Song Library | 1-3 | Core feature |
| 2 | Events | 4-5 | Depends on songs |
| 3 | Media | 6-7 | Supports songs/events |
| 4 | Live Control | 8-9 | Main differentiator |
| 5 | AI Features | 10-11 | Nice-to-have for MVP |
| 6 | Settings | 12 | Admin functionality |
| 7 | Deploy | 13-14 | Go live |

---

## Notes

- Skip Stripe billing for initial MVP - can add later
- CCLI import requires API partnership - defer to post-launch
- React Native apps are Phase 2 after web is solid
- Focus on getting songs → events → live control working first
