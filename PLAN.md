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
Introduce a new App Router group for the widget, ensure middleware allowlists it, and deliver a static/dynamic embed script. Reuse the chat component in “widget mode,” prove the parent<->iframe control channel by syncing headline state on the demo page, then defer deep token management and test authoring until after the DOM editing flow is solid.

## Phase 1: Widget Shell & Routing *(Completed)*

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
- [x] `pnpm lint`
- [ ] `pnpm test`
- [x] `pnpm build`

#### Manual Verification
- [x] `/widget?headlinetester=1` renders chat without sidebar elements.
- [x] Without a `headlineTester:show` message, `/widget` renders nothing visible; adding `headlinetester=1` continues to pre-open for manual testing.
- [x] Middleware no longer redirects widget loads.
- [x] Embedding iframe manually confirms layout stability.

**Implementation Note**: Pause for manual sign-off after Phase 1 before advancing.

---

## Phase 2: Loader Snippet & Bootstrapping *(Completed)*

### Overview
Ship the single-line loader script that injects the iframe, inspects the host page for the admin reveal signal, and exposes basic controls aligned with the `?hlt=1` reveal flow.

### Changes Required:

#### 1. Loader Script  
**File**: `public/widget/embed.js` *(new)*  
**Changes**:
- Publish a self-executing script that site owners embed before `</body>`.
- Read the `data-token` attribute when present, otherwise fall back to the demo token (`demo`) and build the iframe URL as `/widget?token=<token>`.
- Create an anchored container, inject the iframe once (protect against duplicate script inclusions), and defer setting `src` until after the DOM is ready.
- Listen for the iframe’s `headlineTester:ready` event; when fired, check the host `location.search` for `hlt=1` and post a `headlineTester:show` message if present.
- Expose `window.HeadlineTesterWidget` with `show()` and `hide()` helpers that post the corresponding `headlineTester:*` messages. Queue calls issued before `ready` and flush once the iframe acknowledges.
- Keep the bundle lightweight (target <5 KB) and ensure styles position the widget consistently in the bottom-right corner without leaking globals.

#### 2. Optional Dynamic Route  
**File**: `app/widget/embed/route.ts` *(new, optional)*  
**Changes**: Serve script dynamically if we need ETag/cache headers or token-specific responses.

#### 3. Docs Update  
**File**: `README.md` or new `docs/widget.md`  
**Changes**: Document the paste-in snippet, explain the `?hlt=1` reveal convention, and describe the `HeadlineTesterWidget.show()/hide()` controls.

### Success Criteria:

#### Automated Verification
- [x] `pnpm lint`
- [ ] `pnpm test`
- [x] `pnpm build`

#### Manual Verification
- [x] Embedding `<script src=".../widget/embed.js" data-token="demo"></script>` shows the widget when the host URL includes `?hlt=1` (host page) or after calling `HeadlineTesterWidget.show()`.
- [x] Script handles missing token gracefully.
- [x] Multiple inclusions remain idempotent.

**Implementation Note**: Pause after validation for review before Phase 3.

---

## Phase 3: Demo Headline Controls *(Completed)*

### Overview
Enable the demo embed to share headline context with the widget and let admins overwrite it directly, proving the control channel before deeper config work.

### Changes Required:

1. **Host DOM Context Handshake**  
   **Files**: `public/widget/embed.js`, `test-sites/widget-demo/index.html`  
   **Changes**: Once the iframe posts `headlineTester:ready`, locate the headline node (prefer `[data-headlinetester-target="headline"]`, fall back to the first `<h1>`), capture its text/selector, and send a `headlineTester:domContext` payload to the widget. Persist the original copy so we can reset on reload.

2. **Widget Headline Controls**  
   **Files**: `components/widget-root.tsx`, `components/chat.tsx`, `components/widget-headline-controls.tsx` *(new)*  
   **Changes**: Store incoming headline context, render a compact editor above the chat that shows the current copy, and allow admins to input a replacement. When the user applies changes, post `headlineTester:updateHeadline` with the new text and disable the form while awaiting a response.

3. **DOM Update & Acknowledgement**  
   **Files**: `public/widget/embed.js`  
   **Changes**: Listen for `headlineTester:updateHeadline`, patch the host headline's `textContent`, guard against missing targets, and emit a `headlineTester:headlineUpdated` message indicating success or error so the widget can reflect status.

4. **Assistant Integration** *(optional but recommended)*  
   **Files**: `components/multimodal-input.tsx`, `components/chat.tsx`  
   **Changes**: Add a quick action to push the current headline into the conversation for rewriting and append a system message when an update lands so the transcript documents the change.

### Success Criteria:

#### Automated Verification
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`

#### Manual Verification
- [x] Demo widget surfaces the current headline context after load.
- [x] Applying a new headline updates the demo page immediately without reload.
- [x] Refreshing the page restores the original headline copy.
- [x] Chat transcript captures the applied update (if assistant integration shipped).

**Implementation Note**: Validate on both the Next.js dev server and the static `test-sites/widget-demo` page to avoid origin-specific assumptions.

---

## Phase 4: Config, Token Flow & Controls *(Completed)*

### Overview
Stub token validation, hydrate the widget with server-provided config (including any active experiment shell), and harden the `postMessage` handshake so loader-driven reveals and future controls stay reliable.

### Changes Required:

#### 1. Token Lookup Stub  
**File**: `lib/db/queries.ts` (or helper)  
**Changes**: Placeholder `getWidgetConfig(token)` returning demo config or null.

#### 2. Widget Config Injection  
**File**: `app/(widget)/page.tsx`  
**Changes**: Resolve token to config, `notFound()` on failure, pass config (token metadata plus latest experiment snapshot placeholder) into `<Chat>` or widget wrapper.

#### 3. PostMessage Skeleton  
**Files**: `public/widget/embed.js`, `app/(widget)/page.tsx`  
**Changes**: Parent script listens for `headlineTester:ready`; iframe posts ready event and handles `headlineTester:show`/`hide`, so reveal can be triggered without altering iframe URL. Extend the payload to carry widget mode + experiment readiness flags.

#### 4. Visibility Hook  
**File**: `components/chat.tsx` or new hook  
**Changes**: In widget mode, respond to visibility events and control initial hidden state.

#### 5. Loader ↔ Widget Handshake Contract  
**Files**: `public/widget/embed.js`, `components/widget-root.tsx`  
**Changes**: Document and enforce the message types the loader can rely on (`ready`, `mode`, `dimensions`, `domContext`), enabling later experiment payloads without breaking compatibility.

### Success Criteria:

#### Automated Verification
- [x] `pnpm lint`
- [ ] `pnpm test`
- [x] `pnpm build`

#### Manual Verification
- [ ] Invalid token blocks widget rendering.
- [ ] `window.HeadlineTesterWidget.show()` toggles widget without reloading.
- [ ] `postMessage` handshake logs/messages appear as expected.
- [ ] Widget remains hidden until query flag or show message triggers.

**Implementation Note**: Pause for confirmation before extending beyond Phase 4.

---

## Phase 5: Test Authoring Flow

### Overview
Let admins turn the in-widget headline edits into persisted experiments tied to their public token so future visitors can see variants without re-running the chat.

### Changes Required:

1. **Experiment Schema & Storage**  
   **File**: `lib/db/schema.ts`, `lib/db/queries.ts`  
   **Changes**: Introduce an `experiments` table keyed by widget token + path. Store control copy, latest variant copy, selector, status, author, and timestamps. Add helpers to read/write the active experiment for a token.

2. **Widget Experiment API**  
   **File**: `app/api/widget/experiments/route.ts` *(new)*  
   **Changes**: POST handler that validates a signed widget control token, accepts the DOM selector/context payload, and upserts the experiment. Return the saved record so the widget can confirm state.

3. **Widget UI Hook-Up**  
   **Files**: `components/widget-root.tsx`, `components/widget-headline-controls.tsx`  
   **Changes**: When `Apply` succeeds locally, call the new API to persist the variant; propagate success/error back into the chat stream and keep the controls focused on the saved experiment.

4. **Chat Context Integration**  
   **File**: `components/chat.tsx` or new hook  
   **Changes**: Attach experiment metadata to the chat so follow-up prompts know an experiment is active, including surfaced selector and control/variant copy.

### Success Criteria:

#### Automated Verification
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`

#### Manual Verification
- [ ] Admins can submit a test from the widget demo and see confirmation.
- [ ] API rejects requests without a valid widget token.
- [ ] Created tests are visible via a temporary inspection route or DB query.
- [ ] Chat responses include the associated test metadata.

**Implementation Note**: Evaluate telemetry needs and add analytics hooks if time permits.

---

## Phase 6: Visitor Experiment Rollout & Telemetry

### Overview
Serve the stored experiment to production visitors, split traffic 50/50, and capture impression/conversion signals so admins can monitor performance.

### Changes Required:

1. **Loader Fetch & Bucket**  
   **File**: `public/widget/embed.js`  
   **Changes**: On load, fetch the active experiment via `GET /api/widget/experiments?token=…`, deterministically assign each visitor to control or variant (hash + cookie/localStorage), and apply the variant before revealing admin UI.

2. **Impression Event Pipeline**  
   **Files**: `public/widget/embed.js`, `app/api/widget/events/route.ts` *(new)*  
   **Changes**: Emit an impression event when a visitor is served a variant; queue delivery to the API with token, bucket, selector, and timestamp.

3. **Conversion Hook**  
   **Files**: `public/widget/embed.js`, `docs/widget.md`  
   **Changes**: Provide a simple `window.HeadlineTesterWidget.trackConversion()` helper that posts conversion events (or allow sites to trigger via DOM annotations).

4. **Admin Safeguards**  
   **Files**: `components/widget-root.tsx`, `public/widget/embed.js`  
   **Changes**: Ensure admins visiting with `?hlt=1` always see the launcher (regardless of bucket) and can reset the headline while keeping the stored control intact.

### Success Criteria:

#### Automated Verification
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`

#### Manual Verification
- [ ] Demo site shows control and variant on alternating synthetic visitors.
- [ ] Impression/conversion events arrive in the API with correct bucket metadata.
- [ ] Admins can reset to control without breaking the visitor variant.
- [ ] Removing the experiment record returns visitors to the original headline.

**Implementation Note**: Layer in a simple feature flag so the 50/50 rollout can be toggled off during validation.

---

## Testing Strategy

### Unit Tests
- Token config helper (once real logic added).
- `Chat` widget mode snapshot to ensure UI changes.

### Integration Tests
- Extend route tests to cover `/widget` default hidden state and `/widget?headlinetester=1`.
- Playwright scenario embedding iframe (if feasible) or at least loading widget route.
- Add harness that simulates two visitor buckets to confirm variant/control assignment and DOM updates.

### Manual Testing Steps
1. Embed script in static HTML; toggle `?headlinetester=1` (host page) or call `HeadlineTesterWidget.show()/hide()` and observe behavior.
2. Trigger `window.HeadlineTesterWidget.show()/hide()` and verify.
3. Confirm middleware/path access for loader + iframe.
4. Test script execution order (async/deferred) to ensure resilience.
5. Load the demo twice (fresh incognito/localStorage cleared) to validate 50/50 distribution and event recording.

## Performance Considerations
- Keep embed script lean (<5 KB), serve with cache headers, and lazy-load heavy assets inside iframe.
- Avoid forcing full-height layout; consider `ResizeObserver` later for dynamic sizing.

## Migration Notes
No schema changes for MVP; token/config lookup remains stubbed. Future domain registration work will add migrations.

## References
- Product context: `PRD.md`
- Chat component: `components/chat.tsx`
- Middleware routing: `middleware.ts`
