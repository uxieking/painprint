/* PAINPRINT – app shell: navigation, settings menu, welcome, import/export, report screen. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.store, X = PP.exchange;
  const { $, $$, esc, applyIcons, modal, toast, on, download } = PP.ui;

  applyIcons();
  const SCREENS = ['home', 'track', 'history', 'report', 'more'];
  let current = null;

  function go(screen, opts = {}) {
    if (typeof screen === 'string' && screen.startsWith('more/')) { opts = { ...opts, section: screen.slice(5) }; screen = 'more'; }
    if (!SCREENS.includes(screen)) screen = 'home';
    PP.ui.closePopover();
    current = screen;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === screen));
    $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.go === screen));
    $('#tabbar').classList.toggle('dark', screen === 'track');
    document.querySelector('meta[name="theme-color"]').content = screen === 'track' ? '#0b1424' : '#f2f4f8';
    const hash = '#' + screen + (screen === 'more' && opts.section ? '/' + opts.section : '');
    if (location.hash !== hash) history.replaceState(null, '', hash);
    if (screen === 'home') PP.home.render();
    if (screen === 'track') PP.track.open(opts);
    if (screen === 'history') PP.history.render();
    if (screen === 'more') PP.info.show(opts.section);
    if (screen === 'report') {
      $('#report').innerHTML = PP.report.build({ days: +$('#reportPeriod').value });
      $('#scr-report').scrollTop = 0;
      if (opts.print) setTimeout(printPDF, 300);
    }
  }
  on('go', go);
  $$('#tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h.split('/')[0] !== current || h.includes('/')) go(h); });
  // Quick links anywhere: data-go="screen" and data-more="section"
  document.addEventListener('click', (e) => {
    const g = e.target.closest('#scr-home [data-go]'); if (g) { go(g.dataset.go); return; }
    const m = e.target.closest('[data-more]'); if (m) go('more', { section: m.dataset.more });
  });

  // Keep every screen in sync with the data
  function refresh() {
    PP.track.renderAll();
    if (current === 'home') PP.home.render();
    if (current === 'history') PP.history.render();
  }
  S.onChange(refresh);
  on('data', () => { if (current === 'home') PP.home.render(); if (current === 'history') PP.history.render(); });

  // ---------- sample patient & welcome ----------
  function loadDemo() {
    PP.demo.load();
    toast('Fictional demo patient loaded – explore Track, History and Report');
    go(current || 'home');
  }
  on('demo', async () => {
    if (S.data.entries.length) {
      const v = await modal({ title: 'Load the demo patient?', body: '<p>The fictional demo patient replaces your current entries. You can undo afterwards.</p>', buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Load sample', cls: 'primary' }] });
      if (v !== 'ok') return;
    }
    loadDemo();
  });

  // ---------- settings menu ----------
  $('#btnSettings').addEventListener('click', () => go('more', { section: 'settings' }));
  on('patient', () => openPatientDialog());
  on('help', () => openHelp());
  on('loadDemo', () => loadDemo());

  function openPatientDialog() {
    const p = S.data.patient;
    modal({
      title: 'Details on the report',
      body: `<p>Optional. Shown at the top of the report. Stored only on this device.</p>
        <p><b>${esc(PP.info.TEXT.demo)}</b></p>
        <label class="fld"><span>Name or label on the report</span><input type="text" id="pName" value="${esc(p.name)}" autocomplete="off" placeholder="E.g. a fictional name"></label>
        <label class="fld"><span>Message to your healthcare professional</span><textarea id="pNotes">${esc(p.notes)}</textarea></label>`,
      buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Save', cls: 'primary' }],
      onOpen(d) {
        d.addEventListener('close', () => {
          if (d.returnValue !== 'ok') return;
          p.name = $('#pName', d).value.trim(); p.notes = $('#pNotes', d).value.trim();
          S.save();
          if (current === 'report') go('report');
        }, { once: true });
      },
    });
  }
  // "Download PDF" uses the browser's own print engine (Save as PDF) – nothing leaves the device.
  function printPDF() { toast('Choose “Save as PDF” as the printer to download the report', 4000); setTimeout(() => window.print(), 400); }
  $('#btnPrint').addEventListener('click', printPDF);
  $('#btnPrintOnly').addEventListener('click', () => window.print());
  $('#reportPeriod').addEventListener('change', () => go('report'));

  function openHelp() {
    modal({
      title: 'How PAINPRINT works',
      body: `<ul class="help-list">
        <li><b>Move</b> (hand): drag to pan, pinch or scroll to zoom, tap a body area to zoom in. Never draws.</li>
        <li><b>Draw</b>, <b>Area</b>, <b>Arrow</b> and <b>Point</b> use the selected pain-level color. Arrows show pain that spreads; Point marks one exact spot.</li>
        <li>Can't draw precisely? Select a body area and tap <b>Mark whole area</b>, or choose the area from the title menu.</li>
        <li>Two fingers always zoom – a stroke in progress is cancelled. With a stylus, only the stylus draws.</li>
        <li><b>Front / Back</b> turns the body around – the zoomed area follows.</li>
        <li><b>Pain details</b> (bottom sheet): when it happened, why, sensations, triggers, symptoms.</li>
        <li>Keyboard: <kbd>V</kbd> move · <kbd>B</kbd> draw · <kbd>A</kbd> area · <kbd>R</kbd> arrow · <kbd>P</kbd> point · <kbd>E</kbd> erase · <kbd>1</kbd>–<kbd>0</kbd> level · <kbd>F</kbd> turn · <kbd>Space</kbd> pan · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo</li>
      </ul>`,
      buttons: [{ value: 'ok', label: 'Got it', cls: 'primary' }],
    });
  }

  $('#fileImport').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      let json;
      try { json = JSON.parse(await f.text()); } catch (err) { throw new Error('The file is not valid JSON.'); }
      const parsed = X.parseImport(json);
      const n = parsed.kind === 'backup' ? parsed.data.entries.length : parsed.entries.length;
      const word = n === 1 ? 'entry' : 'entries';
      const buttons = [{ value: 'cancel', label: 'Cancel' }];
      if (parsed.kind === 'entries') buttons.push({ value: 'replace', label: 'Replace all' }, { value: 'add', label: 'Add', cls: 'primary' });
      else buttons.push({ value: 'replace', label: 'Restore', cls: 'primary' });
      const v = await modal({
        title: parsed.kind === 'backup' ? 'Restore backup?' : 'Import entries?',
        body: parsed.kind === 'backup'
          ? `<p>“${esc(f.name)}” is a full backup with ${n} ${word}. It replaces everything currently in the app.</p>`
          : `<p>“${esc(f.name)}” contains ${n} ${word}. Add them to your existing entries, or replace everything?</p>`,
        buttons,
      });
      if (v !== 'add' && v !== 'replace') return;
      const warnings = S.importParsed(parsed, v);
      if (warnings.length) {
        modal({ title: 'Imported – please check', body: `<p>The data was imported, but some things should be checked:</p><ul class="help-list">${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`, buttons: [{ value: 'ok', label: 'OK', cls: 'primary' }] });
      } else toast(`${n} ${word} imported`);
    } catch (err) {
      modal({ title: 'Could not import', body: `<p>${esc(err.message)}</p>`, buttons: [{ value: 'ok', label: 'OK' }] });
    }
  });

  // ---------- persistence hooks ----------
  window.addEventListener('pagehide', () => S.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) S.flush(); });
  S.onStatus((s) => { if (s === 'error') toast('Could not save on this device – export your data to keep it'); });

  go(location.hash.slice(1) || 'home');
  if (!S.data.onboarded && !S.data.entries.length) PP.info.startOnboarding(false);
})();
