/* PAINPRINT – printable patient report (full body + enlarged regions + entry details). */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const G = PP.geom, B = PP.body, R = PP.render;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => { if (!iso) return '–'; const d = new Date(iso); return isNaN(d) ? esc(iso) : d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }); };
  const intensityColor = (i) => `hsl(${120 - i * 12} 70% 42%)`;
  const intensityText = (i) => (i <= 0 ? 'No pain' : i <= 3 ? 'Mild' : i <= 6 ? 'Moderate' : i <= 9 ? 'Severe' : 'Worst imaginable');

  const V = PP.vocab;
  const hasContent = (e) => e.shapes.length || e.sensations.length || e.associatedSymptoms.length || e.triggers.length || e.dailyImpact.length || e.duration || e.symptomNotes || e.notes;

  /** Points whose intensity/sensations differ from the entry, or whose stated region disagrees with the drawing. */
  function pointNotes(e) {
    const out = [];
    for (const sh of e.shapes) {
      const own = typeof sh.intensity === 'number' || Array.isArray(sh.sensations);
      if (!own && !sh.reportedRegion) continue;
      const reg = sh.primaryRegion && B.byId[sh.primaryRegion];
      let t = `${reg ? reg.name : 'Outside the body'} (${B.VIEW_NAMES[sh.view].toLowerCase()})`;
      if (typeof sh.intensity === 'number') t += `: ${sh.intensity}/10`;
      if (Array.isArray(sh.sensations) && sh.sensations.length) t += ` – ${V.labels('sensations', sh.sensations).join(', ').toLowerCase()}`;
      if (sh.reportedRegion) t += ` [stated region: ${sh.reportedRegion}]`;
      out.push(t);
    }
    return out;
  }

  /** A representative on-path point for an entry (optionally inside one region). */
  function anchorFor(entry, regionId) {
    let best = null;
    for (const sh of entry.shapes) {
      if (regionId && !(sh.regions || []).some((r) => r.id === regionId)) continue;
      const view = sh.view;
      let pts = G.densify(sh.points, 4, sh.kind === 'area');
      if (regionId) pts = pts.filter((p) => { const r = B.hitRegion(view, p[0], p[1]); return r && r.id === regionId; });
      if (!pts.length) continue;
      const c = G.centroid(pts);
      let near = pts[0], nd = Infinity;
      for (const p of pts) { const d = G.dist(p, c); if (d < nd) { nd = d; near = p; } }
      const size = pts.length;
      if (!best || size > best.size) best = { view, x: near[0], y: near[1], size };
    }
    return best;
  }

  function regionList(entry) {
    const map = new Map();
    for (const sh of entry.shapes) for (const r of sh.regions || []) map.set(r.id, (map.get(r.id) || 0) + r.coverage);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => B.byId[id]).filter(Boolean);
  }

  function build(lists) {
    const S = PP.store, d = S.data;
    const all = d.entries.filter(hasContent);
    const num = (e) => d.entries.indexOf(e) + 1;
    const W = B.WORLD;

    // Full body (both views)
    let full = '';
    for (const view of B.VIEWS) {
      full += `<g transform="translate(${B.OFF[view]} 0)">${B.bodySVG(view)}${R.marksSVG(view, all, { includeHidden: true })}</g>`;
    }
    for (const e of all) {
      const a = anchorFor(e);
      if (a) full += R.badgeSVG(a.x + B.OFF[a.view], a.y, 13, num(e));
    }

    // Legend
    const usedTypes = new Set(all.flatMap((e) => e.shapes.map((s) => s.typeId)));
    const legend = d.painTypes.filter((t) => usedTypes.has(t.id))
      .map((t) => `<span><i style="background:${t.color}"></i>${esc(t.label)}</span>`).join('');
    const kinds = new Set(all.flatMap((e) => e.shapes.map((s) => s.kind)));
    const kindLegend = [kinds.has('stroke') && 'line = pain site', kinds.has('area') && 'shaded area = pain area', kinds.has('arrow') && 'arrow = radiation / direction'].filter(Boolean).join(' · ');

    // Entries
    const entriesHTML = all.map((e) => {
      const regs = regionList(e);
      const counts = { stroke: 0, area: 0, arrow: 0 };
      e.shapes.forEach((s) => counts[s.kind]++);
      const types = [...new Set(e.shapes.map((s) => s.typeId))].map((id) => S.typeById(id));
      const row = (k, v) => (v ? `<span>${k}</span><div>${v}</div>` : '');
      return `<div class="rp-entry">
        <h3><span class="n">${num(e)}</span>${esc(e.title || 'Untitled')}</h3>
        <div class="rp-grid">
          <span>Intensity (0–10)</span><div><b>${e.intensity}</b> – ${intensityText(e.intensity)}<span class="bar"><i style="width:${e.intensity * 10}%;background:${intensityColor(e.intensity)}"></i></span></div>
          ${row('Pain type (color)', types.map((t) => `<span style="color:${t.color}">●</span> ${esc(t.label)}`).join(', '))}
          ${row('Sensations', esc(V.labels('sensations', e.sensations).join(', ')))}
          ${row('Duration', esc(e.duration ? V.label('duration', e.duration) : ''))}
          ${row('Triggers', esc(V.labels('triggers', e.triggers).join(', ')))}
          ${row('Associated symptoms', esc(V.labels('associatedSymptoms', e.associatedSymptoms).join(', ')))}
          ${row('Daily impact', esc(V.labels('dailyImpact', e.dailyImpact).join(', ')))}
          ${row('Description', esc(e.symptomNotes))}
          ${row('Location', esc(regs.map((r) => `${r.name} (${B.VIEW_NAMES[r.view].toLowerCase()})`).join(', ')))}
          ${row('Individual points', pointNotes(e).map(esc).join('<br>'))}
          ${row('Drawings', [counts.stroke && `${counts.stroke} line${counts.stroke > 1 ? 's' : ''}`, counts.area && `${counts.area} area${counts.area > 1 ? 's' : ''}`, counts.arrow && `${counts.arrow} arrow${counts.arrow > 1 ? 's' : ''}`].filter(Boolean).join(', '))}
          ${row('Onset', e.onset ? fmtDate(e.onset) : '')}
          ${row('Notes', esc(e.notes))}
          <span>Recorded</span><div>${fmtDate(e.createdAt)} · last changed ${fmtDate(e.updatedAt)}</div>
        </div></div>`;
    }).join('');

    // Enlarged regions
    const regionEntries = new Map();
    for (const e of all) for (const sh of e.shapes) for (const r of sh.regions || []) {
      if (r.coverage < 0.05 && r.id !== sh.primaryRegion) continue;
      if (!regionEntries.has(r.id)) regionEntries.set(r.id, new Set());
      regionEntries.get(r.id).add(e);
    }
    const order = B.regions.map((r) => r.id);
    const regionsHTML = [...regionEntries.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((id) => {
      const reg = B.byId[id];
      const bb = reg.bbox;
      const pad = Math.max(bb.w, bb.h) * 0.3 + 6;
      const vb = { x: bb.x - pad, y: bb.y - pad, w: bb.w + 2 * pad, h: bb.h + 2 * pad };
      const ents = [...regionEntries.get(id)];
      let svg = `<svg viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" class="rp-focus">${B.bodySVG(reg.view, { selected: id, labels: false })}${R.marksSVG(reg.view, ents, { includeHidden: true })}`;
      for (const e of ents) { const a = anchorFor(e, id); if (a) svg += R.badgeSVG(a.x, a.y, Math.max(vb.w, vb.h) * 0.035, num(e)); }
      svg += '</svg>';
      return `<div class="rp-region"><h4>${esc(reg.name)} <small style="color:var(--muted);font-weight:400">· ${B.VIEW_NAMES[reg.view]}</small></h4>${svg}
        <p>${ents.map((e) => `<b>${num(e)}</b> ${esc(e.title)} (${e.intensity}/10)`).join(' · ')}</p></div>`;
    }).join('');

    const p = d.patient;
    return `
      <div class="rp-head">
        <div><h1>PAIN<b>PRINT</b></h1><div style="color:var(--muted)">Pain map – patient report</div></div>
        <div class="rp-patient">
          ${p.name ? `<span>Patient</span><b>${esc(p.name)}</b>` : ''}
          ${p.birthDate ? `<span>Date of birth</span><b>${esc(new Date(p.birthDate).toLocaleDateString('en-US'))}</b>` : ''}
          <span>Generated</span><b>${fmtDate(new Date().toISOString())}</b>
          <span>Entries</span><b>${all.length}</b>
        </div>
      </div>
      ${p.notes ? `<p style="margin-top:14px"><b>Note to clinician:</b> ${esc(p.notes)}</p>` : ''}
      <h2>Full body</h2>
      ${all.length ? '' : '<p>No entries recorded.</p>'}
      <svg class="rp-full" viewBox="${W.x} ${W.y} ${W.w} ${W.h}">${full}</svg>
      <div class="legend">${legend}</div>
      ${kindLegend ? `<div class="legend" style="color:var(--muted)">${kindLegend}. Numbers refer to the entries below.</div>` : ''}
      ${regionsHTML ? `<h2>Enlarged regions</h2><div class="rp-regions">${regionsHTML}</div>` : ''}
      ${entriesHTML ? `<h2>Pain entries</h2>${entriesHTML}` : ''}
      <div class="foot">Front view: the patient's right side is shown on the left. Back view: the patient's left side is shown on the left.
      Drawings are stored as coordinates linked to anatomical regions (PAINPRINT data format v${d.schemaVersion}).</div>`;
  }

  PP.report = { build, intensityColor, intensityText, regionList, pointNotes };
})();
