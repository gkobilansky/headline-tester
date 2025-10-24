# Headline Tester Widget Embed

This document explains how to add the Headline Tester widget to any HTML page,
reveal it for admins, and control it programmatically. The loader shipped in
`public/widget/embed.js` mirrors our Phase&nbsp;2 plan: it bootstraps the iframe,
listens for the widget `postMessage` handshake, and exposes a minimal control
surface on `window.HeadlineTesterWidget`.

## 1. Paste the Loader Snippet

Add the script right before the closing `</body>` tag of the host page. When
deployed, the snippet will load from the Headline Tester domain. In local
development you can point to `http://localhost:3000`.

```html
<!-- Production -->
<script src="https://app.headlinetester.com/widget/embed.js" data-token="demo"></script>

<!-- Local development -->
<script src="http://localhost:3000/widget/embed.js" data-token="demo"></script>
```

- `data-token` is optional during Phase&nbsp;2; if omitted the loader defaults to
  the hard-coded `demo` token. Token validation will arrive in Phase&nbsp;3.
- The loader is idempotent. Including the tag multiple times on the same page
  will noop after the first successful boot.

## 2. Reveal the Widget for Admins

The widget stays hidden until you either:

- Visit the page with `?hlt=1` in the URL, or
- Call `HeadlineTesterWidget.show()` once the page loads.

The loader waits for the iframe to emit `headlineTester:ready`. As soon as the
ready event fires it will:

1. Flush any queued show/hide commands.
2. Automatically call `HeadlineTesterWidget.show()` if the host URL contains
   `?hlt=1`.

This keeps production visitors unaware of the widget while allowing admins to
surface the launcher bubble on demand.

## 3. Use the Global Control Stub

The loader registers an object at `window.HeadlineTesterWidget`. Two helpers are
available today:

```js
// Reveal the widget launcher. Pass { open: true } to expand the chat immediately.
window.HeadlineTesterWidget.show();
window.HeadlineTesterWidget.show({ open: true });

// Hide the widget (launcher and chat).
window.HeadlineTesterWidget.hide();

// Inspect readiness (true after the iframe posts headlineTester:ready).
window.HeadlineTesterWidget.ready;
```

Calls made before the iframe is ready are queued and replayed after the
handshake completes, so you do not need to wait on load events manually.

## 4. Behaviour Notes

- The embed injects a fixed-position iframe anchored to the bottom-right corner
  of the viewport. When hidden it detaches pointer events; when shown it enables
  them so the launcher can be clicked.
- Styling and interaction live inside the iframe, reusing the existing chat
  implementation from Phase&nbsp;1. No additional CSS is required on the host
  page.
- Future phases will replace the demo token with domain-scoped validation and
  extend the control channel (e.g. structured configuration, context payloads).

## 5. Start a Headline Test from the Chat

Opening the widget now drops visitors into the chat stream first. The headline
editor panel appears once an admin clicks **I want to start a new headline
test**, keeping the headline controls colocated with the rest of the
conversation. The chat automatically reveals the editor after the first
headline update succeeds or fails, so admins always see status feedback without
losing their place in the transcript.
