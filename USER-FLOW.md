# POST Venue Rental — Inquiry Form: User Flow

Step-by-step reference for the inquiry form. This is the **source of truth for the
front-end flow**. Event Temple field mapping is handled separately in
`src/js/integrations/event-temple.js` (see `src/data/event-temple-form.json`) and is
intentionally rough for now — get the flow/look right first, map later.

Layout: three panels — **left** = spaces, **middle** = the active step, **right** =
live summary (editable). The middle panel advances; left + right stay visible. On
mobile the panels stack: spaces → step → summary.

---

## SECTION 1 — SPACE  *(optional, never required)*

- Shows all spaces (grid). **"Photos + details"** opens a lightbox with the photo
  gallery **＋ feature matrix** (capacity, seated dining, scale, amenities, best-for).
- The visitor may:
  - **Rank up to 3** spaces (tap in order → 1 / 2 / 3; tap again to remove), **or**
  - tap **"No preference — help me choose"**, **or**
  - **select nothing**.
- If nothing is ranked, the venue submits as **"No preference."**
- **Mobile:** ranking a space or tapping "No preference" auto-scrolls down to the
  Build section so the visitor knows to continue.
- Over-capacity note: if a ranked venue's max capacity is below the chosen guest
  count, a soft note shows (lightbox + summary). Never blocks.

## SECTION 2 — BUILD  *(one step at a time)*

**Step 1 — Contact**  *(captured first → CRM)*
- First name, Last name, Email, Phone — all required.
- **Best way to reach you?** — a segmented **Email / Phone** toggle under the fields.
- When the required fields are valid, the button reads **"Start build →"** (not "Continue").
- A partial lead fires as soon as first + last + a valid email exist (early capture).

**Step 2 — Event type**
- Single choice. Options pulled from Event Temple booking types.

**Step 3 — Guests**
- Single choice, **selection ranges** (Under 50 · 50–150 · … · 2,000+ · Not sure yet).
- Mapped to Event Temple's numeric field as the **midpoint** of the range.

**Step 4 — Date**
- A mode toggle: **"I have a date in mind"** vs **"I'm flexible."**
  - *Have a date* → calendar date picker.
  - *Flexible* → preferred **month** + **timing** (Early / Mid / Late / Any).

**Step 5 — Budget**
- Single choice, **selection ranges** (matches Event Temple budget picklist).
- **＋ Optional** "I need help with…" — multi-select services: Catering, A/V &
  production, Furniture & rentals, Décor & florals, Event staffing, Entertainment / DJ.

**Step 6 — A few details**
- Event name (what should we call this event?) — required.
- Your role — required.
- How did you hear about us? — required.
- Anything else? — free-text notes (optional).

## SECTION 3 — REVIEW & SUBMIT

- After Step 6 the visitor lands on a **Review** screen — the full recap, with an
  **Edit** link on each entry (jumps back to that step) and venue **reorder / remove**.
- **No auto-submit.** Submit lives only on the Review screen.
- On submit → success → redirect to **https://www.posthtx.com/venuerental-success**.
  *(In preview / `LIVE=false`, shows the "all set" screen instead of navigating away.)*

---

## Mapping notes (handle later)
- Guest range → midpoint number; exact range text also saved to notes.
- Services + flexible-date preference + ranked venues have **no native Event Temple
  field** → folded into the Additional Notes text on submit.
- How-heard + preferred-contact + role map to their Event Temple fields.
- Adapter `LIVE = false` (logs only). Flip on after one validated test submission.
