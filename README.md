# POST Venue Rental — Inquiry Form (engineering handoff)

A self-contained, vanilla **HTML/CSS/JS** multi-step inquiry form. No build step,
no framework, no dependencies. It mounts into one `<div>` and submits to **Event
Temple**. Designed to be embedded in the Webflow `/venuerental` page.

> Flow & UX spec: see [USER-FLOW.md](USER-FLOW.md).

---

## What to ship (zip just this)

```
src/                          ← the entire app; this is all you need to deploy
├── index.html                  preview shell + the Webflow embed snippet
├── css/
│   └── inquiry-form.css         dark design system (tokens at top; edit those)
├── js/
│   ├── config.js                form copy, steps, fields  (content — no logic)
│   ├── inquiry-form.js          app logic / state machine (no content)
│   └── integrations/
│       └── event-temple.js      Event Temple adapter  ← the integration work
└── data/
    ├── venues.json              venue catalog (CMS/API-ready)
    └── event-temple-form.json   reference: live ET form schema (read-only)
```

Everything **outside `src/`** is reference/context, safe to leave out of the zip:
`*.md`, `assets/`, `post_event_inquiry_builder_v2.html` (original prototype),
`POST WORK ….html`.

---

## Architecture

Plain `window`-globals, loaded in order (no modules/bundler):

1. `config.js`  → `window.POST_INQUIRY_CONFIG` — all copy, steps, and fields.
2. `event-temple.js` → `window.EventTempleAdapter` — `.submit(payload)`.
3. `inquiry-form.js` → IIFE that mounts into `[data-pvr-root]`, fetches
   `data/venues.json`, renders the flow, and calls `EventTempleAdapter.submit()`.

```
config.js ─┐
venues.json ┼─► inquiry-form.js (UI + state) ──► EventTempleAdapter.submit() ──► Event Temple
event-temple.js ┘
```

- **Separation:** no content/brand strings live in `inquiry-form.js`; no logic in
  `config.js`. Venue content is data (`venues.json`), swappable for a CMS/API URL
  via `config.dataSources.venues` (same shape) with zero code change.
- **Styling:** `inquiry-form.css` is a token-driven design system — one `:root`
  token block (surfaces, single `--border`, 4px spacing scale, two button
  variants). Everything namespaced under `.pvr` to avoid Webflow collisions.
- **State:** single `state` object in `inquiry-form.js` (step index, field
  `values`, ranked venue `picks`, etc.). Steps/fields are config-driven; the
  renderer handles field types: `text | email | tel | number | textarea | select
  | chips | segmented | multiselect | datemode`.

## Run locally

Must be served over **HTTP** (the app `fetch`es `data/venues.json`; `file://`
blocks it):

```
cd src && python3 -m http.server 8765
# open http://localhost:8765/index.html
```

## Embed in Webflow

1. Host `css/`, `js/`, `data/` (e.g. the CDN at `cdn.lovettgroup.com/posthtx/venuerental/`).
2. On the page: load `config.js`, then `event-temple.js`, then `inquiry-form.js`
   (order matters), reference `inquiry-form.css`, and place `<div data-pvr-root></div>`.
   See `src/index.html` for the exact snippet. The Adobe Fonts kit
   (`neue-haas-grotesk-display`) is already loaded site-wide by Webflow.

---

## The integration work — `js/integrations/event-temple.js`

The form only calls `EventTempleAdapter.submit(payload)`. The adapter already
contains the **real** live schema for the "Outpost Inquiry Form"
(`lead_intake_form_setting 2607`): endpoint, form token, `booking_type_id` map,
custom-field hashes, and a `/lead_intakes/create` body builder. Full field
reference: `data/event-temple-form.json`.

**Status / TODO:**
- `LIVE = false` — `submit()` currently only `console.log`s the payload it *would*
  send. **Flip `LIVE = true` after one validated test submission.**
- The mapping is **rough** (front-end was the priority). Open items, all flagged
  in-file: confirm custom-field picklists want option **text vs id**; guest range
  is sent as **midpoint**; services / flexible-date / ranked venues are folded
  into the **notes** field (ET has no native field for them); CORS — posting
  cross-origin from posthtx.com → app.eventtemple.com may need a proxy.
- `partial:true` early lead (name/email) is **not** sent to the strict intake
  endpoint — route it to your CRM/Zapier sink.
- On success the form redirects to `config.successUrl` (`/venuerental-success`);
  in preview (`LIVE=false`) it shows the done screen instead.

## Notes
- No analytics/PII handling beyond the form fields. Don't commit secrets here —
  the CDN path is public.
- `data/event-temple-form.json` is captured reference only; not loaded at runtime.
