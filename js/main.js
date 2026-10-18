/* PAINPRINT – app shell: navigation, settings menu, welcome, import/export, report screen. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.store, X = PP.exchange;
  const { $, $$, esc, applyIcons, modal, toast, openPopover, on, download } = PP.ui;

  applyIcons();
  const SCREENS = ['home', 'track', 'history', 'report'];
  let current = null;

  function go(screen, opts = {}) {
    if (!SCREENS.includes(screen)) screen = 'home';
    PP.ui.closePopover();
    current = screen;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === screen));
    $$('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.go === screen));
    $('#tabbar').classList.toggle('dark', screen === 'track');
    document.querySelector('meta[name="theme-color"]').content = screen === 'track' ? '#0b1424' : '#f2f4f8';
    if (location.hash !== '#' + screen) history.replaceState(null, '', '#' + screen);
    if (screen === 'home') PP.home.render();
    if (screen === 'track') PP.track.open(opts);
    if (screen === 'history') PP.history.render();
    if (screen === 'report') {
      $('#report').innerHTML = PP.report.build();
      $('#scr-report').scrollTop = 0;
      if (opts.print) setTimeout(() => window.print(), 300);
    }
  }
  on('go', go);
  $$('#tabbar button').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h !== current) go(h); });

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
    toast('Sample patient loaded – explore the Track, History and Report tabs');
    go(current || 'home');
  }
  on('demo', async () => {
    if (S.data.entries.length) {
      const v = await modal({ title: 'Load sample patient?', body: '<p>The sample patient replaces your current entries. You can undo afterwards.</p>', buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Load sample', cls: 'primary' }] });
      if (v !== 'ok') return;
    }
    loadDemo();
  });

  function maybeWelcome() {
    let seen = false;
    try { seen = localStorage.getItem('painprint.welcomed') === '1'; } catch (e) { /* ignore */ }
    if (seen || S.data.entries.length) return;
    modal({
      title: 'Welcome to PAINPRINT',
      body: `<p>Pain is invisible – and at the doctor's it's easy to forget, downplay or overstate it. Log it <b>when it happens</b> instead:</p>
        <ol class="help-list">
          <li><b>Draw</b> exactly where it hurts – zoom in on a jaw, a temple or a finger.</li>
          <li>Pick the <b>pain level 1–10</b> as your color (<span style="color:#f97316">9 orange</span>, <span style="color:#ef4444">10 red</span>).</li>
          <li>Turn the body around with <b>Front / Back</b>.</li>
          <li>Add <b>when</b> and <b>why</b> – then download a PDF for your doctor.</li>
        </ol>
        <p>Everything stays on this device. No account needed.</p>`,
      buttons: [{ value: 'empty', label: 'Start empty' }, { value: 'demo', label: 'Try a sample patient', cls: 'primary' }],
    }).then((v) => {
      try { localStorage.setItem('painprint.welcomed', '1'); } catch (e) { /* ignore */ }
      if (v === 'demo') loadDemo();
    });
  }

  // ---------- settings menu ----------
  $('#btnSettings').addEventListener('click', () => {
    openPopover($('#btnSettings'), `
      <button data-v="demo">Load sample patient</button>
      <button data-v="patient">Patient details</button>
      <hr>
      <button data-v="export">Export entries (JSON)</button>
      <button data-v="import">Import entries / backup</button>
      <button data-v="backup">Download full backup</button>
      <hr>
      <button data-v="help">How it works</button>
      <button data-v="reset" class="danger">Delete all data</button>`, onMenu, 'right');
  });
  async function onMenu(act) {
    if (act === 'demo') PP.ui.emit('demo');
    if (act === 'patient') openPatientDialog();
    if (act === 'export') download(JSON.stringify(X.exportFile(S.data), null, 2), 'painprint');
    if (act === 'backup') download(S.exportJSON(), 'painprint-backup');
    if (act === 'import') $('#fileImport').click();
    if (act === 'help') openHelp();
    if (act === 'reset') {
      const v = await modal({ title: 'Delete all data?', body: '<p>All entries, drawings, check-ins and patient details are deleted from this device. This cannot be undone. Consider exporting first.</p>', buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Delete everything', cls: 'danger-fill' }] });
      if (v === 'ok') { S.reset(); go('home'); }
    }
  }

  function openPatientDialog() {
    const p = S.data.patient;
    modal({
      title: 'Patient details',
      body: `<p>Optional. Shown at the top of the report. Stored only on this device.</p>
        <label class="fld"><span>Name</span><input type="text" id="pName" value="${esc(p.name)}" autocomplete="off"></label>
        <label class="fld"><span>Date of birth</span><input type="date" id="pBirth" value="${esc(p.birthDate)}"></label>
        <label class="fld"><span>Message to your doctor</span><textarea id="pNotes">${esc(p.notes)}</textarea></label>`,
      buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Save', cls: 'primary' }],
      onOpen(d) {
        d.addEventListener('close', () => {
          if (d.returnValue !== 'ok') return;
          p.name = $('#pName', d).value.trim(); p.birthDate = $('#pBirth', d).value; p.notes = $('#pNotes', d).value.trim();
          S.save();
          if (current === 'report') go('report');
        }, { once: true });
      },
    });
  }
  $('#btnPatient').addEventListener('click', openPatientDialog);
  $('#btnPrint').addEventListener('click', () => window.print());

  function openHelp() {
    modal({
      title: 'How PAINPRINT works',
      body: `<ul class="help-list">
        <li><b>Move</b> (hand): drag to pan, pinch or scroll to zoom, tap a body area to zoom in. Never draws.</li>
        <li><b>Draw</b>, <b>Area</b> and <b>Arrow</b> draw in the selected pain-level color. Arrows show pain that spreads.</li>
        <li>Two fingers always zoom – a stroke in progress is cancelled. With a stylus, only the stylus draws.</li>
        <li><b>Front / Back</b> turns the body around – the zoomed area follows.</li>
        <li><b>Pain details</b> (bottom sheet): when it happened, why, sensations, triggers, symptoms.</li>
        <li>Keyboard: <kbd>V</kbd> move · <kbd>B</kbd> draw · <kbd>A</kbd> area · <kbd>R</kbd> arrow · <kbd>E</kbd> erase · <kbd>1</kbd>–<kbd>0</kbd> level · <kbd>F</kbd> turn · <kbd>Space</kbd> pan · <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo</li>
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
  maybeWelcome();
})();
