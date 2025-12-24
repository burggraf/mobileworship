# Mobile Worship - Design Document

## Overview

Mobile Worship is a multi-platform application for displaying lyrics on overhead projectors in churches. It consists of host apps (display), client apps (controller), and a web app (admin + control), all backed by Supabase.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           MOBILE WORSHIP                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Host App  │  │ Client App  │  │   Web App   │  │  TV Apps    │   │
│  │  (Display)  │  │ (Controller)│  │(Admin+Ctrl) │  │ (Display)   │   │
│  │             │  │             │  │             │  │             │   │
│  │React Native │  │React Native │  │ Vite+React  │  │ RN + tvOS   │   │
│  │Win/Mac/Linux│  │ iOS/Android │  │             │  │ Android TV  │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │          │
│         └────────────────┼────────────────┼────────────────┘          │
│                          │                │                           │
│              ┌───────────▼────────────────▼───────────┐               │
│              │        Communication Layer             │               │
│              │  Local: WebSocket + mDNS discovery     │               │
│              │  Remote: Supabase Realtime             │               │
│              └───────────────────┬───────────────────┘               │
│                                  │                                    │
│              ┌───────────────────▼───────────────────┐               │
│              │           Supabase Backend            │               │
│              │  • PostgreSQL (RLS multi-tenant)      │               │
│              │  • Storage (media files)              │               │
│              │  • Edge Functions (LLM, integrations) │               │
│              │  • Auth                               │               │
│              └───────────────────────────────────────┘               │
│                                                                       │
│              ┌───────────────────────────────────────┐               │
│              │         External Services             │               │
│              │  • Stripe (billing)                   │               │
│              │  • CCLI (licensing)                   │               │
│              │  • Planning Center (sync)             │               │
│              │  • Unsplash/Pexels (stock media)      │               │
│              │  • Gemini (LLM)                       │               │
│              └───────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Host-Client Communication | Hybrid (local + Supabase Realtime) | Low latency on same network, fallback for remote |
| Codebase Structure | Turborepo monorepo | Shared code, single version of truth |
| Multi-tenancy | Row-level security with church_id | Simple, cost-effective, easy to manage |
| Song Structure | JSONB with sections | Flexible schema, queryable, easy to evolve |
| Host Display Platform | React Native for all (incl. tvOS) | Single codebase, display-only is simple enough |
| Transitions | Configurable per song/global | User flexibility without complexity |
| Controller Interface | Full song view + service order | Operators can jump to any section |
| Web App Scope | Full parity + admin | Accessibility for volunteers |
| User Roles | 3-tier (admin/editor/operator) | Covers most church structures |
| Billing | Flat fee by attendance bracket | Simple, predictable, fair |
| CCLI Integration | Full (import + report + verify) | Complete license compliance |
| Planning Center | Two-way sync | Churches keep PCO as hub |
| LLM Features | Content generation | Practical time-savers |
| Media Management | Smart library + stock integration | Reduces friction finding visuals |
| Offline Mode | Cached service | Service runs even if WiFi drops |
| State Management | TanStack Query + React Context | No extra library needed |

## Database Schema

```sql
-- Multi-tenancy base
churches (
  id uuid PRIMARY KEY,
  name text,
  attendance_bracket text,  -- '<100', '100-500', '500-1000', '1000+'
  stripe_customer_id text,
  subscription_status text,
  ccli_license_number text,
  planning_center_token text,  -- encrypted
  settings jsonb,  -- default transitions, themes, etc.
  created_at timestamptz
)

-- User management (3-tier roles)
users (
  id uuid PRIMARY KEY REFERENCES auth.users,
  church_id uuid REFERENCES churches,
  role text CHECK (role IN ('admin', 'editor', 'operator')),
  name text,
  email text,
  created_at timestamptz
)

-- Song library
songs (
  id uuid PRIMARY KEY,
  church_id uuid REFERENCES churches,
  title text,
  author text,
  ccli_song_id text,
  key text,
  tempo int,
  content jsonb,  -- { sections: [{ type, label, lines }] }
  default_arrangement jsonb,  -- ordered section indices
  default_background_id uuid,
  transition_type text,
  tags text[],
  last_used_at timestamptz,
  created_at timestamptz
)

-- Media library
media (
  id uuid PRIMARY KEY,
  church_id uuid REFERENCES churches,
  type text CHECK (type IN ('image', 'video')),
  storage_path text,
  thumbnail_path text,
  source text,  -- 'upload', 'unsplash', 'pexels'
  source_id text,
  dominant_color text,
  tags text[],
  metadata jsonb,
  created_at timestamptz
)

-- Events (services)
events (
  id uuid PRIMARY KEY,
  church_id uuid REFERENCES churches,
  title text,
  scheduled_at timestamptz,
  items jsonb,  -- [{ type, id, arrangement, background_id }]
  status text CHECK (status IN ('draft', 'ready', 'live', 'completed')),
  created_at timestamptz
)

-- CCLI reporting
song_usage (
  id uuid PRIMARY KEY,
  church_id uuid REFERENCES churches,
  song_id uuid REFERENCES songs,
  event_id uuid REFERENCES events,
  ccli_song_id text,
  displayed_at timestamptz
)
```

All tables use RLS policies:
```sql
CREATE POLICY "tenant_isolation" ON songs
  USING (church_id = (SELECT church_id FROM users WHERE id = auth.uid()));
```

## Monorepo Structure

```
mobileworship/
├── apps/
│   ├── host/                    # React Native display app
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   └── DisplayScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── SlideRenderer.tsx
│   │   │   │   ├── VideoBackground.tsx
│   │   │   │   └── TransitionManager.tsx
│   │   │   └── services/
│   │   │       ├── ConnectionService.ts
│   │   │       └── CacheService.ts
│   │   ├── windows/
│   │   ├── macos/
│   │   └── package.json
│   │
│   ├── client/                  # React Native controller app
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   │   ├── ServiceControlScreen.tsx
│   │   │   │   ├── SongViewScreen.tsx
│   │   │   │   └── LibraryScreen.tsx
│   │   │   ├── components/
│   │   │   │   ├── ServiceOrder.tsx
│   │   │   │   ├── SectionPicker.tsx
│   │   │   │   └── HostConnector.tsx
│   │   │   └── services/
│   │   │       └── DiscoveryService.ts
│   │   ├── ios/
│   │   ├── android/
│   │   └── package.json
│   │
│   ├── tv/                      # React Native TV apps
│   │   ├── src/
│   │   ├── tvos/
│   │   ├── android-tv/
│   │   └── package.json
│   │
│   └── web/                     # Next.js web app
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   ├── (dashboard)/
│       │   │   │   ├── songs/
│       │   │   │   ├── events/
│       │   │   │   ├── media/
│       │   │   │   └── settings/
│       │   │   └── (control)/
│       │   └── components/
│       └── package.json
│
├── packages/
│   ├── shared/                  # Shared business logic
│   │   ├── src/
│   │   │   ├── types/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   │   ├── supabase.ts
│   │   │   │   ├── sync.ts
│   │   │   │   └── offline.ts
│   │   │   └── utils/
│   │   │       ├── lyrics.ts
│   │   │       └── transitions.ts
│   │   └── package.json
│   │
│   ├── ui/                      # Shared UI components
│   │   ├── src/
│   │   │   ├── SongCard.tsx
│   │   │   ├── MediaPicker.tsx
│   │   │   ├── SlidePreview.tsx
│   │   │   └── ...
│   │   └── package.json
│   │
│   └── protocol/                # Host-client communication
│       ├── src/
│       │   ├── messages.ts
│       │   ├── local.ts
│       │   └── remote.ts
│       └── package.json
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   │   ├── ccli-report/
│   │   ├── ccli-import/
│   │   ├── planning-center-sync/
│   │   ├── ai-format-lyrics/
│   │   ├── ai-scripture-slides/
│   │   └── stripe-webhook/
│   └── seed.sql
│
├── turbo.json
├── package.json
└── CLAUDE.md
```

## Communication Protocol

```typescript
// Client → Host commands
type ClientCommand =
  | { type: 'GOTO_SLIDE'; slideIndex: number }
  | { type: 'GOTO_SECTION'; sectionIndex: number }
  | { type: 'GOTO_ITEM'; itemIndex: number }
  | { type: 'NEXT_SLIDE' }
  | { type: 'PREV_SLIDE' }
  | { type: 'BLANK_SCREEN' }
  | { type: 'SHOW_LOGO' }
  | { type: 'SET_TRANSITION'; transition: TransitionType };

// Host → Client state
type HostState = {
  eventId: string;
  currentItemIndex: number;
  currentSlideIndex: number;
  isBlank: boolean;
  isLogo: boolean;
  connectedClients: number;
};
```

**Connection Priority:**
1. Local mDNS discovery first (low latency)
2. Fall back to Supabase Realtime after 3 seconds
3. Auto-reconnect via Supabase if local drops
4. UI shows connection type indicator

## User Roles & Permissions

| Role | Permissions |
|------|-------------|
| Admin | Full access: billing, users, library, events, control, integrations |
| Editor | Library CRUD, event CRUD, live control |
| Operator | Read library, read events, live control only |

## External Integrations

### CCLI
- **Import**: Search SongSelect API, import lyrics to library
- **Reporting**: Track usage in song_usage table, generate reports
- **Verification**: Check license coverage on import, flag unlicensed songs

### Planning Center
- **Import**: Pull songs and service plans
- **Export**: Push actual song usage back for reporting
- **Trigger**: Manual sync, webhook, or daily schedule

### Stripe Billing
| Attendance | Price |
|------------|-------|
| < 100 | $19/month |
| 100-500 | $39/month |
| 500-1000 | $69/month |
| 1000+ | $99/month |

### Stock Media
- Proxy API calls through edge functions
- Download selected images to Supabase Storage
- Store attribution in media.metadata

## LLM Features (Edge Functions)

| Function | Purpose |
|----------|---------|
| ai-search | Natural language song search with embeddings |
| ai-format-lyrics | Parse raw text into structured sections |
| ai-scripture | Fetch and split scripture into readable slides |
| ai-announcements | Generate polished text from bullet points |
| ai-suggest-songs | Recommend songs based on theme and history |

Rate limited per church, cached for common requests.

## Offline Caching

When loading an event for live control:
1. Cache event metadata, all songs, all media locally
2. Host: SQLite + file system
3. Client: AsyncStorage (no media)
4. Web: IndexedDB + Cache API

Offline behavior:
- All navigation works
- Usage logged locally, syncs when online
- No library browsing or AI features

## Tech Stack

**Frontend:**
- React Native 0.73+
- react-native-tvos
- Vite + React 18 (SPA, Cloudflare Pages)
- TypeScript
- Tailwind CSS / NativeWind
- TanStack Query (server state)
- React Context (client state)

**Backend:**
- Supabase (PostgreSQL, RLS, Storage, Realtime, Auth, Edge Functions)
- Stripe
- Gemini 2.0 Flash

**Tooling:**
- Turborepo
- pnpm
- ESLint + Prettier
- GitHub Actions

## MVP Scope

**v1.0 Include:**
- Song library CRUD
- Media library (upload, organize)
- Event creation & management
- Host display (image backgrounds + text)
- Client controller (full song view)
- Web app (admin + control)
- Local + Supabase Realtime communication
- Basic transitions (fade, cut)
- Offline cached services
- 3-tier roles
- Stripe billing
- CCLI tracking, export, import
- AI lyrics formatter
- AI scripture slides

**Defer:**
- Planning Center integration
- Stock media integration
- AI song suggestions
- AI announcements
- Video backgrounds
- Multi-campus support
- Advanced analytics
- Custom themes/layouts
- CCLI auto-submit
