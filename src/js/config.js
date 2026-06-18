/* ============================================================================
 * POST Venue Rental — Inquiry Form CONFIG
 * ----------------------------------------------------------------------------
 * The ONE file the events team edits to change form copy, steps + fields.
 * No app logic. See USER-FLOW.md for the flow this describes.
 *
 * Venue CONTENT lives in data/venues.json (CMS/API-ready) — see dataSources.
 * Event Temple field mapping lives in js/integrations/event-temple.js (rough
 * for now — flow first, mapping later).
 *
 * Field `type`s the renderer understands:
 *   text | email | tel | number | textarea | select        (standard inputs)
 *   chips        single choice (button pills)               needs `options`
 *   segmented    single choice (compact toggle)             needs `options`
 *   multiselect  many choices (button pills)                needs `options`
 *   datemode     "I have a date" / "I'm flexible" composite (built in)
 * Each field: { id, label?, text?, type, required?, placeholder?, options? }.
 * ========================================================================== */
(function (w) {
  'use strict';

  w.POST_INQUIRY_CONFIG = {

    dataSources: {
      venues: 'data/venues.json'   // swap for a CMS/API URL returning { venues:[...] }
    },

    options: {
      captureLeadEarly: true,      // fire a partial lead once name + email are valid
      maxPreferredVenues: 3        // venue is a PREFERENCE; "No preference" is allowed
    },

    // Where a successful submit sends the visitor (production). Preview shows the
    // "all set" screen instead of navigating away.
    successUrl: 'https://www.posthtx.com/venuerental-success',

    copy: {
      heroTitle: 'HOST YOUR EVENT AT POST',
      heroBlurb: "Tell us about your event and rank the spaces you love — our events team takes it from there.",
      venuePanelTitle: 'Preferred spaces — rank up to 3',
      venueHelper: "Optional. Tap spaces in order of preference (1st, 2nd, 3rd), or choose “No preference.”",
      noPreferenceLabel: 'No preference — help me choose',
      summaryTitle: 'Your event summary',
      summaryEmpty: 'Your details will appear here as you go. You can edit any step.',
      reviewTitle: 'Review your inquiry',
      reviewBlurb: 'Give everything a once-over. Edit any line, then submit.',
      submitLabel: 'Submit inquiry →',
      doneTitle: "You're all set",
      doneBlurb: 'Your inquiry has been submitted. A POST events coordinator will respond within 24 hours.'
    },

    /* ----- BUILD steps (in order) ---------------------------------------- */
    steps: [

      // Step 1 — Contact (captured first → CRM). Custom CTA.
      { id: 'contact', title: 'Your contact info',
        intro: 'First, who should we reach out to?',
        cta: 'Start build →',
        fields: [
          { id: 'firstName', label: 'First name', type: 'text', required: true, placeholder: 'First name' },
          { id: 'lastName',  label: 'Last name',  type: 'text', required: true, placeholder: 'Last name' },
          { id: 'email',     label: 'Email',      type: 'email', required: true, placeholder: 'you@email.com' },
          { id: 'phone',     label: 'Phone',      type: 'tel',  required: true, placeholder: '(000) 000-0000' },
          { id: 'preferredContact', label: 'Best way to reach you?', type: 'segmented', required: true,
            options: ['Email', 'Phone'] }
        ] },

      // Step 2 — Event type (Event Temple booking types)
      { id: 'eventType', title: 'Event type',
        fields: [
          { id: 'eventType', text: 'What kind of event are you planning?', type: 'chips', required: true,
            options: ['Wedding', 'Corporate', 'Social', 'Holiday Party', 'Meeting', 'Entertainment', 'Reunion', 'Prom', 'Sports Group', 'Tour', 'Funeral/Wake', 'Internal Use'] }
        ] },

      // Step 3 — Guests (ranges → midpoint at map time)
      { id: 'guests', title: 'Guest count',
        fields: [
          { id: 'guestCount', text: 'How many guests are you expecting?', type: 'chips', required: true,
            options: ['Under 50', '50 – 150', '150 – 300', '300 – 500', '500 – 1,000', '1,000 – 2,000', '2,000+', 'Not sure yet'] }
        ] },

      // Step 4 — Date (exact picker OR flexible month/timing)
      { id: 'date', title: 'Event date',
        fields: [
          { id: 'eventDate', text: 'When is your event?', type: 'datemode', required: true }
        ] },

      // Step 5 — Budget + optional services
      { id: 'budget', title: 'Budget & needs',
        fields: [
          { id: 'budget', text: 'Estimated total event budget? (venue, F&B, A/V, décor, etc.)', type: 'chips', required: true,
            options: ['< $10,000', '$10,000 - $20,000', '$21,000 - $30,000', '$31,000 - $40,000', '$41,000 - $50,000', '> $50,000'] },
          { id: 'services', label: 'I need help with… (optional)', type: 'multiselect', required: false,
            options: ['Catering', 'A/V & production', 'Furniture & rentals', 'Décor & florals', 'Event staffing', 'Entertainment / DJ'] }
        ] },

      // Step 6 — A few details
      { id: 'details', title: 'A few last details',
        fields: [
          { id: 'eventName', label: 'What should we call this event?', type: 'text', required: true,
            placeholder: 'e.g. 2026 Gala or Smith–Nguyen Wedding' },
          { id: 'role', label: 'Your role', type: 'select', required: true,
            options: ['Bride/Groom', 'Planner', 'Family Member', 'Party Host', 'Other'] },
          { id: 'howHeard', label: 'How did you hear about us?', type: 'select', required: true,
            options: ['Social Media', 'POST website', 'Friend/Referral', 'Search Engine', 'Other'] },
          { id: 'notes', label: 'Anything else we should know? (optional)', type: 'textarea', required: false,
            placeholder: 'Vision, must-haves, timing, special requests…' }
        ] }
    ]
  };
})(window);
