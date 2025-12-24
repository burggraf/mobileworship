# Mobile Worship

Worship lyrics display application for churches with multi-platform host (display) and client (controller) apps.

## Project Structure

```
mobileworship/
├── apps/
│   ├── host/      # React Native display app (Windows, macOS, Linux)
│   ├── client/    # React Native controller app (iOS, Android)
│   ├── tv/        # React Native TV apps (tvOS, Android TV)
│   └── web/       # Next.js web app (admin + control)
├── packages/
│   ├── shared/    # Shared business logic, types, hooks
│   ├── ui/        # Shared UI components
│   └── protocol/  # Host-client communication protocol
├── supabase/
│   ├── migrations/
│   └── functions/
└── docs/
    └── plans/     # Design documents
```

## Tech Stack

- **Frontend**: React Native, Next.js 14, TypeScript, Tailwind/NativeWind
- **State**: TanStack Query (server), React Context (client)
- **Backend**: Supabase (PostgreSQL, RLS, Storage, Realtime, Auth, Edge Functions)
- **Payments**: Stripe
- **AI**: Gemini 2.0 Flash via Edge Functions
- **Monorepo**: Turborepo + pnpm

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Run all apps in dev mode
pnpm dev:web          # Run web app only
pnpm dev:client       # Run client app only
pnpm build            # Build all apps
pnpm lint             # Lint all packages
pnpm test             # Run tests
pnpm db:migrate       # Run Supabase migrations
pnpm db:types         # Generate TypeScript types from Supabase
```

## Architecture Notes

### Multi-tenancy
All tables have `church_id` with Row-Level Security policies. Users are scoped to their church.

### Host-Client Communication
1. Local network: WebSocket + mDNS discovery (low latency)
2. Remote fallback: Supabase Realtime channels
3. Client auto-discovers hosts, falls back after 3 seconds

### User Roles
- **Admin**: Full access including billing and user management
- **Editor**: CRUD songs, media, events; live control
- **Operator**: Read-only library access; live control only

### Offline Mode
Events cache locally when loaded. Services run fully offline once cached.

## Key Files

- `packages/shared/src/types/` - TypeScript types (generated from Supabase)
- `packages/protocol/src/messages.ts` - Host-client message definitions
- `supabase/migrations/` - Database schema
- `supabase/functions/` - Edge functions (AI, integrations, webhooks)

## External Services

- **Supabase**: Database, auth, storage, realtime
- **Stripe**: Subscription billing by church size
- **CCLI**: Song import from SongSelect, usage reporting
- **Planning Center**: Two-way sync of songs and service plans
- **Unsplash/Pexels**: Stock image search (deferred)
- **Gemini**: LLM for lyrics formatting, scripture slides

## Design Document

See `docs/plans/2024-12-23-mobile-worship-design.md` for full architecture details.
