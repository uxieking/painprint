/* PAINPRINT – Home screen: daily check-in, latest entry, new entry. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.store, V = PP.vocab;
  const { $, esc, icon, moodFace, miniMapSVG, fmtDateTime, emit, toast } = PP.ui;

  function renderMoods() {
    const today = S.todayCheckin();
    $('#moods').innerHTML = V.MOODS.map((m) =>
      `<button class="mood" role="radio" aria-checked="${!!today && today.mood === m.code}" data-mood="${m.code}">${moodFace(m)}<span>${m.label}</span></button>`).join('');
  }
  $('#moods').addEventListener('click', (e) => {
    const b = e.target.closest('[data-mood]');
    if (!b) return;
    S.setCheckin(b.dataset.mood);
    renderMoods();
    emit('data');
    const m = V.MOODS.find((x) => x.code === b.dataset.mood);
    toast(m.pain >= 5 ? 'Logged. Want to show where it hurts? Tap “New entry”.' : `Logged: ${m.label} – thanks for checking in`);
  });

  function latestEntry() {
    return S.data.entries.slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))[0] || null;
  }

  function renderLatest() {
    const card = $('#latestCard');
    const e = latestEntry();
    if (!e) {
      card.classList.add('empty-card');
      card.innerHTML = `<h3>No entries yet</h3><p>Log your pain when it happens – where, how much, when and why. Your doctor sees the real pattern, not just how you feel on the day of the visit.</p>
        <button class="btn" id="btnTryDemo" type="button">Try a sample patient</button>`;
      $('#btnTryDemo').addEventListener('click', (ev) => { ev.stopPropagation(); emit('demo'); });
      return;
    }
    card.classList.remove('empty-card');
    const first = (field) => (e[field] && e[field].length ? V.labels(field, e[field]).slice(0, 2).join(', ') : '');
    const rows = [
      e.sensations.length && `<div class="li-row">${icon('bolt')}${esc(first('sensations'))}</div>`,
      e.duration && `<div class="li-row">${icon('clock')}${esc(V.label('duration', e.duration))}</div>`,
      e.triggers.length && `<div class="li-row">${icon('activity')}${esc(first('triggers'))}</div>`,
    ].filter(Boolean).join('');
    card.innerHTML = `
      <h3>Latest entry</h3>
      <div class="lt-date">${fmtDateTime(e.occurredAt)}</div>
      <div class="latest-row">
        <div class="latest-map">${miniMapSVG([e], { views: [e.shapes[0] ? e.shapes[0].view : 'front'] })}</div>
        <div class="latest-info">
          <div class="li-row" style="justify-content:space-between"><span>${esc(e.title)}</span>${icon('chev')}</div>
          <div class="big" style="color:${V.levelColor(e.intensity)}">${e.intensity}<small>/10</small></div>
          <div class="bar"><i style="width:${e.intensity * 10}%;background:${V.levelColor(e.intensity)}"></i></div>
          ${rows}
        </div>
      </div>`;
    card.onclick = () => emit('go', 'track', { entryId: e.id });
  }

  $('#btnNewEntry').addEventListener('click', () => emit('go', 'track', { newEntry: true, region: null }));

  PP.home = { render() { renderMoods(); renderLatest(); } };
})();
