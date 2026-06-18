/* ============================================================================
 * POST Venue Rental — Inquiry Form app
 * ----------------------------------------------------------------------------
 * Step-based flow driven by window.POST_INQUIRY_CONFIG + data/venues.json.
 * See USER-FLOW.md. Front-end first; Event Temple mapping (event-temple.js) is
 * intentionally rough for now.
 *
 *   SPACE  (left panel) — rank up to 3 / "No preference" / skip
 *   BUILD  (middle) — Steps: contact → event type → guests → date → budget → details
 *   REVIEW (middle) — full recap, editable, then Submit → success redirect
 *
 * Mounts into [data-pvr-root].
 * ========================================================================== */
(function (w, d) {
  'use strict';

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function init() {
    var root = d.querySelector('[data-pvr-root]');
    if (!root) return;
    var cfg = w.POST_INQUIRY_CONFIG;
    var ET = w.EventTempleAdapter;
    if (!cfg) { console.error('[PVR] POST_INQUIRY_CONFIG missing — load config.js first.'); return; }

    var opt = cfg.options || {};
    var copy = cfg.copy || {};
    var steps = cfg.steps || [];
    var MAX_PICKS = opt.maxPreferredVenues || 3;

    var venues = [];
    var state = {
      view: 'step',          // 'step' | 'review' | 'done'
      stepIndex: 0,
      values: {},            // field id -> value (string | array | {mode,date,month,timing})
      picks: [],             // ranked venue ids
      noPreference: false,
      leadCaptured: false,
      eventNameTouched: false,   // false → auto-fill "{First}'s {EventType}"
      lb: { venue: null, idx: 0 }
    };
    var el = {};
    var noteTimer = null;

    /* ===================== helpers ===================== */
    function esc(s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function fmtNum(n) { return n == null ? '' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
    function findVenue(id) { for (var i = 0; i < venues.length; i++) if (venues[i].id === id) return venues[i]; return null; }
    function currentStep() { return steps[state.stepIndex]; }
    function isMobile() { return w.innerWidth <= 991; }

    function fmtDate(s) {
      var p = String(s).split('-'); if (p.length !== 3) return s;
      return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    // range string -> representative number (midpoint)
    function guestNum() {
      var a = state.values.guestCount;
      if (!a || /not sure/i.test(a)) return 0;
      if (/^under/i.test(a)) { return Math.round((parseInt(a.replace(/[^\d]/g, ''), 10) || 0) / 2); }
      var nums = a.replace(/,/g, '').match(/\d+/g);
      if (!nums) return 0;
      if (a.indexOf('+') > -1) return parseInt(nums[0], 10);
      if (nums.length >= 2) return Math.round((parseInt(nums[0], 10) + parseInt(nums[1], 10)) / 2);
      return parseInt(nums[0], 10);
    }
    function overCapacity(v) { return !!(v && v.maxCapacity != null && guestNum() > v.maxCapacity); }

    // Auto event name, e.g. "Carlie’s Wedding" — used until the user edits it.
    function derivedEventName() {
      var fn = (state.values.firstName || '').trim();
      if (!fn) return '';
      return fn + '’s ' + (state.values.eventType || 'event');
    }

    /* ===================== shell ===================== */
    function buildShell() {
      root.classList.add('pvr');
      root.innerHTML =
        '<h2 class="sr-only">POST Houston event inquiry — rank your preferred spaces and tell us about your event</h2>' +
        '<div class="app">' +

          '<div class="lightbox" data-lb>' +
            '<div class="lb-header">' +
              '<span class="lb-venue-name" data-lb-name></span>' +
              '<div class="lb-actions">' +
                '<button type="button" class="lb-select-btn" data-lb-select>Add to preferred</button>' +
                '<button type="button" class="lb-close" data-lb-close aria-label="Close">×</button>' +
              '</div>' +
            '</div>' +
            '<div class="lb-thumbstrip" data-lb-thumbs></div>' +
            '<div class="lb-main">' +
              '<div class="lb-arrow left" data-lb-prev>‹</div>' +
              '<img class="lb-img" data-lb-img src="" alt="">' +
              '<div class="lb-arrow right" data-lb-next>›</div>' +
            '</div>' +
            '<div class="lb-caption" data-lb-caption></div>' +
            '<div class="lb-details" data-lb-details></div>' +
          '</div>' +

          '<div class="panel-left">' +
            '<div class="panel-header">' + esc(copy.venuePanelTitle || 'Preferred spaces') + '</div>' +
            '<div class="venue-grid" data-venue-grid></div>' +
            '<div class="venue-foot">' +
              '<button type="button" class="no-pref-btn" data-no-pref>' + esc(copy.noPreferenceLabel || 'No preference') + '</button>' +
              '<p>' + esc(copy.venueHelper || '') + '</p>' +
              '<p class="venue-note" data-venue-note hidden></p>' +
            '</div>' +
          '</div>' +

          '<div class="panel-mid" data-panel-mid>' +
            '<div class="progress-row">' +
              '<div class="progress-label" data-progress-label></div>' +
              '<div class="progress-pct" data-progress-pct>0%</div>' +
            '</div>' +
            '<div class="progress-bar-wrap"><div class="progress-bar-fill" data-progress-fill></div></div>' +
            '<div class="q-card" data-card="step"></div>' +
            '<div class="q-card center" data-card="done" hidden>' +
              '<div class="done-check">✓</div>' +
              '<div class="display-lg">' + esc(copy.doneTitle || "You're all set") + '</div>' +
              '<div class="blurb">' + esc(copy.doneBlurb || '') + '</div>' +
              '<button type="button" class="btn-next" data-reset style="margin-top:16px;padding:12px 28px">Start over</button>' +
            '</div>' +
          '</div>' +

          '<div class="panel-right">' +
            '<div class="summary-title">' + esc(copy.summaryTitle || 'Your event summary') + '</div>' +
            '<div data-summary></div>' +
            '<button type="button" class="submit-btn" data-summary-submit disabled>' + esc(copy.submitLabel || 'Submit inquiry →') + '</button>' +
          '</div>' +

          // mobile-only sticky action bar (Back / Next / Submit)
          '<div class="mobile-bar" data-mobilebar></div>' +

        '</div>';

      el.app = root.querySelector('.app');
      el.panelMid = root.querySelector('[data-panel-mid]');
      el.venueGrid = root.querySelector('[data-venue-grid]');
      el.venueNote = root.querySelector('[data-venue-note]');
      el.noPref = root.querySelector('[data-no-pref]');
      el.progLabel = root.querySelector('[data-progress-label]');
      el.progPct = root.querySelector('[data-progress-pct]');
      el.progFill = root.querySelector('[data-progress-fill]');
      el.stepCard = root.querySelector('[data-card="step"]');
      el.doneCard = root.querySelector('[data-card="done"]');
      el.summary = root.querySelector('[data-summary]');
      el.summarySubmit = root.querySelector('[data-summary-submit]');
      el.mobileBar = root.querySelector('[data-mobilebar]');
      el.reset = root.querySelector('[data-reset]');
      el.lb = root.querySelector('[data-lb]');
      el.lbName = root.querySelector('[data-lb-name]');
      el.lbThumbs = root.querySelector('[data-lb-thumbs]');
      el.lbImg = root.querySelector('[data-lb-img]');
      el.lbCaption = root.querySelector('[data-lb-caption]');
      el.lbDetails = root.querySelector('[data-lb-details]');
      el.lbSelect = root.querySelector('[data-lb-select]');
    }

    /* ===================== venues ===================== */
    function loadVenues() {
      var url = cfg.dataSources && cfg.dataSources.venues;
      if (!url) { console.error('[PVR] no venues dataSource'); return; }
      fetch(url)
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (data) { venues = (data && data.venues) || []; buildGrid(); })
        .catch(function (e) {
          el.venueGrid.innerHTML = '<div class="venue-error">Couldn’t load venues. If previewing locally, run a local server (see README) — file:// blocks fetch.</div>';
          console.error('[PVR] venue load failed:', e);
        });
    }

    function buildGrid() {
      el.venueGrid.innerHTML = venues.map(function (v) {
        var cap = v.maxCapacity != null ? 'Up to ' + fmtNum(v.maxCapacity) : 'Flexible';
        return '<div class="venue-card" data-venue="' + esc(v.id) + '">' +
          '<img src="' + esc(v.imgs[0]) + '" alt="' + esc(v.name) + '">' +
          '<span class="venue-rank" data-rank hidden></span>' +
          '<button type="button" class="venue-preview-btn" data-preview="' + esc(v.id) + '">Photos + details</button>' +
          '<span class="venue-count">' + esc(v.sqft) + '</span>' +
          '<div class="venue-label"><span class="venue-name">' + esc(v.name) + '</span>' +
            '<span class="venue-cap">' + esc(cap) + '</span></div>' +
        '</div>';
      }).join('');
      refreshVenueCards();
    }

    function pickRank(id) { var i = state.picks.indexOf(id); return i === -1 ? 0 : i + 1; }

    function togglePick(id) {
      var i = state.picks.indexOf(id);
      if (i !== -1) state.picks.splice(i, 1);
      else if (state.picks.length >= MAX_PICKS) { setVenueNote('You can rank up to ' + MAX_PICKS + '. Remove one to add another.'); return; }
      else { state.picks.push(id); state.noPreference = false; maybeScrollToBuild(); }
      refreshVenueCards();
      updateSummary();
    }
    function setNoPreference() {
      state.noPreference = true;
      state.picks = [];
      refreshVenueCards();
      updateSummary();
      maybeScrollToBuild();
    }
    function moveVenue(index, dir) {
      var j = index + dir; if (j < 0 || j >= state.picks.length) return;
      var t = state.picks[index]; state.picks[index] = state.picks[j]; state.picks[j] = t;
      refreshVenueCards(); updateSummary();
    }
    function removeVenueAt(index) { state.picks.splice(index, 1); refreshVenueCards(); updateSummary(); }

    function refreshVenueCards() {
      var cards = el.venueGrid.querySelectorAll('.venue-card');
      for (var i = 0; i < cards.length; i++) {
        var id = cards[i].getAttribute('data-venue');
        var r = pickRank(id);
        cards[i].classList.toggle('selected', r > 0);
        var badge = cards[i].querySelector('[data-rank]');
        if (badge) { badge.textContent = r > 0 ? r : ''; badge.hidden = r === 0; }
      }
      if (el.noPref) el.noPref.classList.toggle('active', state.noPreference && state.picks.length === 0);
    }
    function setVenueNote(msg) {
      el.venueNote.textContent = msg; el.venueNote.hidden = false;
      clearTimeout(noteTimer); noteTimer = setTimeout(function () { el.venueNote.hidden = true; }, 3000);
    }
    function maybeScrollToBuild() { if (isMobile() && el.panelMid) el.panelMid.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

    /* ===================== venue feature details (lightbox) =============== */
    function featureChips(v) {
      var f = v.features || {}, chips = [];
      if (f.rooftop) chips.push('Rooftop');
      if (f.outdoor) chips.push('Outdoor space' + (f.outdoor === 'partial' ? '*' : ''));
      if (f.pvtBathroom) chips.push('Private bathroom');
      if (f.cateringKitchen) chips.push('Catering kitchen');
      if (f.builtInAV) chips.push('Built-in A/V');
      return chips;
    }
    function vdRow(k, v) { return '<div class="vd-row"><span class="vd-k">' + esc(k) + '</span><span class="vd-v">' + esc(v) + '</span></div>'; }
    function venueDetailsHTML(v) {
      var rows = vdRow('Capacity', v.maxCapacity != null ? 'Up to ' + fmtNum(v.maxCapacity) + ' guests' : 'Flexible / outdoor');
      if (v.seatedDining != null) rows += vdRow('Seated dining', 'Up to ' + fmtNum(v.seatedDining));
      rows += vdRow('Scale', v.scale || '—') + vdRow('Size', v.sqft || '—');
      var chips = featureChips(v);
      var chipHTML = chips.length ? chips.map(function (c) { return '<span class="vd-chip">' + esc(c) + '</span>'; }).join('')
        : '<span class="vd-chip vd-chip-none">No listed amenities</span>';
      var note = overCapacity(v) ? '<div class="vd-note">Heads up — ' + esc(v.name) + ' holds up to ' + fmtNum(v.maxCapacity) + ' guests, under your guest count (~' + fmtNum(guestNum()) + '). Our team can suggest a larger fit.</div>' : '';
      return '<div class="vd"><div class="vd-rows">' + rows + '</div>' +
        '<div class="vd-block"><div class="vd-block-label">Amenities</div><div class="vd-chips">' + chipHTML + '</div></div>' +
        (v.bestFor ? '<div class="vd-block"><div class="vd-block-label">Best for</div><div class="vd-best">' + esc(v.bestFor) + '</div></div>' : '') +
        note + '</div>';
    }

    /* ===================== field rendering ===================== */
    function fieldControl(f) {
      // Auto-fill the event name from First name + event type until edited.
      if (f.id === 'eventName' && !state.eventNameTouched) state.values.eventName = derivedEventName();
      var v = state.values[f.id];
      var id = 'f-' + f.id;
      if (f.type === 'chips' || f.type === 'segmented') {
        var cls = f.type === 'segmented' ? 'seg' : 'q-options';
        return '<div class="' + cls + '">' + (f.options || []).map(function (o) {
          var sel = v === o ? ' selected' : '';
          var btnCls = f.type === 'segmented' ? 'seg-btn' : 'q-opt';
          return '<button type="button" class="' + btnCls + sel + '" data-opt-field="' + esc(f.id) + '" data-opt-kind="single" data-opt-val="' + esc(o) + '">' + esc(o) + '</button>';
        }).join('') + '</div>';
      }
      if (f.type === 'multiselect') {
        var arr = Array.isArray(v) ? v : [];
        return '<div class="q-options">' + (f.options || []).map(function (o) {
          return '<button type="button" class="q-opt' + (arr.indexOf(o) > -1 ? ' selected' : '') + '" data-opt-field="' + esc(f.id) + '" data-opt-kind="multi" data-opt-val="' + esc(o) + '">' + esc(o) + '</button>';
        }).join('') + '</div>';
      }
      if (f.type === 'select') {
        return '<select class="q-input q-select" id="' + id + '" data-field="' + esc(f.id) + '">' +
          '<option value="">Select…</option>' +
          (f.options || []).map(function (o) { return '<option' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') +
        '</select>';
      }
      if (f.type === 'textarea') {
        return '<textarea class="q-input q-textarea" id="' + id + '" rows="4" data-field="' + esc(f.id) + '" placeholder="' + esc(f.placeholder || '') + '">' + esc(v || '') + '</textarea>';
      }
      if (f.type === 'datemode') return dateModeControl(f);
      // text | email | tel | number
      return '<input class="q-input" id="' + id + '" type="' + esc(f.type) + '" data-field="' + esc(f.id) + '" placeholder="' + esc(f.placeholder || '') + '" value="' + esc(v || '') + '">';
    }

    function dateModeControl(f) {
      var v = state.values[f.id] || {};
      var html = '<div class="seg datemode-seg">' +
        '<button type="button" class="seg-btn' + (v.mode === 'exact' ? ' selected' : '') + '" data-dm-field="' + esc(f.id) + '" data-dm-mode="exact">I have a date in mind</button>' +
        '<button type="button" class="seg-btn' + (v.mode === 'flexible' ? ' selected' : '') + '" data-dm-field="' + esc(f.id) + '" data-dm-mode="flexible">I’m flexible</button>' +
      '</div>';
      if (v.mode === 'exact') {
        html += '<div class="dm-panel"><label class="field-label">Pick a date</label>' +
          '<input class="q-input" type="date" data-field="' + esc(f.id) + '" data-sub="date" value="' + esc(v.date || '') + '"></div>';
      } else if (v.mode === 'flexible') {
        html += '<div class="dm-panel dm-flex">' +
          '<div><label class="field-label">Preferred month</label>' +
            '<select class="q-input q-select" data-field="' + esc(f.id) + '" data-sub="month"><option value="">Select…</option>' +
            MONTHS.map(function (m) { return '<option' + (v.month === m ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select></div>' +
          '<div><label class="field-label">Timing</label>' +
            '<select class="q-input q-select" data-field="' + esc(f.id) + '" data-sub="timing"><option value="">Any</option>' +
            ['Early', 'Mid', 'Late'].map(function (t) { return '<option' + (v.timing === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>' +
        '</div>';
      }
      return html;
    }

    function fieldBlock(f) {
      var label = f.label ? '<label class="field-label">' + esc(f.label) + '</label>' : '';
      var prompt = f.text ? '<div class="q-text">' + esc(f.text) + '</div>' : '';
      return '<div class="field-block">' + prompt + label + fieldControl(f) + '</div>';
    }

    /* ===================== step rendering ===================== */
    function renderStep() {
      state.view = 'step';
      showView();
      var step = currentStep(), n = steps.length;
      var isFirst = state.stepIndex === 0;
      var isLast = state.stepIndex === n - 1;

      var dots = steps.map(function (_, i) {
        return '<div class="step-dot ' + (i < state.stepIndex ? 'done' : i === state.stepIndex ? 'active' : '') + '"></div>';
      }).join('');

      var hero = isFirst
        ? '<div class="q-text">' + esc(copy.heroTitle || step.title) + '</div>' +
          '<div class="blurb" style="margin-bottom:18px">' + esc(copy.heroBlurb || step.intro || '') + '</div>'
        : '';

      el.stepCard.classList.remove('center');
      el.stepCard.innerHTML =
        '<div class="step-head">' +
          '<div class="progress-label">' + esc(step.title || ('Step ' + (state.stepIndex + 1))) + ' · ' + (state.stepIndex + 1) + ' of ' + n + '</div>' +
          '<div class="step-indicator">' + dots + '</div>' +
        '</div>' +
        hero +
        '<div class="q-fields">' + step.fields.map(fieldBlock).join('') + '</div>' +
        '<div class="nav-row">' +
          (isFirst ? '' : '<button type="button" class="btn-back" data-back>← Back</button>') +
          (isLast
            ? '<span class="nav-hint">Review your summary →</span>'
            : '<button type="button" class="btn-next" data-next' + (stepValid(step) ? '' : ' disabled') + '>' + esc(isFirst && step.cta ? step.cta : 'Continue') + '</button>') +
        '</div>';

      updateSummary();   // also refreshes progress + submit + mobile bar
    }

    function refreshNext() {
      var b = el.stepCard.querySelector('[data-next]');
      if (b) b.disabled = !stepValid(currentStep());
    }

    /* ===================== values + validation ===================== */
    function isEmail(v) { return !!v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).trim()); }
    function fieldHasValue(f, v) {
      if (f.type === 'multiselect') return Array.isArray(v) && v.length > 0;
      if (f.type === 'datemode') return !!v && (v.mode === 'exact' ? !!v.date : v.mode === 'flexible' ? !!v.month : false);
      if (f.type === 'email') return isEmail(v);
      return !!(v != null && String(v).trim());
    }
    function fieldValid(f) { return f.required === false || fieldHasValue(f, state.values[f.id]); }
    function stepValid(step) { return step.fields.every(fieldValid); }
    function allStepsValid() { return steps.every(stepValid); }

    function handleOpt(fieldId, val, kind) {
      if (kind === 'multi') {
        var arr = Array.isArray(state.values[fieldId]) ? state.values[fieldId].slice() : [];
        var i = arr.indexOf(val); if (i > -1) arr.splice(i, 1); else arr.push(val);
        state.values[fieldId] = arr;
      } else {
        state.values[fieldId] = val;
      }
      renderStep();      // re-render clears stale chips + reflects selection
    }
    function setDateMode(fieldId, mode) {
      var o = state.values[fieldId] || {}; o.mode = mode; state.values[fieldId] = o;
      renderStep();
    }
    function onStepInput(e) {
      var t = e.target, id = t.getAttribute('data-field'); if (!id) return;
      var sub = t.getAttribute('data-sub');
      if (sub) { var o = state.values[id] || {}; o[sub] = t.value; state.values[id] = o; }
      else { state.values[id] = t.value; }
      if (id === 'eventName') state.eventNameTouched = true;   // stop auto-fill once edited
      maybeCaptureLead();
      refreshNext();
      updateSummary();
    }

    function maybeCaptureLead() {
      var v = state.values;
      if (opt.captureLeadEarly && !state.leadCaptured && v.firstName && v.lastName && isEmail(v.email)) {
        state.leadCaptured = true;
        ET.submit(buildPayload(true));
      }
    }

    /* ===================== nav ===================== */
    function nextStep() {
      if (!stepValid(currentStep())) return;
      maybeCaptureLead();
      if (state.stepIndex >= steps.length - 1) return;   // last step: submit lives in summary / mobile bar
      state.stepIndex++; renderStep();
    }
    function prevStep() { if (state.stepIndex > 0) { state.stepIndex--; renderStep(); } }

    function gotoStep(stepId) {
      for (var i = 0; i < steps.length; i++) if (steps[i].id === stepId) { state.stepIndex = i; state.view = 'step'; renderStep(); return; }
    }

    /* ===================== submit ===================== */
    function buildPayload(partial) {
      var v = state.values;
      return {
        contact: { firstName: v.firstName || '', lastName: v.lastName || '', email: v.email || '', phone: v.phone || '', preferredContact: v.preferredContact || '' },
        venues: state.picks.map(function (id, i) { var vv = findVenue(id); return { rank: i + 1, id: vv.id, name: vv.name, maxCapacity: vv.maxCapacity, overCapacity: overCapacity(vv) }; }),
        noPreference: state.noPreference || state.picks.length === 0,
        answers: {
          eventType: v.eventType || '', guestCount: v.guestCount || '', guestMidpoint: guestNum() || '',
          date: v.eventDate || null, budget: v.budget || '', services: v.services || [],
          eventName: v.eventName || '', role: v.role || '', howHeard: v.howHeard || '', notes: v.notes || ''
        },
        meta: { partial: !!partial, submittedAt: new Date().toISOString(), source: 'venuerental' }
      };
    }

    function submitInquiry() {
      if (!allStepsValid()) return;
      el.summarySubmit.disabled = true;
      Promise.resolve(ET.submit(buildPayload(false))).then(function (res) {
        if (res && res.ok) {
          if (res.stub) { state.view = 'done'; showView(); updateSummary(); }   // preview: don't navigate away
          else if (cfg.successUrl) { (w.top || w).location.href = cfg.successUrl; }
          else { state.view = 'done'; showView(); updateSummary(); }
        } else {
          el.summarySubmit.disabled = false;
          console.error('[PVR] submit failed:', res && res.error);
          alert('Something went wrong submitting your inquiry. Please try again.');
        }
      });
    }

    /* ===================== summary / recap ===================== */
    function displayValue(f, v) {
      if (v == null) return '';
      if (Array.isArray(v)) return v.join(', ');
      if (typeof v === 'object') {
        if (v.mode === 'exact') return v.date ? fmtDate(v.date) : '';
        if (v.mode === 'flexible') return v.month ? (v.month + (v.timing ? ' (' + v.timing + ')' : '') + ' — flexible') : '';
        return '';
      }
      return String(v);
    }
    function editLink(stepId, editable) { return editable ? '<button type="button" class="summary-edit" data-edit="' + esc(stepId) + '">Edit</button>' : ''; }
    function line(k, val, stepId, editable) {
      return '<div class="summary-line"><div class="summary-key">' + esc(k) + editLink(stepId, editable) + '</div>' +
        '<div class="summary-val">' + esc(val) + '</div></div>';
    }

    function venueSummaryHTML(editable) {
      if (state.picks.length) {
        var rows = state.picks.map(function (id, i) {
          var v = findVenue(id);
          var warn = overCapacity(v) ? '<span class="summary-warn" title="Under your guest count">⚠</span>' : '';
          var ctrls = editable ? '<span class="venue-ctrls">' +
            '<button type="button" class="vctrl" data-v-up="' + i + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="vctrl" data-v-down="' + i + '"' + (i === state.picks.length - 1 ? ' disabled' : '') + '>↓</button>' +
            '<button type="button" class="vctrl vctrl-x" data-v-remove="' + i + '">×</button></span>' : '';
          return '<div class="summary-venue"><span class="summary-rank">' + (i + 1) + '</span>' +
            '<span class="summary-venue-name">' + esc(v.name) + warn + '</span>' + ctrls + '</div>';
        }).join('');
        var note = '';
        var over = state.picks.map(findVenue).filter(overCapacity);
        if (over.length) note = '<div class="summary-note">' + over.map(function (v) { return esc(v.name) + ' holds ≤' + fmtNum(v.maxCapacity); }).join('; ') + ' — under your guest count. Our team can recommend a larger space.</div>';
        return '<div class="summary-line"><div class="summary-key">Preferred venues</div><div class="summary-venues">' + rows + '</div></div>' + note;
      }
      if (state.noPreference) return line('Venue', 'No preference', null, false);
      return '';
    }

    function buildRecap(editable) {
      var v = state.values, html = '';
      var name = [v.firstName, v.lastName].filter(Boolean).join(' ');
      if (name) html += line('Name', name, 'contact', editable);
      if (v.email) html += line('Email', v.email, 'contact', editable);
      if (v.phone) html += line('Phone', v.phone, 'contact', editable);
      if (v.preferredContact) html += line('Preferred contact', v.preferredContact, 'contact', editable);

      html += venueSummaryHTML(editable);

      steps.forEach(function (step) {
        if (step.id === 'contact') return;
        step.fields.forEach(function (f) {
          if (!fieldHasValue(f, v[f.id])) return;
          html += line(f.label || step.title, displayValue(f, v[f.id]), step.id, editable);
        });
      });
      return html || '<div class="summary-empty">' + esc(copy.summaryEmpty || '') + '</div>';
    }

    function updateSummary() {
      var done = state.view === 'done';
      el.summary.innerHTML = buildRecap(!done);

      // Persistent submit (desktop, bottom of summary): grayed until complete.
      var ready = allStepsValid();
      el.summarySubmit.style.display = done ? 'none' : '';
      el.summarySubmit.disabled = !ready;

      refreshProgress();
      updateMobileBar();
    }

    function refreshProgress() {
      if (state.view === 'done') return setProgress(100, 'Inquiry submitted');
      if (allStepsValid()) return setProgress(100, 'Ready to submit');
      setProgress(Math.round((state.stepIndex / steps.length) * 100), currentStep().title || ('Step ' + (state.stepIndex + 1)));
    }

    // Mobile-only sticky bar: Back / Continue, swapping to Submit when ready.
    function updateMobileBar() {
      if (state.view === 'done') { el.mobileBar.innerHTML = ''; return; }
      var ready = allStepsValid();
      var isLast = state.stepIndex === steps.length - 1;
      var html = '';
      if (state.stepIndex > 0) html += '<button type="button" class="mb-back" data-mb-back>← Back</button>';
      if (ready) html += '<button type="button" class="mb-submit" data-mb-submit>' + esc(copy.submitLabel || 'Submit inquiry →') + '</button>';
      else if (!isLast) html += '<button type="button" class="mb-next" data-mb-next' + (stepValid(currentStep()) ? '' : ' disabled') + '>Continue →</button>';
      else html += '<button type="button" class="mb-submit" data-mb-submit disabled>' + esc(copy.submitLabel || 'Submit inquiry →') + '</button>';
      el.mobileBar.innerHTML = html;
    }

    function onRecapClick(e) {
      var up = e.target.closest('[data-v-up]'); if (up) return moveVenue(+up.getAttribute('data-v-up'), -1);
      var dn = e.target.closest('[data-v-down]'); if (dn) return moveVenue(+dn.getAttribute('data-v-down'), 1);
      var rm = e.target.closest('[data-v-remove]'); if (rm) return removeVenueAt(+rm.getAttribute('data-v-remove'));
      var ed = e.target.closest('[data-edit]'); if (ed) return gotoStep(ed.getAttribute('data-edit'));
    }

    /* ===================== view + progress ===================== */
    function showView() {
      el.stepCard.hidden = state.view !== 'step';
      el.doneCard.hidden = state.view !== 'done';
    }
    function setProgress(pct, label) {
      el.progFill.style.width = pct + '%';
      el.progPct.textContent = pct + '%';
      if (label != null) el.progLabel.textContent = label;
    }
    function resetAll() {
      state.view = 'step'; state.stepIndex = 0; state.values = {}; state.picks = []; state.noPreference = false; state.leadCaptured = false; state.eventNameTouched = false;
      refreshVenueCards();
      showView();
      renderStep();
    }

    /* ===================== lightbox ===================== */
    function openLightbox(id) {
      state.lb.venue = findVenue(id); state.lb.idx = 0;
      el.lbName.textContent = state.lb.venue.name;
      el.lbDetails.innerHTML = venueDetailsHTML(state.lb.venue);
      syncLbSelectBtn(); renderLightbox();
      el.lb.classList.add('open');
    }
    function closeLightbox() { el.lb.classList.remove('open'); }
    function syncLbSelectBtn() {
      var r = pickRank(state.lb.venue.id);
      el.lbSelect.textContent = r > 0 ? '✓ Preferred #' + r : 'Add to preferred';
      el.lbSelect.classList.toggle('is-selected', r > 0);
    }
    function renderLightbox() {
      var imgs = state.lb.venue.imgs;
      el.lbImg.src = imgs[state.lb.idx];
      el.lbCaption.textContent = state.lb.venue.name + ' · ' + (state.lb.idx + 1) + ' of ' + imgs.length;
      el.lbThumbs.innerHTML = imgs.map(function (src, i) {
        return '<img class="lb-thumb' + (i === state.lb.idx ? ' active' : '') + '" src="' + esc(src) + '" data-thumb="' + i + '" alt="">';
      }).join('');
    }
    function lbNav(dir) { var n = state.lb.venue.imgs.length; state.lb.idx = (state.lb.idx + dir + n) % n; renderLightbox(); }

    /* ===================== events ===================== */
    function bind() {
      el.venueGrid.addEventListener('click', function (e) {
        var prev = e.target.closest('[data-preview]');
        if (prev) { e.stopPropagation(); openLightbox(prev.getAttribute('data-preview')); return; }
        var card = e.target.closest('[data-venue]');
        if (card) togglePick(card.getAttribute('data-venue'));
      });
      el.noPref.addEventListener('click', setNoPreference);

      // step card (delegated)
      el.stepCard.addEventListener('click', function (e) {
        if (e.target.closest('[data-next]')) return nextStep();
        if (e.target.closest('[data-back]')) return prevStep();
        var dm = e.target.closest('[data-dm-mode]'); if (dm) return setDateMode(dm.getAttribute('data-dm-field'), dm.getAttribute('data-dm-mode'));
        var opt2 = e.target.closest('[data-opt-field]'); if (opt2) return handleOpt(opt2.getAttribute('data-opt-field'), opt2.getAttribute('data-opt-val'), opt2.getAttribute('data-opt-kind'));
      });
      el.stepCard.addEventListener('input', onStepInput);
      el.stepCard.addEventListener('change', onStepInput);

      // summary panel: edit / venue controls + persistent submit
      el.summary.addEventListener('click', onRecapClick);
      el.summarySubmit.addEventListener('click', submitInquiry);

      // mobile sticky bar
      el.mobileBar.addEventListener('click', function (e) {
        if (e.target.closest('[data-mb-back]')) return prevStep();
        if (e.target.closest('[data-mb-next]')) return nextStep();
        if (e.target.closest('[data-mb-submit]')) return submitInquiry();
      });

      el.reset.addEventListener('click', resetAll);

      el.lb.addEventListener('click', function (e) {
        if (e.target.closest('[data-lb-close]')) return closeLightbox();
        if (e.target.closest('[data-lb-prev]')) return lbNav(-1);
        if (e.target.closest('[data-lb-next]')) return lbNav(1);
        var t = e.target.closest('[data-thumb]');
        if (t) { state.lb.idx = +t.getAttribute('data-thumb'); return renderLightbox(); }
        if (e.target.closest('[data-lb-select]')) { togglePick(state.lb.venue.id); syncLbSelectBtn(); }
      });
      d.addEventListener('keydown', function (e) {
        if (!el.lb.classList.contains('open')) return;
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') lbNav(-1);
        else if (e.key === 'ArrowRight') lbNav(1);
      });
    }

    /* ===================== boot ===================== */
    buildShell();
    bind();
    renderStep();
    loadVenues();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', init);
  else init();
})(window, document);
