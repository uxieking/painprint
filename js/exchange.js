/* PAINPRINT – exchange format ("bodyPoints").
 *
 * One entry:
 *   { id, createdAt, bodyPoints: [{ view, x, y, region, intensity, sensations }],
 *     duration, triggers, associatedSymptoms, dailyImpact, notes }
 * x / y are percent (0–100) of the view's width / height, origin top-left as seen by the viewer.
 * region is a code such as "left_shoulder" (patient's side), unique together with view.
 *
 * Optional extensions written by PAINPRINT so drawings survive a round trip:
 *   entry: title, updatedAt, onset, description, intensity
 *   point: kind ("stroke" | "area" | "arrow"), painType, width (% of view width), path ([[x%, y%], …])
 */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const G = PP.geom, B = PP.body;

  const pctX = (u) => Math.round((u / B.VIEW_W) * 1e5) / 1e3;
  const pctY = (u) => Math.round((u / B.VIEW_H) * 1e5) / 1e3;
  const unitX = (p) => G.r2((p / 100) * B.VIEW_W);
  const unitY = (p) => G.r2((p / 100) * B.VIEW_H);
  const round1 = (v) => Math.round(v * 10) / 10;
  const KINDS = ['stroke', 'area', 'arrow'];
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

  /** The point that best represents a drawing: an arrow's start (pain origin), otherwise the on-shape point nearest its centre. */
  function representativePoint(sh) {
    if (sh.kind === 'arrow' || sh.points.length === 1) return sh.points[0];
    const pts = G.densify(sh.points, 3, sh.kind === 'area');
    if (sh.kind === 'area') return G.centroid(sh.points);
    const c = G.centroid(pts);
    let best = pts[0], bd = Infinity;
    for (const p of pts) { const d = G.dist(p, c); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  function shapeToPoint(sh, entry) {
    const p = representativePoint(sh);
    const reg = sh.primaryRegion && B.byId[sh.primaryRegion];
    return {
      view: sh.view,
      x: round1(pctX(p[0])),
      y: round1(pctY(p[1])),
      region: reg ? reg.code : null,
      intensity: typeof sh.intensity === 'number' ? sh.intensity : entry.intensity,
      sensations: Array.isArray(sh.sensations) ? sh.sensations.slice() : entry.sensations.slice(),
      kind: sh.kind,
      painType: sh.typeId,
      width: pctX(sh.width || 0),
      path: sh.points.map(([x, y]) => [pctX(x), pctY(y)]),
    };
  }

  function entryToDTO(e) {
    return {
      id: e.id,
      createdAt: e.createdAt,
      bodyPoints: e.shapes.map((sh) => shapeToPoint(sh, e)),
      duration: e.duration || null,
      triggers: e.triggers.slice(),
      associatedSymptoms: e.associatedSymptoms.slice(),
      dailyImpact: e.dailyImpact.slice(),
      notes: e.notes,
      // extensions
      title: e.title,
      updatedAt: e.updatedAt,
      onset: e.onset || null,
      description: e.symptomNotes,
      intensity: e.intensity,
    };
  }

  function exportFile(data) {
    return {
      app: 'PAINPRINT',
      format: 'painprint-entries',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      coordinates: 'x/y in percent (0-100) of the view width/height, origin top-left as seen by the viewer. front: viewer-left = patient right; back: viewer-left = patient left.',
      patient: data.patient,
      painTypes: data.painTypes,
      entries: data.entries.map(entryToDTO),
    };
  }

  /** Build an internal entry from an exchange-format entry. Returns { entry, warnings }. */
  function entryFromDTO(dto, ctx) {
    const S = PP.store;
    const warnings = [];
    const e = S.blankEntry();
    if (typeof dto.id === 'string' && dto.id) e.id = dto.id;
    if (dto.createdAt) e.createdAt = dto.createdAt;
    e.updatedAt = dto.updatedAt || dto.createdAt || e.updatedAt;
    e.title = dto.title || '';
    e.onset = dto.onset || '';
    e.notes = typeof dto.notes === 'string' ? dto.notes : '';
    e.symptomNotes = typeof dto.description === 'string' ? dto.description : '';
    e.duration = typeof dto.duration === 'string' ? dto.duration : '';
    e.triggers = arr(dto.triggers);
    e.associatedSymptoms = arr(dto.associatedSymptoms);
    e.dailyImpact = arr(dto.dailyImpact);

    const points = Array.isArray(dto.bodyPoints) ? dto.bodyPoints : [];
    const intensities = [];
    const sens = new Set();
    points.forEach((bp, i) => {
      const label = `${e.title || dto.id || 'Entry'}, point ${i + 1}`;
      if (!bp || !B.OFF.hasOwnProperty(bp.view)) { warnings.push(`${label}: unknown view "${bp && bp.view}" – skipped`); return; }
      let pts;
      if (Array.isArray(bp.path) && bp.path.length) pts = bp.path.filter((q) => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1])).map(([x, y]) => [unitX(x), unitY(y)]);
      else if (isFinite(bp.x) && isFinite(bp.y)) pts = [[unitX(bp.x), unitY(bp.y)]];
      if (!pts || !pts.length) { warnings.push(`${label}: missing coordinates – skipped`); return; }
      const kind = KINDS.includes(bp.kind) ? bp.kind : 'stroke';
      const shape = B.tagShape({
        id: S.uid('s'), kind: kind === 'area' && pts.length < 3 ? 'stroke' : kind, view: bp.view,
        typeId: ctx.typeIds.has(bp.painType) ? bp.painType : ctx.defaultTypeId,
        width: isFinite(bp.width) && bp.width > 0 ? unitX(bp.width) : 8,
        points: pts, createdAt: e.createdAt,
      });
      if (bp.region) {
        const declared = B.byCode(bp.view, bp.region);
        const actual = shape.primaryRegion && B.byId[shape.primaryRegion];
        if (!declared) warnings.push(`${label}: unknown region "${bp.region}"`);
        else if (!actual || actual.id !== declared.id) {
          warnings.push(`${label}: stated region "${bp.region}", but the coordinates (${bp.x}, ${bp.y}) are in "${actual ? actual.code : 'outside the body'}"`);
          shape.reportedRegion = bp.region;
        }
      }
      if (typeof bp.intensity === 'number') { shape.intensity = Math.max(0, Math.min(10, Math.round(bp.intensity))); intensities.push(shape.intensity); }
      if (Array.isArray(bp.sensations)) { shape.sensations = arr(bp.sensations); shape.sensations.forEach((s) => sens.add(s)); }
      e.shapes.push(shape);
    });

    e.intensity = typeof dto.intensity === 'number' ? dto.intensity : intensities.length ? Math.max(...intensities) : 5;
    e.sensations = [...sens];
    // Keep per-point values only where they differ from the entry as a whole
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    for (const sh of e.shapes) {
      if (sh.intensity === e.intensity) delete sh.intensity;
      if (sh.sensations && same(sh.sensations, e.sensations)) delete sh.sensations;
    }
    return { entry: e, warnings };
  }

  /** Detect the kind of JSON the user imported. */
  function parseImport(obj) {
    if (Array.isArray(obj)) return { kind: 'entries', entries: obj };
    if (obj && Array.isArray(obj.bodyPoints)) return { kind: 'entries', entries: [obj] };
    if (obj && Array.isArray(obj.entries) && (obj.format === 'painprint-entries' || obj.entries.some((x) => x && Array.isArray(x.bodyPoints)))) {
      return { kind: 'entries', entries: obj.entries, painTypes: obj.painTypes, patient: obj.patient };
    }
    if (obj && Array.isArray(obj.entries)) return { kind: 'backup', data: obj };
    throw new Error('No PAINPRINT entries found in the file.');
  }

  PP.exchange = { entryToDTO, exportFile, entryFromDTO, parseImport, shapeToPoint };
})();
