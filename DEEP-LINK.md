# POST Venue Rental — Inquiry Form: Deep Linking

## Purpose
Let a venue selection live in the URL so it can be **shared and pre-filled**. Sales/
marketing (or a CMS link, ad, or email) can point someone at the form with specific
spaces already ranked — e.g. link straight to "Outpost + Penthouse" — and the visitor
lands with those selected. The URL also updates as they pick, so they can copy/share
their current selection.

Scope: **venue selection only** (the build steps — contact, event type, etc. — are
not encoded).

## Query format
```
?venues=outpost,penthouse,art-club     1st = Outpost, 2nd = Penthouse, 3rd = Art Club (order = rank)
?venues=none                            "No preference"
(no param)                              nothing pre-selected
```
Valid IDs: `office, x-atrium, penthouse, outpost, skylawn-room, art-club, jordan-plaza, docks`
(plus `none`). Max 3.

## Logic (in `src/js/inquiry-form.js`)
Two functions, ~40 lines total. Nothing else in the app changed for this.

- **Write — `syncVenuesToUrl()`** — called on every venue action (pick, reorder ↑/↓,
  remove, "No preference", reset). Builds the `venues` param from current state and
  calls `history.replaceState` — updates the address bar with **no page reload and no
  Back-button history entries**. Other existing query params are preserved (it only
  touches `venues`); commas are kept human-readable.
- **Read — `applyVenuesFromUrl()`** — called once on load, after the venue list has
  loaded. Parses `?venues=`, then validates: unknown IDs skipped, duplicates removed,
  capped at 3, case-insensitive; if real IDs are present they win over `none`. Applies
  the selection and **normalizes the URL** to the cleaned set.

## Hosting note (related, not the feature)
GitHub Pages now serves `src/` as the site **root** (via `.github/workflows/pages.yml`)
instead of redirecting from a root `index.html`. The old redirect dropped the query
string; serving the app at root means `/?venues=…` resolves directly. This is a
preview-hosting detail and does not affect the embedded Webflow build.

## Integration impact — minimal
- **No change to the submit contract.** `EventTempleAdapter.submit(payload)` and the
  `payload` shape are untouched. Venue selections were already part of the payload
  (`payload.venues` / `payload.noPreference`); deep linking only sets that **initial
  UI state** from the URL. The backend receives the same payload on submit either way.
- **URL params:** a `venues` param now appears in the address bar. Any other params on
  the page (e.g. `utm_*`) are **preserved** — the logic adds/removes only `venues`.
- **No navigation:** `replaceState` updates the URL in place (no reload, no new history
  entry). Analytics/tools that *listen for history changes* will see an update on each
  venue action; a normal pageview is unaffected.
- **Webflow:** on the live `/venuerental` page (single page) the param works directly —
  `posthtx.com/venuerental?venues=…`.
- **No PII** in the URL — only venue slugs.

## Files
- `src/js/inquiry-form.js` — `syncVenuesToUrl()` + `applyVenuesFromUrl()` and the calls
  in the venue handlers.
- `.github/workflows/pages.yml` — serves `src/` at root (hosting only).
