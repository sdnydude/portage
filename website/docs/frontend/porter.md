---
id: porter
title: Porter Frontend
sidebar_position: 6
---

# Porter Frontend

Porter is Portage's AI assistant, and its frontend is what separates it from a bolted-on chatbot: Porter has function-calling access to the user's **real inventory** through three server-side tools (`search_inventory`, `get_inventory_stats`, `suggest_listing`), so the chat UI streams answers grounded in the user's actual items, prices, and stats. See [Porter API](/docs/api/porter) for the endpoint and tool contracts.

## Where Porter Lives

Porter has three entry surfaces, all backed by the same primitives:

| Surface | Location | Behavior |
|---------|----------|----------|
| Porter tab | `app/(tabs)/porter/page.tsx` | Full-page chat destination inside the `(tabs)` layout — bottom nav stays visible |
| Home hero | `app/(tabs)/home/page.tsx` | Inline Porter card on the dashboard; once engaged it can expand to a fixed `FullChat` overlay |
| Ask Porter bar | `components/porter/ask-porter-bar.tsx` | Focus-expanding input mounted in the desktop TopBar and under the PageHeader on inventory/listings/orders; submit routes to `/porter?q=…` |

The Ask Porter bar does not talk to the API itself — it navigates to `/porter?q=<text>`, where the `usePorterAutosend` hook (`hooks/use-porter-autosend.ts`) sends the query once on landing and strips the param so back-navigation can't re-send it.

### PorterProvider

`PorterProvider` (`hooks/use-porter-context.tsx`) wraps all tab pages in `app/(tabs)/layout.tsx`. It holds the `usePorterStream` state plus the chat input and an `isEngaged` flag in React context, exposed via the `usePorter()` hook. Because the provider mounts at the `(tabs)` layout level — which stays mounted while the user moves between tabs — an in-progress conversation survives navigating from Home to Inventory and back. The Home hero card and the Porter tab render the same conversation because they read the same context.

## SSE Streaming

`usePorterStream` (`hooks/use-porter-stream.ts`) is the single consumer of `POST /porter/stream`. It reads the SSE response with a `ReadableStream` reader, splits `data:` frames, and dispatches typed `StreamEvent`s (defined in `packages/shared/src/types.ts`):

| Event | Effect in the UI |
|-------|-----------------|
| `text_delta` | Appended to the current streaming text block (accumulated in a ref to avoid a re-render per chunk) |
| `tool_start` / `tool_result` | Renders a `ToolBlock` chip ("search inventory · Working…" → checkmark) while Porter queries live data |
| `action_pills` | Populates the follow-up pill row |
| `done` | Captures the `conversationId` for the next message |
| `error` | Surfaces an inline error string |

`StreamingMessage` (`components/porter/streaming-message.tsx`) renders both finished history messages and in-progress streams: markdown via `react-markdown`, thinking dots until the first block arrives, a pulsing cursor on the live text block, and `ToolBlock` entries for tool calls. Malformed SSE frames are dropped (with a dev-only console warning) rather than killing the stream.

The API also exposes a non-streaming `POST /porter/message` fallback, but the shipped frontend consumes the SSE endpoint exclusively — no web code calls the fallback today.

## Action Pills

Action pills are server-suggested follow-up messages (`ActionPill { label, message }` in shared types). The server parses `<actions>` XML out of the model response and emits them as a separate `action_pills` event; the client strips any `<actions>` markup from displayed text. A pill click calls `onSelect(pill.message)`, which flows straight into `porter.sendMessage(message)` (`components/porter/action-pills.tsx`; wired in the Porter tab and `FullChat`) — tapping "Show my top 5 items" is exactly equivalent to typing it.

The Ask Porter bar shows a different kind of pill: static page-aware suggestions from `porterPills(pathname)` in `lib/navigation.ts`, which submit through the same `/porter?q=` route.

## Conversation Persistence

Conversations are persisted server-side in the `conversations` table (`apps/api/src/db/schema.ts`) as a JSONB `messages` array of `RichMessage` objects — `{ role, blocks: ContentBlock[] }`, where `ContentBlock` is the text/tool_use/tool_result union in `packages/shared/src/types.ts`. Only text blocks are persisted (tool blocks are streaming-only); legacy plain-`content` messages are normalized into block format on read. The client keeps the active `conversationId` from the `done` event and sends it with each message; **New chat** clears it to start a fresh thread.

## Visual Identity

Porter's surfaces are keyed to Deep Teal — in the DHG system, teal marks AI/intelligence ("No purple. … DHG uses Deep Teal for AI/intelligence signaling" — [Style Guide](/docs/design/style-guide)). The Home hero renders a rotating teal aurora (`.porter-aurora`) and a breathing orb ring (`.porter-orb-ring`, both in `globals.css`, disabled under `prefers-reduced-motion`), and the Porter tab header, focus rings, and suggestion pills all use `var(--teal)` with orange reserved for the send CTA.
