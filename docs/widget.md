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

## 5. Persist a Headline Experiment

When the editor panel is open, clicking **Apply** updates the host page _and_
posts the selector/original copy/new copy to `/api/widget/experiments`. The
backend stores a draft experiment keyed by the widget token so later visits can
reuse the same control/variant pair. If the call succeeds the chat confirms the
save; failures surface inline so you can retry.

Resetting the headline through the widget leaves the stored control intact while
marking the experiment inactive. Removing the experiment record entirely will
return visitors to the original copy.

## 6. Visitor Rollout & Bucketing

The loader now fetches the active experiment on page load. Each visitor is
deterministically assigned to `control` or `variant` (hash + localStorage) and,
if bucketed into the variant, sees the saved headline immediately. Admin-only
visits (e.g. `?hlt=1`) always reveal the launcher regardless of bucket so you
can manage the test.

If no active experiment exists the loader is a no-op for regular visitors and
the widget behaves as before.

## 7. Track Conversions

Two telemetry hooks ship with the rollout:

```js
// Record a manual conversion (e.g. CTA click).
window.HeadlineTesterWidget.trackConversion();
```

Impressions are logged automatically whenever a visitor receives variant copy.
Conversion helpers buffer in the loader and post to
`/api/widget/events?type=conversion` alongside the visitor bucket, token, and
timestamp. Use these events to gauge variant performance before promoting it to
control.

## 8. Admin Testing Checklist

1. Load the demo page without `?hlt=1` twice in a clean browser — confirm control
   and variant appear on alternating visits.
2. Append `?hlt=1` to ensure the launcher shows regardless of bucket and that
   the chat reflects the active experiment.
3. Apply a new headline, refresh without the flag, and confirm visitors in the
   variant bucket see the update immediately.
4. Call `HeadlineTesterWidget.trackConversion()` in the console and verify the
   event posts successfully.
