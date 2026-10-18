/* PAINPRINT – Safety, Privacy & data control, Settings, About, and the 5-step onboarding.
 * All texts are written for worldwide use: no country is assumed and no single emergency number is shown. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.store, X = PP.exchange;
  const { $, $$, esc, icon, modal, toast, emit, download } = PP.ui;

  const TEXT = {
    disclaimer: 'PAINPRINT is designed to help you document and communicate your symptoms. It does not provide medical diagnoses, treatment recommendations, or emergency monitoring and is not a substitute for professional medical care.',
    worsening: 'Contact a qualified healthcare professional if your symptoms are new, persistent, worsening, or affecting your daily activities.',
    emergency: 'If you experience symptoms that may indicate a medical emergency, seek immediate medical assistance. Contact your local emergency services.',
    demo: 'This demonstration version uses fictional data only. Do not enter real personal health information.',
    report: 'This report contains patient-reported information and is not a medical diagnosis or clinical assessment.',
  };
  const WARNING_SIGNS = [
    'Severe difficulty breathing',
    'Signs of stroke – for example sudden face drooping, arm or leg weakness, or difficulty speaking',
    'Severe chest pain',
    'Sudden severe headache',
    'Sudden loss of consciousness',
    'Severe uncontrolled bleeding',
    'New severe neurological symptoms – for example sudden confusion, vision loss or paralysis',
  ];

  let section = 'safety';

  // ---------- sections ----------
  function safetyHTML() {
    return `
      <div class="card notice warn"><h3>${icon('shield')} In an emergency</h3><p><b>${esc(TEXT.emergency)}</b></p>
        <p class="muted">Emergency telephone numbers differ between countries and regions. Use the number that applies where you are right now – PAINPRINT does not show a single number because none is valid everywhere.</p></div>
      <div class="card"><h3>Possible warning signs</h3>
        <p class="muted">General educational information. Seek immediate help if you experience, for example:</p>
        <ul class="bullets">${WARNING_SIGNS.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>
        <p class="muted"><b>This list is not complete.</b> If you are worried about a symptom, seek medical help – do not wait to log it here first.</p></div>
      <div class="card"><h3>When to contact a healthcare professional</h3><p>${esc(TEXT.worsening)}</p></div>
      <div class="card"><h3>What PAINPRINT is – and is not</h3><p>${esc(TEXT.disclaimer)}</p>
        <ul class="bullets">
          <li>It never diagnoses conditions or says a symptom is harmless.</li>
          <li>It never recommends starting, stopping or changing medication.</li>
          <li>It does not triage, monitor or alert anyone.</li>
          <li>Colors on the body map are visual aids for the pain level you choose – not a measure of urgency.</li>
          <li>Triggers you select are things <i>you noticed</i>; PAINPRINT never says they caused your symptoms.</li>
        </ul></div>`;
  }

  function storageStats() {
    let bytes = 0;
    try { bytes = (localStorage.getItem('painprint.v1') || '').length * 2; } catch (e) { /* ignore */ }
    return { entries: S.data.entries.length, checkins: S.data.checkins.length, kb: Math.max(1, Math.round(bytes / 1024)) };
  }
  function privacyHTML() {
    const st = storageStats();
    return `
      <div class="card notice"><h3>${icon('lock')} Demonstration version</h3><p><b>${esc(TEXT.demo)}</b></p></div>
      <div class="card"><h3>Data storage</h3>
        <p>Everything you enter is stored <b>only in this web browser on this device</b> (browser local storage). There is no account and no PAINPRINT server.</p>
        <p class="muted">Browser storage is <b>not encrypted</b> and is not a secure place for real medical records. Anyone with access to this browser profile can read it. Clearing your browser data will delete it.</p>
        <div class="stat-row"><div class="stat"><b>${st.entries}</b><small>entries</small></div><div class="stat"><b>${st.checkins}</b><small>check-ins</small></div><div class="stat"><b>${st.kb} KB</b><small>stored here</small></div></div></div>
      <div class="card"><h3>Data collection</h3><p>PAINPRINT records only what you enter:</p>
        <ul class="bullets"><li>Body markings (coordinates linked to body regions) and pain levels</li><li>Symptoms, sensations, duration, pattern, possible triggers and daily-life impact</li>
        <li>Dates and times of entries, with your device's time zone</li><li>Daily check-ins, notes, and optional details you add for the report</li><li>Display settings (date format, opacity)</li></ul>
        <p class="muted">No location tracking. Your country is never inferred from your device language.</p></div>
      <div class="card"><h3>Data sharing</h3>
        <p>PAINPRINT <b>does not transmit your entries anywhere</b>: no analytics, no advertising trackers, no cookies, no automatic uploads. Reports are only created on your device and only shared if you choose to.</p>
        <p class="muted">The app's files are served by GitHub Pages. Like any web host it may log standard technical request data (such as IP address) when the page loads – your health entries are never part of that.</p></div>
      <div class="card"><h3>Export your data</h3><div class="btn-col">
        <button class="btn" data-act="export">Export entries (JSON)</button>
        <button class="btn" data-act="backup">Download full backup (JSON)</button>
        <button class="btn" data-act="report">Create PDF report</button>
        <button class="btn" data-act="import">Import entries / backup</button></div></div>
      <div class="card"><h3>Delete your data</h3><p class="muted">Deletes all entries, drawings, check-ins and settings from this browser. This cannot be undone.</p>
        <button class="btn danger" data-act="reset">Delete all data on this device</button></div>
      <div class="card"><h3>Privacy laws</h3>
        <p class="muted">Health information is sensitive personal data. Depending on who operates a service and where its users are, laws such as the GDPR (EU/EEA), UK GDPR, HIPAA (USA, where applicable), LGPD (Brazil), PIPEDA (Canada), the Privacy Act (Australia), APPI (Japan) and POPIA (South Africa) may apply. This hackathon prototype has <b>not</b> been assessed for compliance with any of them and makes no compliance claims. A production version would need secure authentication, encryption in transit and at rest, access controls, retention and deletion policies, and privacy and security assessments before handling real patient data.</p></div>`;
  }

  function settingsHTML() {
    const st = S.data.settings;
    const sel = (id, opts, v) => `<select id="${id}">${opts.map(([val, lbl]) => `<option value="${val}"${val === v ? ' selected' : ''}>${lbl}</option>`).join('')}</select>`;
    const now = new Date().toISOString();
    return `
      <div class="card"><h3>Date & time</h3>
        <label class="fld"><span>Date format</span>${sel('setDate', [['auto', 'Device default'], ['us', 'English (US) – Oct 18, 2026'], ['uk', 'English (UK) – 18 Oct 2026'], ['iso', 'ISO 8601 – 2026-10-18']], st.dateStyle)}</label>
        <label class="fld"><span>Clock</span>${sel('setClock', [['auto', 'Device default'], ['24', '24-hour'], ['12', '12-hour']], st.clock)}</label>
        <p class="muted" id="setPreview">Example: ${esc(PP.ui.fmtDateTime(now))} · time zone ${esc(PP.ui.tzLabel())}</p>
        <p class="muted">Times are stored in UTC (ISO 8601) together with the time zone they were recorded in, so they stay unambiguous when you travel or share a report.</p></div>
      <div class="card"><h3>Body map</h3>
        <label class="fld"><span>Marking opacity <b id="opVal">${Math.round(st.markOpacity * 100)}%</b></span><input type="range" id="setOpacity" min="40" max="100" step="5" value="${Math.round(st.markOpacity * 100)}"></label></div>
      <div class="card"><h3>Report</h3>
        <label class="fld"><span>Country or region <span class="help">(optional – shown on your report only)</span></span><input type="text" id="setCountry" value="${esc(st.country)}" placeholder="E.g. Norway, Canada, Japan" autocomplete="off"></label>
        <button class="btn" data-act="patient">Name / message on report</button></div>
      <div class="card"><h3>Demo & introduction</h3><div class="btn-col">
        <button class="btn" data-act="demo">Load fictional demo patient</button>
        <button class="btn" data-act="onboarding">Show the introduction again</button>
        <button class="btn" data-act="help">Drawing tips & keyboard shortcuts</button></div></div>`;
  }

  function aboutHTML() {
    return `
      <div class="card about-hero"><div class="logo-md"><span class="logo-figure dark" aria-hidden="true"></span>PAINPRINT</div>
        <p class="tagline-dark">Make the Invisible Understandable.</p>
        <p>Pain is subjective and invisible. Traditional 0–10 scales say little about <i>where</i> it hurts, how it spreads, when it happens and what it stops you from doing. PAINPRINT lets patients <b>show</b> what they experience – by drawing on a body map – and turns it into a clear, structured report to share with a healthcare professional.</p></div>
      <div class="card"><h3>Built for HealthHack 48</h3>
        <ul class="bullets"><li>Responsive web app – works on phones, tablets (with stylus) and desktop</li><li>English interface, built for international use</li>
        <li>Plain HTML, CSS, JavaScript and SVG – no tracking, no server, works offline once loaded</li>
        <li>Open source: <a href="https://github.com/uxieking/painprint" target="_blank" rel="noopener">github.com/uxieking/painprint</a></li></ul></div>
      <div class="card"><h3>Important</h3><p>${esc(TEXT.disclaimer)}</p><p class="muted">${esc(TEXT.demo)}</p></div>
      <p class="muted center">Because pain is more than a number, and every experience deserves to be communicated clearly.</p>`;
  }

  // ---------- render & actions ----------
  function render() {
    $$('#infoTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.sec === section)));
    const body = $('#infoBody');
    body.innerHTML = section === 'safety' ? safetyHTML() : section === 'privacy' ? privacyHTML() : section === 'settings' ? settingsHTML() : aboutHTML();
    if (section === 'settings') bindSettings();
  }
  function show(sec) { if (sec) section = sec; render(); $('#scr-more').scrollTop = 0; }
  $$('#infoTabs button').forEach((b) => b.addEventListener('click', () => { section = b.dataset.sec; history.replaceState(null, '', '#more/' + section); render(); }));
  $('#infoBack').addEventListener('click', () => emit('go', 'home'));

  function bindSettings() {
    const st = S.data.settings;
    const preview = () => { $('#setPreview').textContent = `Example: ${PP.ui.fmtDateTime(new Date().toISOString())} · time zone ${PP.ui.tzLabel()}`; };
    $('#setDate').addEventListener('change', (e) => { st.dateStyle = e.target.value; S.save(); preview(); });
    $('#setClock').addEventListener('change', (e) => { st.clock = e.target.value; S.save(); preview(); });
    $('#setOpacity').addEventListener('input', (e) => { st.markOpacity = +e.target.value / 100; $('#opVal').textContent = e.target.value + '%'; S.save(); PP.track.renderAll(); });
    $('#setCountry').addEventListener('input', (e) => { st.country = e.target.value.trim(); S.save(); });
  }

  $('#infoBody').addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'export') download(JSON.stringify(X.exportFile(S.data), null, 2), 'painprint');
    if (act === 'backup') download(S.exportJSON(), 'painprint-backup');
    if (act === 'import') $('#fileImport').click();
    if (act === 'report') emit('go', 'report');
    if (act === 'demo') emit('demo');
    if (act === 'patient') emit('patient');
    if (act === 'help') emit('help');
    if (act === 'onboarding') startOnboarding(true);
    if (act === 'reset') {
      const v = await modal({ title: 'Delete all data?', body: '<p>All entries, drawings, check-ins and settings are deleted from this browser. This cannot be undone. Consider exporting first.</p>', buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Delete everything', cls: 'danger-fill' }] });
      if (v === 'ok') { S.reset(); S.data.onboarded = true; S.save(); toast('All data deleted from this device'); render(); }
    }
  });

  // ---------- onboarding (5 steps) ----------
  const STEPS = [
    () => `<div class="ob-art welcome"><span class="logo-figure" aria-hidden="true"></span></div>
      <h2>Welcome to PAINPRINT</h2><p class="ob-tag">Make the Invisible Understandable.</p>
      <p>Document your symptoms visually and prepare clearer information for healthcare professionals.</p>`,
    () => `<h2>How it works</h2><ol class="ob-steps">
      <li><b>Select a body region</b> – front or back, down to a jaw, a finger or a toe.</li>
      <li><b>Zoom in and mark your pain</b> – draw, circle an area, place a point or show how it spreads.</li>
      <li><b>Record symptoms and their impact</b> – intensity, sensations, triggers you noticed, daily life.</li>
      <li><b>Review your history</b> – see how it changes over time.</li>
      <li><b>Generate a report</b> – print it or save it as a PDF for your appointment.</li></ol>`,
    () => `<h2>Your safety</h2><p>${esc(TEXT.disclaimer)}</p>
      <p class="ob-warn"><b>${esc(TEXT.emergency)}</b><br><span>Emergency numbers vary by country and region.</span></p>
      <p>${esc(TEXT.worsening)}</p>`,
    () => `<h2>Your privacy</h2><p class="ob-warn"><b>${esc(TEXT.demo)}</b></p>
      <ul class="bullets"><li>Entries are stored only in this browser on this device.</li><li>Nothing is sent to a server – no analytics, no trackers.</li>
      <li>Browser storage is not encrypted. You can export or delete everything at any time under Privacy.</li></ul>`,
    () => `<div class="ob-art ready">${icon('point')}</div><h2>Ready?</h2>
      <p>Explore PAINPRINT with a <b>fictional demo patient</b> – a month of pain entries, a trend and a report – or start with an empty diary.</p>`,
  ];
  let step = 0, obEnter = false;
  function renderOnboarding() {
    const last = step === STEPS.length - 1;
    $('#onboarding').innerHTML = `<div class="ob-card${obEnter ? ' enter' : ''}" role="dialog" aria-modal="true" aria-labelledby="obTitle">
      <div class="ob-body">${STEPS[step]().replace('<h2>', '<h2 id="obTitle">')}</div>
      <div class="ob-dots" aria-hidden="true">${STEPS.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
      <div class="ob-actions">${last
        ? `<button class="cta" id="obStart">Start Exploring PAINPRINT</button><button class="btn ghost" id="obEmpty">Start with an empty diary</button>`
        : `<button class="btn ghost" id="obBack"${step === 0 ? ' disabled' : ''}>Back</button><button class="cta small" id="obNext">Next</button>`}</div>
      ${last ? '' : '<button class="ob-skip" id="obSkip">Skip</button>'}</div>`;
    const done = (demo) => {
      $('#onboarding').hidden = true;
      S.data.onboarded = true; S.save();
      if (demo) emit('loadDemo'); else emit('go', 'home');
    };
    if (last) { $('#obStart').addEventListener('click', () => done(true)); $('#obEmpty').addEventListener('click', () => done(false)); $('#obStart').focus(); }
    else {
      $('#obNext').addEventListener('click', () => { step++; renderOnboarding(); });
      $('#obBack').addEventListener('click', () => { step = Math.max(0, step - 1); renderOnboarding(); });
      $('#obSkip').addEventListener('click', () => { step = STEPS.length - 1; renderOnboarding(); });
      $('#obNext').focus();
    }
  }
  function startOnboarding(force) {
    if (!force && S.data.onboarded) return false;
    step = 0;
    $('#onboarding').hidden = false;
    obEnter = true; renderOnboarding(); obEnter = false;
    return true;
  }
  $('#onboarding').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' && step < STEPS.length - 1) { step++; renderOnboarding(); }
    if (e.key === 'ArrowLeft' && step > 0) { step--; renderOnboarding(); }
  });

  PP.info = { show, startOnboarding, TEXT };
})();
