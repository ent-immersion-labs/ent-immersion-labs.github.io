(function () {
  const cfg         = ADMIN_CONFIG;
  const listEl      = document.getElementById('date-list');
  const form        = document.getElementById('booking-form');
  const submitBtn   = document.getElementById('submit-btn');
  const successText = document.getElementById('success-text');
  const continueBar = document.getElementById('continue-bar');
  const continueLbl = document.getElementById('continue-label');

  let selectedDate = null;
  let copyText     = '';

  // ── Helpers ───────────────────────────────────────────────────────
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function parts(dtStr) {
    const [y, m, d] = dtStr.slice(0, 10).split('-').map(Number);
    return { y, m, d, date: new Date(y, m - 1, d) };
  }
  function formatDate(dtStr) {
    const { y, m, d, date } = parts(dtStr);
    return `${DAYS[date.getDay()].slice(0, 3)}, ${SHORT_MONTHS[m-1]} ${d}, ${y}`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }
  function setStep(step) {
    document.body.dataset.step = step;
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  // ── Fetch available dates from TeamUp ─────────────────────────────
  async function loadDates() {
    // ?demo=1 renders sample dates without hitting TeamUp (for local preview)
    if (new URLSearchParams(location.search).has('demo')) {
      const y = new Date().getFullYear();
      return renderDates([
        { id: 'd1', start_dt: `${y}-10-06`, end_dt: `${y}-10-06`, subcalendar_ids: [] },
        { id: 'd2', start_dt: `${y}-10-15`, end_dt: `${y}-10-15`, subcalendar_ids: [] },
        { id: 'd3', start_dt: `${y}-10-21`, end_dt: `${y}-10-21`, subcalendar_ids: [] },
        { id: 'd4', start_dt: `${y}-11-03`, end_dt: `${y}-11-03`, subcalendar_ids: [] },
        { id: 'd5', start_dt: `${y}-11-12`, end_dt: `${y}-11-12`, subcalendar_ids: [] },
        { id: 'd6', start_dt: `${y}-12-02`, end_dt: `${y}-12-02`, subcalendar_ids: [] },
      ]);
    }

    const today = new Date();
    const start = today.toISOString().slice(0, 10);
    const end   = new Date(today.getFullYear(), today.getMonth() + 6, today.getDate()).toISOString().slice(0, 10);

    let events = [];
    try {
      const res = await fetch(
        `https://api.teamup.com/${cfg.teamupCalendarKey}/events?startDate=${start}&endDate=${end}`,
        { headers: { 'Teamup-Token': cfg.teamupApiToken } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      events = (data.events || []).filter(e => e.title.trim().toLowerCase() === cfg.openEventTitle);
      events.sort((a, b) => a.start_dt.localeCompare(b.start_dt));
    } catch (err) {
      console.error('Failed to load dates from TeamUp:', err);
      listEl.innerHTML = '<div class="no-dates">Unable to load available dates. Please try refreshing the page or contact your manager.</div>';
      return;
    }
    renderDates(events);
  }

  // ── Copy text (grouped by month like "January 20, 22, 29") ────────
  function buildCopyText(events) {
    const groups = {}, order = [];
    events.forEach(evt => {
      const { y, m, d } = parts(evt.start_dt);
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!groups[key]) { groups[key] = { month: MONTHS[m-1], days: [] }; order.push(key); }
      groups[key].days.push(d);
    });
    return order.map(k => `${groups[k].month} ${groups[k].days.join(', ')}`).join('\n');
  }

  // ── Render date options ───────────────────────────────────────────
  function renderDates(events) {
    listEl.innerHTML = '';
    document.getElementById('date-count').textContent = events.length ? `${events.length} open` : '';

    if (events.length === 0) {
      listEl.innerHTML = '<div class="no-dates">No dates are currently available. Please check back soon or contact your manager.</div>';
      return;
    }

    const groups = {}, monthOrder = [];
    events.forEach((evt, i) => {
      const { y, m } = parts(evt.start_dt);
      const key = `${y}-${String(m).padStart(2, '0')}`;
      if (!groups[key]) { groups[key] = { label: `${MONTHS[m-1]} ${y}`, events: [] }; monthOrder.push(key); }
      groups[key].events.push({ evt, i });
    });

    monthOrder.forEach(key => {
      const hdr = document.createElement('div');
      hdr.className = 'month-header';
      hdr.textContent = groups[key].label;
      listEl.appendChild(hdr);

      groups[key].events.forEach(({ evt, i }) => {
        const { y, m, d, date } = parts(evt.start_dt);
        const dateLabel = formatDate(evt.start_dt);
        const location  = evt.location ? evt.location.trim() : '';
        const label     = location ? `${dateLabel} — ${location}` : dateLabel;
        const dow       = DAYS[date.getDay()];
        const id        = 'date-' + i;

        const el = document.createElement('label');
        el.className = 'date-option';
        el.htmlFor = id;
        el.innerHTML = `
          <input type="radio" name="lab-date" id="${id}" value="${escapeHtml(evt.id)}" />
          <div class="date-cal"><span class="dow">${dow.slice(0, 3)}</span><span class="day">${d}</span></div>
          <div class="date-rule"></div>
          <div class="date-body">
            <span class="date-text">${dow}, ${MONTHS[m-1]} ${d}</span>
            <span class="date-sub">${escapeHtml(location || 'Full day · Jacksonville, FL')}</span>
          </div>
          <div class="check-mark">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>`;

        el.addEventListener('click', () => {
          document.querySelectorAll('.date-option').forEach(o => o.classList.remove('selected'));
          el.classList.add('selected');
          selectedDate = { eventId: evt.id, label, date: evt.start_dt.slice(0, 10), _evt: evt,
                           dow: dow.slice(0, 3), day: d, long: `${dow}, ${MONTHS[m-1]} ${d}, ${y}` };
          continueLbl.textContent = `Continue with ${SHORT_MONTHS[m-1]} ${d}`;
          continueBar.hidden = false;
          submitBtn.disabled = false;
        });
        listEl.appendChild(el);
      });
    });

    copyText = buildCopyText(events);
    document.getElementById('btn-copy').hidden = false;
  }

  // ── Copy dates ────────────────────────────────────────────────────
  document.getElementById('btn-copy').addEventListener('click', () => {
    const btn = document.getElementById('btn-copy'), label = document.getElementById('copy-label');
    const done = () => {
      btn.classList.add('copied'); label.textContent = 'Copied';
      setTimeout(() => { btn.classList.remove('copied'); label.textContent = 'Copy dates'; }, 2000);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(copyText).then(done).catch(done); else done();
  });

  // ── Step navigation ───────────────────────────────────────────────
  document.getElementById('btn-continue').addEventListener('click', () => {
    if (!selectedDate) return;
    document.getElementById('banner-dow').textContent = selectedDate.dow;
    document.getElementById('banner-day').textContent = selectedDate.day;
    document.getElementById('banner-date-text').textContent = selectedDate.long;
    const loc = selectedDate._evt.location ? selectedDate._evt.location.trim() : '';
    document.getElementById('banner-location').textContent = loc || 'Full day · Jacksonville, FL';
    setStep('details');
  });
  document.getElementById('btn-back').addEventListener('click', () => setStep('dates'));
  document.getElementById('selected-date-banner').addEventListener('click', () => setStep('dates'));
  document.getElementById('btn-again').addEventListener('click', () => location.reload());

  // ── Inline validation helpers ────────────────────────────────────
  function setError(inputId, errId, show) {
    document.getElementById(inputId).classList.toggle('error', show);
    document.getElementById(errId).classList.toggle('visible', show);
  }
  const errMap = { 'rep-name': 'err-name', 'rep-email': 'err-email', 'rep-territory': 'err-territory', 'rep-account-number': 'err-account-number' };
  Object.keys(errMap).forEach(id => {
    document.getElementById(id).addEventListener('input', () => setError(id, errMap[id], false));
  });
  const productBoxes     = () => [...document.querySelectorAll('input[name="product"]')];
  const selectedProducts = () => productBoxes().filter(cb => cb.checked).map(cb => cb.value);
  document.getElementById('rep-product-focus').addEventListener('change', () => {
    if (selectedProducts().length) setError('rep-product-focus', 'err-product', false);
  });

  // ── Form submission ──────────────────────────────────────────────
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name         = document.getElementById('rep-name').value.trim();
    const email        = document.getElementById('rep-email').value.trim();
    const territory    = document.getElementById('rep-territory').value.trim();
    const surgeon      = document.getElementById('rep-surgeon').value.split('\n').map(l => l.trim()).filter(Boolean).join(', ');
    const account      = document.getElementById('rep-account').value.trim();
    const accountNum   = document.getElementById('rep-account-number').value.trim();
    const products     = selectedProducts();
    const productFocus = products.join(', ');
    const notes        = document.getElementById('rep-notes').value.trim();

    if (!selectedDate) { setStep('dates'); return; }
    const emailOk = !!email && /\S+@\S+\.\S+/.test(email);
    setError('rep-name',           'err-name',           !name);
    setError('rep-email',          'err-email',          !emailOk);
    setError('rep-territory',      'err-territory',      !territory);
    setError('rep-account-number', 'err-account-number', !accountNum);
    setError('rep-product-focus',  'err-product',        !productFocus);
    if (!name || !emailOk || !territory || !accountNum || !productFocus) {
      const first = document.querySelector('.error, .field-error.visible');
      if (first) window.scrollTo({ top: first.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    document.getElementById('btn-label').textContent = 'Submitting…';

    // ── 1. Update the existing TeamUp event ───────────────────────────
    let calendarUpdated = false;
    try {
      const evt        = selectedDate._evt;
      const eventTitle = `ENT Immersion Lab – Booked: ${name} (${territory})`;
      const eventNotes =
        `Rep: ${name}\nEmail: ${email}\nDistrict: ${territory}\n` +
        `HCP(s): ${surgeon || '—'}\nAccount: ${account || '—'}\nAccount #: ${accountNum}\n` +
        `Product Focus: ${productFocus}\n\nNotes: ${notes || 'None'}`;

      const response = await fetch(`https://api.teamup.com/${cfg.teamupCalendarKey}/events/${evt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Teamup-Token': cfg.teamupApiToken },
        body: JSON.stringify({
          id: evt.id, subcalendar_ids: evt.subcalendar_ids,
          start_dt: evt.start_dt.slice(0, 10), end_dt: evt.end_dt.slice(0, 10),
          all_day: true, title: eventTitle, notes: eventNotes
        })
      });
      if (response.ok) calendarUpdated = true;
      else console.error('TeamUp API error:', response.status, await response.json().catch(() => ({})));
    } catch (err) {
      console.error('TeamUp API fetch error:', err);
    }

    // ── 2. Success screen ─────────────────────────────────────────────
    window.onbeforeunload = null;
    successText.innerHTML =
      `Thanks, <strong>${escapeHtml(name)}</strong>. Your request for <strong>${escapeHtml(selectedDate.label)}</strong> ` +
      `has been submitted. The Med Ed team will be in touch within 1–2 business days to confirm your booking.`;

    const rows = [
      ['Date', selectedDate.label], ['Name', name], ['Email', email], ['District', territory],
      surgeon ? ['HCP(s)', surgeon] : null, account ? ['Account', account] : null,
      ['Account #', accountNum], ['Product focus', productFocus], notes ? ['Notes', notes] : null,
    ].filter(Boolean);
    document.getElementById('success-details').innerHTML = rows
      .map(([l, v]) => `<div class="detail-row"><span class="detail-label">${l}</span><span>${escapeHtml(v)}</span></div>`)
      .join('');

    document.getElementById('cal-warning').hidden = calendarUpdated;
    setStep('success');
  });

  // ── Warn before leaving with unsaved work ────────────────────────
  function formHasData() {
    if (selectedDate) return true;
    return ['rep-name','rep-email','rep-territory','rep-surgeon','rep-account','rep-account-number','rep-notes']
      .some(id => document.getElementById(id).value.trim() !== '') || selectedProducts().length > 0;
  }
  window.addEventListener('beforeunload', function (e) {
    if (document.body.dataset.step !== 'success' && formHasData()) { e.preventDefault(); e.returnValue = ''; }
  });

  loadDates();
})();
