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

## 5. Update the Demo Headline

Once the iframe signals readiness the loader shares the page headline with the
widget. The editor panel above the chat displays the selector and copy so you
can iterate in place.

1. Reveal the widget (append `?hlt=1` or call `show({ open: true })`).
2. Enter new copy in the **Demo page headline** textarea.
3. Click **Ask AI to rewrite** to push the current headline into the chat and
   get fresh suggestions instantly (optional).
4. Click **Apply** to update the host page. The loader acknowledges success with
   a `headlineTester:headlineUpdated` message so the widget can reflect the new
   state and log the change in the transcript.
5. Use **Reset** to restore the original text captured when the script first
   loaded.

All edits remain local to the browser for now—refreshing the page reverts to the
original markup until persistence lands in a later phase.

## 6. Admin Testing Checklist

1. Embed the script on a static page and confirm nothing renders until you use
   the URL flag or control API.
2. Visit with `?hlt=1` and verify the launcher appears (the chat should open if
   `show({ open: true })` is used).
3. Call `HeadlineTesterWidget.hide()` and `show({ open: true })` from the
   console to confirm commands queue correctly before the iframe loads.
4. Ask the assistant for a rewrite, apply a headline edit, and confirm the chat
   transcript notes the change before using **Reset** to return to the original
   copy.

## 7. What’s Next

Upcoming phases will introduce experiment persistence, visitor bucketing, and
telemetry so admins can launch and monitor tests without leaving the chat.
