/* PAINPRINT – History screen: pain trend, body map of latest entries, timeline and patterns. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.store, V = PP.vocab, B = PP.body, RP = PP.report;
  const { $, $$, esc, miniMapSVG, fmtShort, fmtTime, dayKey, emit } = PP.ui;

  let range = 30, tab = 'overview';

  // ---------- tabs ----------
  $$('#histTabs button').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
  $$('#rangePills button').forEach((b) => b.addEventListener('click', () => { range = +b.dataset.days; render(); }));
  $('#btnDownload').addEventListener('click', () => emit('go', 'report', { print: true }));

  // ---------- trend ----------
  /** Daily value = the worst of that day's entries and the "How are you today?" check-in. */
  function trendData(days) {
    const byDay = new Map();
    const put = (key, v) => byDay.set(key, Math.max(byDay.get(key) ?? -1, v));
    for (const c of S.data.checkins) { const m = V.MOODS.find((x) => x.code === c.mood); if (m) put(c.date, m.pain); }
    for (const e of S.data.entries) put(dayKey(e.occurredAt), e.intensity);
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
      const k = dayKey(d.toISOString());
      out.push({ i: days - 1 - i, date: d, v: byDay.has(k) ? byDay.get(k) : null });
    }
    return out;
  }
  function trendSVG(days) {
    const data = trendData(days), pts = data.filter((d) => d.v !== null);
    if (pts.length < 2) return '<div class="empty">Check in on the Home screen or log entries to see your trend.</div>';
    const W = 340, H = 168, L = 26, Rr = 14, T = 10, Bm = 26;
    const x = (i) => L + (i / (days - 1)) * (W - L - Rr);
    const y = (v) => T + (1 - v / 10) * (H - T - Bm);
    const line = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const area = `${line} L${x(pts[pts.length - 1].i).toFixed(1)} ${y(0)} L${x(pts[0].i).toFixed(1)} ${y(0)} Z`;
    const grid = [0, 5, 10].map((v) => `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="#e7ebf1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#7a8699">${v}</text>`).join('');
    const ticks = 5, labels = Array.from({ length: ticks }, (_, k) => Math.round((k / (ticks - 1)) * (days - 1)))
      .map((i, k) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${k === 0 ? 'start' : k === ticks - 1 ? 'end' : 'middle'}" font-size="10" fill="#7a8699">${fmtShort(data[i].date)}</text>`).join('');
    const dotEvery = days > 40 ? 3 : 1;
    const dots = pts.filter((p, k) => k % dotEvery === 0 || p.v >= 7).map((p) =>
      `<circle cx="${x(p.i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.v >= 7 ? 4.2 : 3.2}" fill="${p.v > 0 ? V.levelColor(p.v) : '#94a3b8'}" stroke="#fff" stroke-width="1.5"><title>${fmtShort(p.date)}: ${p.v}/10</title></circle>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pain trend over the last ${days} days">
      <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ef4444" stop-opacity=".28"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/></linearGradient></defs>
      ${grid}<path d="${area}" fill="url(#trendFill)"/><path d="${line}" fill="none" stroke="#f0606c" stroke-width="2" stroke-linejoin="round"/>${dots}${labels}</svg>`;
  }

  // ---------- body map of the latest entries ----------
  function latest(n) { return S.data.entries.slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, n); }
  function legendHTML() {
    const bands = [['Severe', '10', 10], ['High', '8–9', 9], ['Moderate', '4–7', 7], ['Mild', '1–3', 3]];
    return bands.map(([l, r, v]) => `<div><i style="background:${V.levelColor(v)}"></i>${l} <span class="muted">${r}</span></div>`).join('') +
      '<div class="muted" style="font-size:11.5px;margin-top:2px">Colors = pain level 1–10</div>';
  }

  // ---------- entries timeline ----------
  function entriesHTML() {
    const list = S.data.entries.slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
    if (!list.length) return '<div class="card empty-card"><h3>No entries yet</h3><p>Every time it hurts, log it – the timeline builds itself.</p></div>';
    let html = '', lastDay = '';
    for (const e of list) {
      const day = new Date(e.occurredAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      if (day !== lastDay) { html += `<div class="day-head">${day}</div>`; lastDay = day; }
      const regs = RP.regionList(e).slice(0, 2).map((r) => r.name).join(', ');
      const view = e.shapes[0] ? e.shapes[0].view : 'front';
      html += `<button class="e-card" data-id="${e.id}">${miniMapSVG([e], { views: [view] })}
        <span><b>${esc(e.title)}</b><small>${fmtTime(e.occurredAt)}${regs ? ' · ' + esc(regs) : ''}</small>${e.context ? `<span class="why">Why: ${esc(e.context)}</span>` : ''}</span>
        <span class="lvl-pill" style="--c:${V.levelColor(e.intensity)}">${e.intensity}/10</span></button>`;
    }
    return html;
  }

  // ---------- patterns ----------
  function bars(title, counts, labelFn, n = 6) {
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    if (!rows.length) return '';
    const max = rows[0][1];
    return `<div class="card"><h3>${title}</h3><div class="bars">${rows.map(([k, c]) =>
      `<div class="b-row"><span>${esc(labelFn(k))}</span><span class="b-track"><i style="width:${(c / max) * 100}%"></i></span><span class="n">${c}</span></div>`).join('')}</div></div>`;
  }
  function patternsHTML() {
    const es = S.data.entries;
    if (!es.length) return '<div class="card empty-card"><h3>No patterns yet</h3><p>After a few entries you’ll see where it hurts most, what triggers it and when.</p></div>';
    const count = (fn) => { const m = new Map(); es.forEach((e) => fn(e).forEach((k) => m.set(k, (m.get(k) || 0) + 1))); return m; };
    const since = Date.now() - 30 * 864e5;
    const recent = es.filter((e) => new Date(e.occurredAt) >= since);
    const avg = recent.length ? (recent.reduce((s, e) => s + e.intensity, 0) / recent.length).toFixed(1) : '–';
    const worst = recent.length ? Math.max(...recent.map((e) => e.intensity)) : '–';
    const part = (iso) => { const h = new Date(iso).getHours(); return h < 6 ? 'Night (0–6)' : h < 12 ? 'Morning (6–12)' : h < 18 ? 'Afternoon (12–18)' : 'Evening (18–24)'; };
    return `
      <div class="card"><h3>Last 30 days</h3><div class="stat-row">
        <div class="stat"><b>${recent.length}</b><small>episodes logged</small></div>
        <div class="stat"><b>${avg}</b><small>average level</small></div>
        <div class="stat"><b style="color:${worst === '–' ? 'inherit' : V.levelColor(worst)}">${worst}</b><small>worst level</small></div>
      </div></div>
      ${bars('Where it hurts most', count((e) => [...new Set(RP.regionList(e).slice(0, 3).map((r) => r.id))]), (id) => B.byId[id] ? B.byId[id].name + (B.byId[id].view === 'back' ? ' (back)' : '') : id)}
      ${bars('When it happens', count((e) => [part(e.occurredAt)]), (k) => k, 4)}
      ${bars('Common triggers', count((e) => e.triggers), (c) => V.label('triggers', c))}
      ${bars('How it feels', count((e) => e.sensations), (c) => V.label('sensations', c))}
      ${bars('What it affects', count((e) => e.dailyImpact), (c) => V.label('dailyImpact', c))}`;
  }

  function render() {
    $$('#histTabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    $$('#scr-history [data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== tab; });
    $$('#rangePills button').forEach((b) => b.classList.toggle('on', +b.dataset.days === range));
    if (tab === 'overview') {
      $('#trendChart').innerHTML = trendSVG(range);
      const lat = latest(5);
      $('#miniMap').innerHTML = lat.length ? miniMapSVG(lat) : '<p class="muted">Your latest entries will appear here.</p>';
      $('#miniLegend').innerHTML = legendHTML();
    } else if (tab === 'entries') {
      $('#entryList').innerHTML = entriesHTML();
      $$('#entryList .e-card').forEach((b) => b.addEventListener('click', () => emit('go', 'track', { entryId: b.dataset.id })));
    } else {
      $('#patterns').innerHTML = patternsHTML();
    }
  }

  PP.history = { render };
})();
