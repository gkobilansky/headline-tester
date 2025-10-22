# Embed Snippet & Widget Implementation Plan

## Overview
Reuse the existing chat experience as the iframe widget surface and deliver a single-line loader script that sites can embed. The host page decides when to reveal the widget (for example, admins visiting with `headlinetester=1`), while regular visitors never see it by default.

## Current State Analysis
- Auth middleware currently forces unauthenticated traffic through guest sign-in and redirects non-guests away from `/login` and `/register` (`middleware.ts:5-40`, `app/(auth)/auth.ts:34-95`).
- The chat UI is encapsulated in `components/chat.tsx:36-249`, making it straightforward to reuse in an iframe with minor chrome adjustments.
- No widget route, embed script, or domain token model exists yet; only generic chat capabilities are present (`lib/db/schema.ts:16-173`, `PRD.md` context).

## Desired End State
- `/widget` serves a minimized chat experience that defaults to hidden and can be revealed via query flag or `postMessage`; requests validate a public token before rendering.
- A small loader script (e.g., `/widget/embed.js`) creates the iframe, reads host-page context (query string, cookie, or future admin signal), and either appends the reveal flag or sends a `show` control message. It exposes a `window.HeadlineTesterWidget` control stub.
- Basic `postMessage` scaffolding links host page and iframe for later admin interactions.

### Key Discoveries:
- Chat component already accepts the props we need to hide sidebar UX and reuse the streaming transport (`components/chat.tsx:36-249`).
- Middleware must be relaxed for `/widget` resources to avoid redirect loops (`middleware.ts:5-40`).
- No persistence exists for widget tokens; we can start with a stub lookup and iterate.

## What We're NOT Doing
- Implementing billing, analytics, or domain onboarding flows.
- Building the full Konami code trigger or rich control channel.
- Refactoring the chat experience beyond widget-specific tweaks.

## Implementation Approach
Introduce a new App Router group for the widget, ensure middleware allowlists it, and deliver a static/dynamic embed script. Reuse the chat component in “widget mode,” defer deep token management, and add a `postMessage` hook for future phases.

## Phase 1: Widget Shell & Routing

### Overview
Create a `/widget` entry point that renders the chat in widget mode, defaults to hidden, and bypasses middleware redirects.

### Changes Required:

#### 1. Widget Route Group  
**File**: `app/(widget)/layout.tsx` *(new)*  
**Changes**: Minimal HTML/body wrapper with transparent background, omitting sidebar providers unless required.

```tsx
export default function WidgetLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-transparent">{children}</body>
    </html>
  );
}
```

#### 2. Widget Page  
**File**: `app/(widget)/page.tsx` *(new)*  
**Changes**: Fetch query params, evaluate `headlinetester` flag, and hand control to a client-side widget shell that listens for `headlineTester:*` messages. Pass through widget token from query.

#### 3. Chat Component Adjustments  
**File**: `components/chat.tsx:36-249`  
**Changes**: Add `isWidget` prop to hide sidebar toggle, deploy button, suggested actions, etc.

#### 4. Middleware Allowlist  
**File**: `middleware.ts:5-40`  
**Changes**: Skip guest redirect for `/widget` and `/widget/embed.js`.

#### 5. Widget Styling  
**File**: `app/globals.css` (or scoped CSS)  
**Changes**: Ensure iframe-ready sizing, transparent backgrounds, and no forced full viewport.

### Success Criteria:

#### Automated Verification
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`

#### Manual Verification
- [ ] `/widget?headlinetester=1` renders chat without sidebar elements.
- [ ] Without a `headlineTester:show` message, `/widget` renders nothing visible; adding `headlinetester=1` continues to pre-open for manual testing.
- [ ] Middleware no longer redirects widget loads.
- [ ] Embedding iframe manually confirms layout stability.

**Implementation Note**: Pause for manual sign-off after Phase 1 before advancing.

---

## Phase 2: Loader Snippet & Bootstrapping

### Overview
Ship the single-line loader script that injects the iframe, inspects the host page for the admin reveal signal, and exposes basic controls.

### Changes Required:

#### 1. Loader Script  
**File**: `public/widget/embed.js` *(new)*  
**Changes**: Self-invoking script that reads `data-token`, creates a container + iframe pointing to `/widget?token=...`, applies default positioning, inspects the host page for `headlinetester=1` (or a persisted admin flag), and either appends the reveal query to the iframe URL or sends a `show` message. Stub a global control API.

#### 2. Optional Dynamic Route  
**File**: `app/widget/embed/route.ts` *(new, optional)*  
**Changes**: Serve script dynamically if we need ETag/cache headers or token-specific responses.

#### 3. Docs Update  
**File**: `README.md` or new `docs/widget.md`  
**Changes**: Document embed usage and snippet syntax.

### Success Criteria:

#### Automated Verification
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`

#### Manual Verification
- [ ] Embedding `<script src=".../widget/embed.js" data-token="demo"></script>` shows the widget when the host URL includes `?headlinetester=1` (host page) or after calling `HeadlineTesterWidget.show()`.
- [ ] Script handles missing token gracefully.
- [ ] Multiple inclusions remain idempotent.

**Implementation Note**: Pause after validation for review before Phase 3.

---

## Phase 3: Config, Token Flow & Controls

### Overview
Stub token validation, pass config into the widget, and wire basic `postMessage` handshake.

### Changes Required:

#### 1. Token Lookup Stub  
**File**: `lib/db/queries.ts` (or helper)  
**Changes**: Placeholder `getWidgetConfig(token)` returning demo config or null.

#### 2. Widget Config Injection  
**File**: `app/(widget)/page.tsx`  
**Changes**: Resolve token to config, `notFound()` on failure, pass config into `<Chat>` or widget wrapper.

#### 3. PostMessage Skeleton  
**Files**: `public/widget/embed.js`, `app/(widget)/page.tsx`  
**Changes**: Parent script listens for `headlineTester:ready`; iframe posts ready event and handles `headlineTester:show`/`hide`, so reveal can be triggered without altering iframe URL.

#### 4. Visibility Hook  
**File**: `components/chat.tsx` or new hook  
**Changes**: In widget mode, respond to visibility events and control initial hidden state.

### Success Criteria:

#### Automated Verification
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`

#### Manual Verification
- [ ] Invalid token blocks widget rendering.
- [ ] `window.HeadlineTesterWidget.show()` toggles widget without reloading.
- [ ] `postMessage` handshake logs/messages appear as expected.
- [ ] Widget remains hidden until query flag or show message triggers.

**Implementation Note**: Pause for confirmation before extending beyond Phase 3.

---

## Testing Strategy

### Unit Tests
- Token config helper (once real logic added).
- `Chat` widget mode snapshot to ensure UI changes.

### Integration Tests
- Extend route tests to cover `/widget` default hidden state and `/widget?headlinetester=1`.
- Playwright scenario embedding iframe (if feasible) or at least loading widget route.

### Manual Testing Steps
1. Embed script in static HTML; toggle `?headlinetester=1` (host page) or call `HeadlineTesterWidget.show()/hide()` and observe behavior.
2. Trigger `window.HeadlineTesterWidget.show()/hide()` and verify.
3. Confirm middleware/path access for loader + iframe.
4. Test script execution order (async/deferred) to ensure resilience.

## Performance Considerations
- Keep embed script lean (<5 KB), serve with cache headers, and lazy-load heavy assets inside iframe.
- Avoid forcing full-height layout; consider `ResizeObserver` later for dynamic sizing.

## Migration Notes
No schema changes for MVP; token/config lookup remains stubbed. Future domain registration work will add migrations.

## References
- Product context: `PRD.md`
- Chat component: `components/chat.tsx`
- Middleware routing: `middleware.ts`
