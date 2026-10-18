/* PAINPRINT – History screen: pain trend, body map of latest entries, timeline and patterns. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.store, V = PP.vocab, B = PP.body, RP = PP.report;
  const { $, $$, esc, miniMapSVG, fmtShort, fmtTime, dayKey, emit } = PP.ui;

  let range = 30, tab = 'overview', freqField = '';
  // Entries filter (Entries tab)
  const filter = { days: 0, group: '', symptom: '', minLevel: 0, trigger: '' };

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

  // ---------- frequency of entries per week (optionally only entries with one symptom) ----------
  function weeks(days) {
    const n = Math.max(1, Math.ceil(days / 7)), out = [];
    const end = new Date(); end.setHours(23, 59, 59, 999);
    for (let i = n - 1; i >= 0; i--) { const to = new Date(end - i * 7 * 864e5), from = new Date(to - 7 * 864e5 + 1); out.push({ from, to }); }
    return out;
  }
  const hasCode = (e, code) => !code || [...e.sensations, ...e.associatedSymptoms].includes(code);
  function freqSVG(days) {
    const ws = weeks(days);
    const counts = ws.map((w) => S.data.entries.filter((e) => { const t = new Date(e.occurredAt); return t >= w.from && t <= w.to && hasCode(e, freqField); }).length);
    if (!counts.some(Boolean)) return '<div class="empty">No matching entries in this period.</div>';
    const W = 340, H = 140, L0 = 26, Rr = 10, T = 10, Bm = 24, max = Math.max(2, ...counts);
    const bw = (W - L0 - Rr) / ws.length;
    const y = (v) => T + (1 - v / max) * (H - T - Bm);
    const bars = counts.map((c, i) => `<rect x="${(L0 + i * bw + bw * 0.18).toFixed(1)}" y="${y(c).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${(H - Bm - y(c)).toFixed(1)}" rx="3" fill="#2f8086"><title>${fmtShort(ws[i].from.toISOString())} – ${fmtShort(ws[i].to.toISOString())}: ${c}</title></rect>`).join('');
    const grid = [0, max].map((v) => `<line x1="${L0}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="#e7ebf1"/><text x="${L0 - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#7a8699">${v}</text>`).join('');
    const step = Math.max(1, Math.ceil(ws.length / 5));
    const labels = ws.map((w, i) => (i % step === 0 || i === ws.length - 1 ? `<text x="${(L0 + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="#7a8699">${fmtShort(w.to.toISOString())}</text>` : '')).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Entries per week">${grid}${bars}${labels}</svg>`;
  }

  // ---------- daily-life impact over time (average of the activity ratings per entry) ----------
  function impactSVG(days) {
    const since = Date.now() - days * 864e5;
    const pts = S.data.entries.filter((e) => new Date(e.occurredAt) >= since && Object.keys(e.impactScores || {}).length)
      .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt))
      .map((e) => { const v = Object.values(e.impactScores); return { t: new Date(e.occurredAt), v: v.reduce((a, b) => a + b, 0) / v.length, title: e.title }; });
    if (pts.length < 2) return '<div class="empty">Rate daily-life impact in at least two entries to see changes.</div>';
    const W = 340, H = 140, L0 = 26, Rr = 14, T = 10, Bm = 24, t0 = since, t1 = Date.now();
    const x = (t) => L0 + ((t - t0) / (t1 - t0)) * (W - L0 - Rr);
    const y = (v) => T + (1 - v / 10) * (H - T - Bm);
    const line = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
    const grid = [0, 5, 10].map((v) => `<line x1="${L0}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="#e7ebf1"/><text x="${L0 - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#7a8699">${v}</text>`).join('');
    const dots = pts.map((p) => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" fill="#1f4a6b" stroke="#fff" stroke-width="1.5"><title>${esc(p.title)}: ${p.v.toFixed(1)}/10</title></circle>`).join('');
    const labels = [t0, (t0 + t1) / 2, t1].map((t, k) => `<text x="${x(t)}" y="${H - 6}" text-anchor="${['start', 'middle', 'end'][k]}" font-size="10" fill="#7a8699">${fmtShort(new Date(t).toISOString())}</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily-life impact over time">${grid}<path d="${line}" fill="none" stroke="#1f4a6b" stroke-width="2"/>${dots}${labels}</svg>`;
  }

  // ---------- body map of the latest entries ----------
  function latest(n) { return S.data.entries.slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, n); }
  function legendHTML() {
    const bands = [['Severe', '10', 10], ['High', '8–9', 9], ['Moderate', '4–7', 7], ['Mild', '1–3', 3]];
    return bands.map(([l, r, v]) => `<div><i style="background:${V.levelColor(v)}"></i>${l} <span class="muted">${r}</span></div>`).join('') +
      '<div class="muted" style="font-size:11.5px;margin-top:2px">Colors = pain level 1–10</div>';
  }

  // ---------- entries timeline ----------
  function matches(e) {
    if (filter.days && new Date(e.occurredAt) < Date.now() - filter.days * 864e5) return false;
    if (filter.group && !RP.regionList(e).some((r) => r.group === filter.group)) return false;
    if (filter.symptom && !hasCode(e, filter.symptom)) return false;
    if (filter.minLevel && e.intensity < filter.minLevel) return false;
    if (filter.trigger && !e.triggers.includes(filter.trigger)) return false;
    return true;
  }
  function filterBarHTML() {
    const opt = (v, l, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`;
    const groups = [...new Set(S.data.entries.flatMap((e) => RP.regionList(e).map((r) => r.group)))];
    const syms = [...new Set(S.data.entries.flatMap((e) => [...e.sensations, ...e.associatedSymptoms]))];
    const trigs = [...new Set(S.data.entries.flatMap((e) => e.triggers))];
    const symLabel = (c) => (V.sensations.some((o) => o.code === c) ? V.label('sensations', c) : V.label('associatedSymptoms', c));
    return `<div class="card filters" role="search" aria-label="Filter entries">
      <label><span>Period</span><select data-f="days">${opt(0, 'All time', filter.days)}${opt(7, 'Last 7 days', filter.days)}${opt(30, 'Last 30 days', filter.days)}${opt(90, 'Last 90 days', filter.days)}</select></label>
      <label><span>Body area</span><select data-f="group">${opt('', 'All areas', filter.group)}${groups.map((g) => opt(g, B.GROUP_NAMES[g] || g, filter.group)).join('')}</select></label>
      <label><span>Symptom</span><select data-f="symptom">${opt('', 'All symptoms', filter.symptom)}${syms.map((c) => opt(c, symLabel(c), filter.symptom)).join('')}</select></label>
      <label><span>Intensity</span><select data-f="minLevel">${opt(0, 'Any', filter.minLevel)}${[3, 5, 7, 9].map((l) => opt(l, l + ' or higher', filter.minLevel)).join('')}</select></label>
      <label><span>Trigger</span><select data-f="trigger">${opt('', 'All triggers', filter.trigger)}${trigs.map((c) => opt(c, V.label('triggers', c), filter.trigger)).join('')}</select></label>
    </div>`;
  }
  function entriesHTML() {
    const all = S.data.entries.slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
    const list = all.filter(matches);
    if (all.length && !list.length) return filterBarHTML() + '<p class="muted center">No entries match these filters.</p>';
    if (!list.length) return '<div class="card empty-card"><h3>No entries yet</h3><p>Every time it hurts, log it – the timeline builds itself.</p></div>';
    let html = filterBarHTML() + `<p class="muted" style="margin:0 4px">${list.length} of ${all.length} entries · patient-reported</p>`, lastDay = '';
    for (const e of list) {
      const day = PP.ui.fmtDay(e.occurredAt);
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
      $('#freqChart').innerHTML = freqSVG(range);
      $('#impactChart').innerHTML = impactSVG(range);
      const syms = [...new Set(S.data.entries.flatMap((e) => [...e.sensations, ...e.associatedSymptoms]))];
      $('#freqField').innerHTML = `<option value="">All entries</option>` + syms.map((c) => `<option value="${esc(c)}"${c === freqField ? ' selected' : ''}>${esc(V.sensations.some((o) => o.code === c) ? V.label('sensations', c) : V.label('associatedSymptoms', c))}</option>`).join('');
      const lat = latest(5);
      $('#miniMap').innerHTML = lat.length ? miniMapSVG(lat) : '<p class="muted">Your latest entries will appear here.</p>';
      $('#miniLegend').innerHTML = legendHTML();
    } else if (tab === 'entries') {
      $('#entryList').innerHTML = entriesHTML();
      $$('#entryList [data-f]').forEach((s) => s.addEventListener('change', () => { const k = s.dataset.f; filter[k] = ['days', 'minLevel'].includes(k) ? +s.value : s.value; render(); }));
      $$('#entryList .e-card').forEach((b) => b.addEventListener('click', () => emit('go', 'track', { entryId: b.dataset.id })));
    } else {
      $('#patterns').innerHTML = patternsHTML();
    }
  }

  $('#freqField').addEventListener('change', (e) => { freqField = e.target.value; $('#freqChart').innerHTML = freqSVG(range); });
  PP.history = { render };
})();
