/* ============================================================================
 * POST Venue Rental — Event Temple ADAPTER
 * ----------------------------------------------------------------------------
 * Brief requirement #1 ("connect the inquiry form to Event Temple"). The form
 * only calls EventTempleAdapter.submit(payload); all ET-specific mapping lives
 * here. Field ids/paths below are the REAL schema of the live "Outpost Inquiry
 * Form" (lead_intake_form_setting 2607), captured from the public settings API.
 * Full reference: data/event-temple-form.json.
 *
 * Submit transport (from the ET form's own JS): POST /lead_intakes/create with
 *   { subdomain, leadIntakeFormSettingId,
 *     lead:    { name, start_date, booking_type_id, custom_field_values:{<hash>:val},
 *                lead_origin:{origin, lead_intake_form_setting_id} },
 *     contact: { first_name, last_name, email, phone_number } }
 * (ET renames booking→lead and custom_field→custom_field_values server-side; we
 *  build the post-rename shape directly.)
 *
 * ⚠️ LIVE is false — submit() only logs the exact payload it WOULD send. Per the
 *    brief, prove ONE real test submission first, then flip LIVE = true.
 *    Open question for the integration dev: custom-field picklists — does ET
 *    expect the option TEXT (sent here) or the option id? Validate on the test.
 *
 * payload in:  { contact:{firstName,lastName,email,phone,preferredContact},
 *                venues:[{rank,name,...}], noPreference:Bool,
 *                answers:{eventType,guestCount,guestMidpoint,date:{mode,date,month,timing},
 *                         budget,services:[],eventName,role,howHeard,notes},
 *                meta:{partial,...} }
 *
 * ⚠️ Mapping is intentionally ROUGH (front-end first). Services, flexible-date
 *    preference, ranked venues, and the guest range text are folded into the
 *    notes field since Event Temple has no native field for them. Tighten when
 *    the flow is locked.
 * ========================================================================== */
(function (w) {
  'use strict';

  var LIVE = false;                                   // ← flip to true after one validated test
  var ENDPOINT = 'https://app.eventtemple.com/lead_intakes/create';
  var SUBDOMAIN = '8305de3c3974b90caa58e923a890aa3c';  // form token (acts as "subdomain")
  var FORM_SETTING_ID = 2607;

  // Event Temple "Booking Type" → booking_type_id (from the live form schema).
  var BOOKING_TYPE_ID = {
    'Meeting': 46953, 'Entertainment': 46963, 'Reunion': 46964, 'Corporate': 46955,
    'Holiday Party': 46959, 'Tour': 46957, 'Funeral/Wake': 46960, 'Internal Use': 46958,
    'Social': 46961, 'Prom': 46962, 'Wedding': 46954, 'Sports Group': 46956
  };

  // Custom-field hashes (booking.custom_field.<hash>) from the live form schema.
  var CF = {
    company:          'f77c3ed8ad4ea21c03e53ae8ae0ecc09', // 26110
    secondDate:       'ec01dc3d1ebf5cb0b7db47bb3afedbf5', // 13761
    guestCount:       'cdcc1bbe8413decf6ea062cb36ce1c55', // 26109
    budget:           'e51c94e3a25d7ddeca7414233722d1ba', // 26111
    details:          '57f22b68865368147d5b01db96d28151', // 26233
    role:             'b15f01c8e506d79812880ddf4b1dca39', // 13759
    preferredContact: 'ff1e5f9274852809af1a85f1232acd1c', // 13762
    howHeard:         '5f21ebc086d552c61efa726043d7b89d'  // 13758
  };

  /** Build the (rough) /lead_intakes/create body from our generic payload. */
  function toEventTemplePayload(payload) {
    var c = payload.contact || {}, a = payload.answers || {}, venues = payload.venues || [];
    var date = a.date || {};

    // Everything Event Temple has no field for goes into the notes blob.
    var extra = [];
    if (venues.length) extra.push('Preferred venues: ' + venues.map(function (v) { return v.rank + '. ' + v.name + (v.overCapacity ? ' (over capacity)' : ''); }).join(', '));
    else if (payload.noPreference) extra.push('Preferred venues: No preference');
    if (a.services && a.services.length) extra.push('Services needed: ' + a.services.join(', '));
    if (a.guestCount) extra.push('Guest range: ' + a.guestCount);
    if (date.mode === 'flexible') extra.push('Date: flexible — ' + (date.month || '') + (date.timing ? ' (' + date.timing + ')' : ''));
    var notes = (a.notes || '');
    if (extra.length) notes = extra.join('\n') + (notes ? '\n\n' + notes : '');

    // Flexible date has no exact day — leave start_date empty (noted above).
    var startDate = date.mode === 'exact' ? (date.date || '') : '';

    var customFields = {};
    customFields[CF.guestCount]       = a.guestMidpoint || '';   // ET wants a number
    customFields[CF.budget]           = a.budget || '';
    customFields[CF.details]          = notes;
    customFields[CF.role]             = c.role || a.role || '';
    customFields[CF.preferredContact] = c.preferredContact || '';
    customFields[CF.howHeard]         = a.howHeard || '';

    return {
      subdomain: SUBDOMAIN,
      leadIntakeFormSettingId: FORM_SETTING_ID,
      contact: {
        first_name: c.firstName || '',
        last_name: c.lastName || '',
        email: c.email || '',
        phone_number: c.phone || ''
      },
      lead: {
        name: a.eventName || '',
        start_date: startDate,
        booking_type_id: BOOKING_TYPE_ID[a.eventType] || null,
        custom_field_values: customFields,
        lead_origin: { origin: (w.document && w.document.referrer) || '', lead_intake_form_setting_id: FORM_SETTING_ID }
      }
    };
  }

  w.EventTempleAdapter = {
    toEventTemplePayload: toEventTemplePayload,

    /** @returns {Promise<{ok:boolean, stub?:boolean, error?:string}>} */
    submit: function (payload) {
      var body = toEventTemplePayload(payload);
      var kind = payload.meta && payload.meta.partial ? 'PARTIAL lead' : 'FULL inquiry';

      if (!LIVE) {
        console.group('[EventTempleAdapter] ' + kind + ' (LIVE=false — not sent)');
        console.log('generic payload:', payload);
        console.log('Event Temple body:', body);
        console.groupEnd();
        return Promise.resolve({ ok: true, stub: true });
      }

      // The ET intake form requires the full field set, so a partial (name/email
      // only) would be rejected. Route partial leads to your early-capture sink
      // (CRM/Zapier/webhook) instead of /lead_intakes/create. No-op for now.
      if (payload.meta && payload.meta.partial) {
        console.info('[EventTempleAdapter] partial lead not sent to intake endpoint — wire your early-capture sink here.');
        return Promise.resolve({ ok: true, stub: true });
      }

      return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (r) { return { ok: r.ok, error: r.ok ? undefined : ('HTTP ' + r.status) }; })
        .catch(function (e) { return { ok: false, error: String(e) }; });
    }
  };
})(window);
