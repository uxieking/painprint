/* PAINPRINT – application: camera, input (touch/mouse/pen), tools, panel, dialogs. */
(function () {
  'use strict';
  const PP = window.PP, G = PP.geom, B = PP.body, R = PP.render, S = PP.store, RP = PP.report;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const V = PP.vocab, X = PP.exchange;
  const TOOL_NAMES = { nav: 'Navigate', draw: 'Brush', area: 'Area', arrow: 'Arrow', erase: 'Eraser' };

  const ICONS = {
    hand: 'M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
    pen: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
    area: 'M12 4c5 0 9 2.7 9 6.5S17 17 12 17c-1.7 0-3.3-.3-4.6-.9M5 14.5C3.7 13.4 3 12 3 10.5 3 6.7 7 4 12 4M7.4 16.1A2.5 2.5 0 1 1 5 14.5M6 19c0 1.2.5 2 1.5 2.5',
    arrow: 'M5 19 19 5M9 5h10v10',
    eraser: 'm7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21M22 21H7M5 11l9 9',
    undo: 'M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13',
    redo: 'M21 7v6h-6M3 17a9 9 0 0 1 15-6.7l3 2.7',
    trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
    fit: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
    eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    eyeoff: 'M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M14.1 14.1a3 3 0 1 1-4.2-4.2',
    report: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    menu: 'M5 12h.01M12 12h.01M19 12h.01',
    edit: 'M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z',
    back: 'M19 12H5M12 19l-7-7 7-7',
    chev: 'm18 15-6-6-6 6',
  };
  const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"${n === 'menu' ? ' style="stroke-width:3.2"' : ''}><path d="${ICONS[n]}"/></svg>`;
  $$('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));

  // ---------- state ----------
  S.load();
  const ui = { tool: 'nav', lastDrawTool: 'draw', typeId: S.data.painTypes[0].id, brushPx: 10, region: null, penSeen: false, space: false, panelCollapsed: false };
  try {
    const saved = JSON.parse(localStorage.getItem('painprint.ui') || '{}');
    if (saved.brushPx) ui.brushPx = saved.brushPx;
    if (saved.typeId && S.data.painTypes.some((t) => t.id === saved.typeId)) ui.typeId = saved.typeId;
    if (saved.lastDrawTool) ui.lastDrawTool = saved.lastDrawTool;
  } catch (e) { /* storage unavailable */ }
  const saveUI = () => { try { localStorage.setItem('painprint.ui', JSON.stringify({ brushPx: ui.brushPx, typeId: ui.typeId, lastDrawTool: ui.lastDrawTool })); } catch (e) { /* ignore */ } };

  // ---------- DOM ----------
  const stage = $('#stage'), world = $('#world');
  const brushCursor = $('#brushCursor'), hoverPill = $('#hoverPill'), badge = $('#modeBadge');

  function buildWorld() {
    let h = '';
    for (const view of B.VIEWS) {
      h += `<g class="view" data-view="${view}" transform="translate(${B.OFF[view]} 0)">${B.bodySVG(view)}<g class="marks" data-marks="${view}"></g></g>`;
    }
    h += '<g id="liveLayer"></g>';
    world.innerHTML = h;
  }
  buildWorld();
  const liveLayer = $('#liveLayer');
  const regionEls = new Map($$('.region', world).map((el) => [el.dataset.region, el]));

  // ---------- camera ----------
  // World units → screen px: screen = world * s + t. Drawings are stored in world
  // (body) units, so they stay aligned at every zoom level and window size.
  const cam = { s: 1, tx: 0, ty: 0 };
  let size = { w: 0, h: 0 }, fitS = 1, stageRect = stage.getBoundingClientRect(), anim = null;

  const camForRect = (r, pad) => {
    const s = Math.min((size.w - 2 * pad) / r.w, (size.h - 2 * pad) / r.h);
    return { s, tx: size.w / 2 - (r.x + r.w / 2) * s, ty: size.h / 2 - (r.y + r.h / 2) * s };
  };
  const clampS = (s) => Math.max(fitS * 0.5, Math.min(fitS * 80, s));
  function applyCam() {
    world.setAttribute('transform', `matrix(${cam.s} 0 0 ${cam.s} ${cam.tx} ${cam.ty})`);
    $('#zoomLabel').textContent = Math.round((cam.s / fitS) * 100) + '%';
    updateCursorSize();
  }
  function stopAnim() { if (anim) cancelAnimationFrame(anim.raf); anim = null; }
  function animateTo(t, ms = 280) {
    stopAnim();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 0;
    const from = { ...cam }, start = performance.now();
    const step = (now) => {
      const k = ms ? Math.min(1, (now - start) / ms) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      // interpolate scale logarithmically, keep the screen centre on a straight path
      const s = from.s * Math.pow(t.s / from.s, e);
      const c0 = [(size.w / 2 - from.tx) / from.s, (size.h / 2 - from.ty) / from.s];
      const c1 = [(size.w / 2 - t.tx) / t.s, (size.h / 2 - t.ty) / t.s];
      const c = [c0[0] + (c1[0] - c0[0]) * e, c0[1] + (c1[1] - c0[1]) * e];
      cam.s = s; cam.tx = size.w / 2 - c[0] * s; cam.ty = size.h / 2 - c[1] * s;
      applyCam();
      if (k < 1) anim.raf = requestAnimationFrame(step); else anim = null;
    };
    anim = { raf: requestAnimationFrame(step) };
  }
  const regionRect = (id) => {
    const r = B.byId[id], bb = r.bbox, pad = Math.max(bb.w, bb.h) * 0.28 + 6;
    return { x: bb.x + B.OFF[r.view] - pad, y: bb.y - pad, w: bb.w + 2 * pad, h: bb.h + 2 * pad };
  };
  const fitTarget = () => (ui.region ? camForRect(regionRect(ui.region), 20) : camForRect(B.WORLD, 16));
  function zoomAt(px, py, f) {
    const s = clampS(cam.s * f);
    const wx = (px - cam.tx) / cam.s, wy = (py - cam.ty) / cam.s;
    cam.s = s; cam.tx = px - wx * s; cam.ty = py - wy * s;
    applyCam();
  }
  function onResize() {
    const r = stage.getBoundingClientRect();
    stageRect = r;
    if (!r.width || !r.height) return;
    const old = size, oldFit = fitS;
    size = { w: r.width, h: r.height };
    fitS = camForRect(B.WORLD, 16).s;
    if (!old.w) { Object.assign(cam, fitTarget()); applyCam(); return; }
    // keep the same world point centred and the same relative zoom
    const cx = (old.w / 2 - cam.tx) / cam.s, cy = (old.h / 2 - cam.ty) / cam.s;
    cam.s = (cam.s / oldFit) * fitS;
    cam.tx = size.w / 2 - cx * cam.s; cam.ty = size.h / 2 - cy * cam.s;
    applyCam();
  }
  new ResizeObserver(onResize).observe(stage);

  // ---------- coordinate helpers ----------
  const clientToWorld = (cx, cy) => [(cx - stageRect.left - cam.tx) / cam.s, (cy - stageRect.top - cam.ty) / cam.s];
  const viewAt = (wx) => (wx < B.OFF.back - 30 ? 'front' : 'back');
  const toLocal = (w, view) => [w[0] - B.OFF[view], w[1]];

  // ---------- region selection ----------
  function selectRegion(id) {
    ui.region = id;
    stage.classList.toggle('focus', !!id);
    regionEls.forEach((el, rid) => el.classList.toggle('selected', rid === id));
    const reg = id && B.byId[id];
    $('#crumbRegion').textContent = reg ? `${reg.name} · ${B.VIEW_NAMES[reg.view].toLowerCase()}` : '';
    $('#crumbSep').hidden = !reg;
    $('.crumbs').classList.toggle('in-region', !!reg);
    $('#regionSelect').value = id || '';
    animateTo(fitTarget());
    updateBadge();
  }
  function buildRegionSelect() {
    const sel = $('#regionSelect');
    let h = '<option value="">Select region …</option>';
    for (const view of B.VIEWS) {
      h += `<optgroup label="${B.VIEW_NAMES[view]}">` + B.byView[view].slice().sort((a, b) => a.name.localeCompare(b.name, 'en'))
        .map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('') + '</optgroup>';
    }
    sel.innerHTML = h;
    sel.addEventListener('change', () => selectRegion(sel.value || null));
  }
  buildRegionSelect();
  $('#btnOverview').addEventListener('click', () => selectRegion(null));

  // ---------- tools ----------
  const isDrawTool = (t) => t === 'draw' || t === 'area' || t === 'arrow' || t === 'erase';
  function setTool(t) {
    ui.tool = t;
    if (isDrawTool(t)) { ui.lastDrawTool = t; saveUI(); }
    $$('#tools .tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
    stage.className = stage.className.replace(/\btool-\w+/g, '').trim() + ' tool-' + t;
    if (!isDrawTool(t)) hideCursor();
    updateBadge();
    updateCursorSize();
  }
  $$('#tools .tool').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  badge.addEventListener('click', () => setTool(ui.tool === 'nav' ? ui.lastDrawTool : 'nav'));
  function updateBadge() {
    const t = S.typeById(ui.typeId);
    const nav = ui.tool === 'nav';
    badge.classList.toggle('drawing', !nav);
    badge.style.setProperty('--c', nav ? 'var(--muted)' : ui.tool === 'erase' ? 'var(--text)' : t.color);
    const what = ui.tool === 'erase' ? 'Eraser' : `${TOOL_NAMES[ui.tool]} · ${esc(t.label)}`;
    badge.innerHTML = nav
      ? `<span class="dot"></span>Navigating <small>– tap to draw</small>`
      : `<span class="dot"></span>${what} <small>– tap to navigate</small>`;
    badge.title = nav ? 'Switch to drawing mode' : 'Switch to navigation (pan/zoom without drawing)';
  }

  function renderPalette() {
    const pal = $('#typePalette');
    pal.innerHTML = S.data.painTypes.map((t) =>
      `<button class="type-btn" role="radio" aria-checked="${t.id === ui.typeId}" data-type="${t.id}" style="--c:${t.color}" title="${esc(t.label)}"><span class="sw"></span><span class="lbl">${esc(t.label)}</span></button>`
    ).join('') + `<button class="type-btn edit" id="btnEditTypes" title="Edit pain types" aria-label="Edit pain types">${icon('edit')}</button>`;
    $$('[data-type]', pal).forEach((b) => b.addEventListener('click', () => {
      ui.typeId = b.dataset.type; saveUI(); renderPalette(); updateBadge(); updateCursorSize();
      if (ui.tool === 'nav' || ui.tool === 'erase') setTool(ui.lastDrawTool === 'erase' ? 'draw' : ui.lastDrawTool);
    }));
    $('#btnEditTypes').addEventListener('click', openTypesDialog);
  }

  const brush = $('#brush');
  brush.value = ui.brushPx;
  brush.addEventListener('input', () => { ui.brushPx = +brush.value; saveUI(); updateCursorSize(); });
  function updateCursorSize() {
    const t = S.typeById(ui.typeId);
    const dot = $('#brushDot');
    dot.style.setProperty('--d', Math.min(26, ui.brushPx) + 'px');
    dot.style.setProperty('--c', t.color);
    const d = cursorDiameter();
    brushCursor.style.width = brushCursor.style.height = d + 'px';
    brushCursor.style.setProperty('--c', t.color);
    brushCursor.classList.toggle('erase', ui.tool === 'erase');
  }
  const eraserPx = () => Math.max(16, ui.brushPx * 1.6);
  const cursorDiameter = () => (ui.tool === 'erase' ? eraserPx() : ui.tool === 'draw' ? ui.brushPx : 8);

  // ---------- markings rendering ----------
  function renderMarks() {
    const opts = { activeId: S.data.activeEntryId, dimInactive: true };
    for (const view of B.VIEWS) $(`[data-marks="${view}"]`).innerHTML = R.marksSVG(view, S.data.entries, opts);
    const marked = new Set();
    for (const e of S.data.entries) if (e.visible !== false) for (const sh of e.shapes) for (const r of sh.regions || []) if (r.coverage >= 0.05) marked.add(r.id);
    regionEls.forEach((el, id) => el.classList.toggle('has-marks', marked.has(id)));
  }

  // ---------- input handling ----------
  // Rules that prevent accidental markings:
  //  • Navigation mode never draws: drag = pan, pinch/wheel = zoom, tap = select region.
  //  • In drawing modes a second finger immediately cancels the stroke in progress and becomes a pinch/pan.
  //  • After a multi-touch gesture nothing draws until all fingers are lifted.
  //  • Once a stylus has been used, finger touches only navigate (palm rejection).
  //  • Middle/right mouse button or holding Space always pans.
  const pointers = new Map();
  let gesture = null, lock = false, hoverRegionId = null;

  function ensureActiveEntry() {
    let e = S.activeEntry();
    if (!e) { e = S.createEntry(); renderEntries(); renderEditor(); }
    return e;
  }

  function strokeWidthFor(tool) {
    const s = cam.s;
    if (tool === 'draw') return ui.brushPx / s;
    if (tool === 'arrow') return Math.max(2, Math.min(ui.brushPx, 12)) / s;
    return Math.max(1.5, ui.brushPx * 0.2) / s; // area outline
  }

  function startStroke(e) {
    const w = clientToWorld(e.clientX, e.clientY);
    const view = viewAt(w[0]);
    if (ui.tool === 'erase') {
      const entry = S.activeEntry();
      if (!entry) { toast('No active entry to erase in'); gesture = { kind: 'noop', id: e.pointerId }; return; }
      gesture = { kind: 'erase', id: e.pointerId, snap: S.snapshot(), changed: false, last: w };
      eraseSegment(w, w);
      return;
    }
    ensureActiveEntry();
    gesture = {
      kind: 'draw', id: e.pointerId, tool: ui.tool, view, typeId: ui.typeId,
      pts: [toLocal(w, view)], lastC: [e.clientX, e.clientY], width: strokeWidthFor(ui.tool),
    };
    liveLayer.setAttribute('transform', `translate(${B.OFF[view]} 0)`);
    renderLive();
  }

  function liveShape(g) {
    const kind = g.tool === 'draw' ? 'stroke' : g.tool;
    return { kind, width: g.width, points: g.pts, view: g.view };
  }
  function renderLive() {
    const g = gesture;
    if (!g || g.kind !== 'draw') { liveLayer.innerHTML = ''; return; }
    const color = S.typeById(g.typeId).color;
    let sh = liveShape(g);
    if (g.tool === 'arrow' && g.pts.length < 2) sh = { ...sh, kind: 'stroke' };
    liveLayer.innerHTML = R.shapeSVG(sh, color, 1);
  }

  function addPoint(cx, cy) {
    const g = gesture;
    if (Math.hypot(cx - g.lastC[0], cy - g.lastC[1]) < 1.2) return false;
    g.lastC = [cx, cy];
    g.pts.push(toLocal(clientToWorld(cx, cy), g.view));
    return true;
  }

  function abortStroke() {
    if (!gesture) return;
    if (gesture.kind === 'draw') liveLayer.innerHTML = '';
    if (gesture.kind === 'erase' && gesture.changed) { S.restore(gesture.snap); renderMarks(); renderEntries(); renderEditorMeta(); }
    gesture = null;
  }

  function commitStroke() {
    const g = gesture;
    gesture = null;
    liveLayer.innerHTML = '';
    const s = cam.s;
    let pts = g.pts.map((p) => [G.r2(p[0]), G.r2(p[1])]);
    let kind = g.tool === 'draw' ? 'stroke' : g.tool;
    if (kind === 'stroke') pts = G.simplify(pts, 0.35 / s);
    if (kind === 'area') {
      if (pts.length < 3 || G.polyArea(pts) < Math.pow(10 / s, 2)) { toast('Outline an area by drawing around it'); return; }
      pts = G.simplify(pts, 0.6 / s);
    }
    if (kind === 'arrow') {
      if (G.pathLength(pts) < 14 / s) { toast('Drag to draw an arrow in the direction the pain radiates'); return; }
      const straight = G.simplify(pts, 6 / s);
      pts = straight.length === 2 ? straight : G.simplify(pts, 1 / s);
    }
    const shape = B.tagShape({
      id: S.uid('s'), kind, view: g.view, typeId: g.typeId, width: G.r2(g.width),
      points: pts, createdAt: S.nowISO(),
    });
    S.mutate(() => {
      const entry = ensureActiveEntry();
      entry.shapes.push(shape);
      S.touch(entry);
    });
  }

  // Eraser: removes the parts of freehand strokes it touches, and whole areas/arrows.
  function eraseSegment(a, b) {
    const entry = S.activeEntry();
    if (!entry) return;
    const r = eraserPx() / 2 / cam.s;
    const steps = Math.max(1, Math.ceil(G.dist(a, b) / (r / 2)));
    let changed = false;
    for (let i = 0; i <= steps; i++) {
      const p = [a[0] + ((b[0] - a[0]) * i) / steps, a[1] + ((b[1] - a[1]) * i) / steps];
      const next = [];
      for (const sh of entry.shapes) {
        const lp = toLocal(p, sh.view);
        const rr = r + (sh.width || 0) / 2;
        const bb = G.bbox(sh.points);
        if (lp[0] < bb.x - rr - 20 || lp[0] > bb.x + bb.w + rr + 20 || lp[1] < bb.y - rr - 20 || lp[1] > bb.y + bb.h + rr + 20) { next.push(sh); continue; }
        if (sh.kind === 'area') {
          if (G.pointInPoly(lp, sh.points) || G.distToPolyline(lp, sh.points, true) < rr) { changed = true; continue; }
          next.push(sh); continue;
        }
        if (sh.kind === 'arrow') {
          if (G.distToPolyline(lp, sh.points) < rr + sh.width * 2) { changed = true; continue; }
          next.push(sh); continue;
        }
        // stroke: split
        if (G.distToPolyline(lp, sh.points) >= rr) { next.push(sh); continue; }
        changed = true;
        const dense = G.densify(sh.points, Math.max(rr / 3, 0.15));
        let run = [];
        const flush = () => {
          if (run.length) next.push(B.tagShape({ ...sh, id: S.uid('s'), points: G.simplify(run, rr * 0.03).map((q) => [G.r2(q[0]), G.r2(q[1])]) }));
          run = [];
        };
        for (const q of dense) { if (G.dist(q, lp) < rr) flush(); else run.push(q); }
        flush();
      }
      entry.shapes = next;
    }
    if (changed) {
      gesture.changed = true;
      S.touch(entry);
      renderMarks();
    }
  }
  function finishErase() {
    const g = gesture;
    gesture = null;
    if (g.changed) { S.pushUndo(g.snap); S.changed(); }
  }

  function startPinch() {
    const [a, b] = [...pointers.values()];
    const m = [(a.x + b.x) / 2, (a.y + b.y) / 2];
    gesture = { kind: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), s0: cam.s, w: clientToWorld(m[0], m[1]) };
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button > 2) return;
    stopAnim();
    stageRect = stage.getBoundingClientRect();
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (e.pointerType === 'pen') ui.penSeen = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size >= 2) { abortStroke(); startPinch(); lock = true; hideCursor(); return; }
    const navLike = ui.tool === 'nav' || e.button === 1 || e.button === 2 || ui.space || lock || (e.pointerType === 'touch' && ui.penSeen);
    if (navLike) {
      gesture = { kind: 'pan', id: e.pointerId, sx: e.clientX, sy: e.clientY, tx: cam.tx, ty: cam.ty, t: performance.now(), moved: false, tap: e.button === 0 };
      stage.classList.add('panning');
      return;
    }
    if (e.button !== 0) return;
    startStroke(e);
  });

  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch') moveCursor(e);
    if (!pointers.has(e.pointerId)) { if (e.pointerType !== 'touch') updateHover(e.clientX, e.clientY); return; }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    if (gesture.kind === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const m = [(a.x + b.x) / 2 - stageRect.left, (a.y + b.y) / 2 - stageRect.top];
      cam.s = clampS(gesture.s0 * (d / gesture.d0));
      cam.tx = m[0] - gesture.w[0] * cam.s;
      cam.ty = m[1] - gesture.w[1] * cam.s;
      applyCam();
    } else if (gesture.kind === 'pan' && gesture.id === e.pointerId) {
      const dx = e.clientX - gesture.sx, dy = e.clientY - gesture.sy;
      if (Math.hypot(dx, dy) > 6) gesture.moved = true;
      if (gesture.moved) { cam.tx = gesture.tx + dx; cam.ty = gesture.ty + dy; applyCam(); }
    } else if (gesture.kind === 'draw' && gesture.id === e.pointerId) {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      let added = false;
      for (const ev of evs.length ? evs : [e]) added = addPoint(ev.clientX, ev.clientY) || added;
      if (added) renderLive();
      updateHover(e.clientX, e.clientY);
    } else if (gesture.kind === 'erase' && gesture.id === e.pointerId) {
      const w = clientToWorld(e.clientX, e.clientY);
      eraseSegment(gesture.last, w);
      gesture.last = w;
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    const g = gesture;
    if (g) {
      if (g.kind === 'draw' && g.id === e.pointerId) {
        if (e.type === 'pointercancel') abortStroke(); else commitStroke();
      } else if (g.kind === 'erase' && g.id === e.pointerId) {
        finishErase();
      } else if (g.kind === 'noop' && g.id === e.pointerId) {
        gesture = null;
      } else if (g.kind === 'pan' && g.id === e.pointerId) {
        if (g.tap && !g.moved && e.type !== 'pointercancel' && performance.now() - g.t < 500 && ui.tool === 'nav') handleTap(e.clientX, e.clientY);
        gesture = null;
      } else if (g.kind === 'pinch') {
        if (pointers.size >= 2) startPinch();
        else if (pointers.size === 1) {
          const [id, p] = [...pointers.entries()][0];
          gesture = { kind: 'pan', id, sx: p.x, sy: p.y, tx: cam.tx, ty: cam.ty, t: 0, moved: true, tap: false };
        }
      }
    }
    if (!pointers.size) { gesture = null; lock = false; stage.classList.remove('panning'); }
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') { hideCursor(); setHover(null); } });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    stopAnim();
    stageRect = stage.getBoundingClientRect();
    const px = e.clientX - stageRect.left, py = e.clientY - stageRect.top;
    const isMouseWheel = e.deltaMode === 1 || (Math.abs(e.deltaY) >= 40 && e.deltaX === 0 && Number.isInteger(e.deltaY));
    if (e.ctrlKey || isMouseWheel) {
      const k = e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0018;
      zoomAt(px, py, Math.exp(-e.deltaY * k));
    } else {
      cam.tx -= e.deltaX; cam.ty -= e.deltaY; applyCam();
    }
  }, { passive: false });

  function handleTap(cx, cy) {
    const w = clientToWorld(cx, cy);
    const view = viewAt(w[0]);
    const lp = toLocal(w, view);
    // Tapping a marking of another entry makes that entry active
    const hitEntry = S.data.entries.find((en) => en.visible !== false && en.id !== S.data.activeEntryId && en.shapes.some((sh) => {
      if (sh.view !== view) return false;
      const tol = 8 / cam.s + (sh.width || 0) / 2;
      return sh.kind === 'area' ? G.pointInPoly(lp, sh.points) || G.distToPolyline(lp, sh.points, true) < tol : G.distToPolyline(lp, sh.points) < tol;
    }));
    if (hitEntry) { setActive(hitEntry.id); toast(`Selected: ${hitEntry.title}`); return; }
    const reg = B.hitRegion(view, lp[0], lp[1]);
    if (reg) selectRegion(reg.id);
  }

  function setHover(id) {
    if (hoverRegionId === id) return;
    if (hoverRegionId && regionEls.get(hoverRegionId)) regionEls.get(hoverRegionId).classList.remove('hover');
    hoverRegionId = id;
    if (id && ui.tool === 'nav') regionEls.get(id).classList.add('hover');
    hoverPill.hidden = !id;
    if (id) { const r = B.byId[id]; hoverPill.textContent = `${r.name} · ${B.VIEW_NAMES[r.view].toLowerCase()}`; }
  }
  function updateHover(cx, cy) {
    const w = clientToWorld(cx, cy);
    const view = viewAt(w[0]);
    const lp = toLocal(w, view);
    const r = B.hitRegion(view, lp[0], lp[1]);
    setHover(r ? r.id : null);
  }

  function moveCursor(e) {
    const show = ui.tool !== 'nav' && !ui.space && !(gesture && (gesture.kind === 'pan' || gesture.kind === 'pinch'));
    if (!show) { hideCursor(); return; }
    brushCursor.hidden = false;
    stage.classList.add('has-cursor');
    brushCursor.style.left = e.clientX - stageRect.left + 'px';
    brushCursor.style.top = e.clientY - stageRect.top + 'px';
  }
  function hideCursor() { brushCursor.hidden = true; stage.classList.remove('has-cursor'); }

  // Zoom controls
  const zoomCenter = (f) => { stopAnim(); const s = clampS(cam.s * f); const wx = (size.w / 2 - cam.tx) / cam.s, wy = (size.h / 2 - cam.ty) / cam.s; animateTo({ s, tx: size.w / 2 - wx * s, ty: size.h / 2 - wy * s }, 180); };
  $('#zoomIn').addEventListener('click', () => zoomCenter(1.5));
  $('#zoomOut').addEventListener('click', () => zoomCenter(1 / 1.5));
  $('#zoomFit').addEventListener('click', () => animateTo(fitTarget()));

  // Undo / redo / clear
  $('#btnUndo').addEventListener('click', () => S.undo());
  $('#btnRedo').addEventListener('click', () => S.redo());
  $('#btnClear').addEventListener('click', async () => {
    const entry = S.activeEntry();
    const total = S.data.entries.reduce((n, e) => n + e.shapes.length, 0);
    if (!total) { toast('There are no drawings to clear'); return; }
    const buttons = [{ value: 'cancel', label: 'Cancel' }];
    if (ui.region) buttons.push({ value: 'region', label: 'Only this region' });
    if (entry && entry.shapes.length) buttons.push({ value: 'active', label: `Only “${entry.title}”` });
    buttons.push({ value: 'all', label: 'All drawings', cls: 'danger-fill' });
    const v = await modal({
      title: 'Clear drawings',
      body: `<p>What do you want to clear? Entries (intensity, symptoms, etc.) are kept. You can undo afterwards.</p>`,
      buttons,
    });
    if (v === 'active') S.mutate(() => { entry.shapes = []; S.touch(entry); });
    else if (v === 'region') S.mutate(() => { S.data.entries.forEach((e) => { const n = e.shapes.length; e.shapes = e.shapes.filter((sh) => sh.primaryRegion !== ui.region); if (n !== e.shapes.length) S.touch(e); }); });
    else if (v === 'all') S.mutate(() => { S.data.entries.forEach((e) => { if (e.shapes.length) { e.shapes = []; S.touch(e); } }); });
  });

  // Keyboard
  const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  window.addEventListener('keydown', (e) => {
    if (typing(e.target) || $('#dlg').open) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? S.redo() : S.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); S.redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); if (!ui.space) { ui.space = true; stage.classList.add('tool-nav'); hideCursor(); } return; }
    const map = { v: 'nav', n: 'nav', b: 'draw', a: 'area', r: 'arrow', e: 'erase' };
    if (map[k]) setTool(map[k]);
    else if (k === '+' || k === '=') zoomCenter(1.5);
    else if (k === '-') zoomCenter(1 / 1.5);
    else if (k === '0') animateTo(fitTarget());
    else if (e.key === 'Escape') { if (!$('#menu').hidden) closeMenu(); else selectRegion(null); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === ' ' && ui.space) { ui.space = false; setTool(ui.tool); }
  });

  // ---------- panel: entries ----------
  function setActive(id) {
    S.data.activeEntryId = id;
    S.save();
    renderEntries(); renderEditor(); renderMarks();
  }

  function renderEntries() {
    const list = $('#entryList');
    const entries = S.data.entries;
    if (!entries.length) {
      list.innerHTML = `<li class="empty"><b>No entries yet.</b><br>Select a region on the body, switch to <b>Brush</b> and mark where it hurts. Each pain can have its own entry with intensity and symptoms.<br><button type="button" class="btn small" id="btnDemoEmpty" style="margin-top:10px">Load sample patient</button></li>`;
      $('#btnDemoEmpty').addEventListener('click', loadDemo);
      return;
    }
    list.innerHTML = entries.map((e, i) => {
      const types = [...new Set(e.shapes.map((s) => s.typeId))].map((id) => S.typeById(id).color);
      const regs = RP.regionList(e).slice(0, 2).map((r) => r.name).join(', ');
      return `<li class="entry${e.id === S.data.activeEntryId ? ' active' : ''}${e.visible === false ? ' hidden-entry' : ''}" data-id="${e.id}" tabindex="0" aria-current="${e.id === S.data.activeEntryId}">
        <span class="num">${i + 1}</span>
        <div class="info"><strong>${esc(e.title || 'Untitled')}</strong><small>${esc(regs || 'No drawing yet')}</small></div>
        <span class="dots">${types.map((c) => `<i style="--c:${c}"></i>`).join('')}</span>
        <span class="int" style="--ic:${RP.intensityColor(e.intensity)}" title="Intensity">${e.intensity}</span>
        <button class="vis" data-vis="${e.id}" title="${e.visible === false ? 'Show' : 'Hide'} on map" aria-label="${e.visible === false ? 'Show' : 'Hide'} entry">${icon(e.visible === false ? 'eyeoff' : 'eye')}</button>
      </li>`;
    }).join('');
    $$('.entry', list).forEach((li) => {
      li.addEventListener('click', (ev) => { if (!ev.target.closest('.vis')) setActive(li.dataset.id); });
      li.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') setActive(li.dataset.id); });
    });
    $$('[data-vis]', list).forEach((b) => b.addEventListener('click', () => {
      const e = S.data.entries.find((x) => x.id === b.dataset.vis);
      e.visible = e.visible === false;
      S.save(); renderEntries(); renderMarks();
    }));
  }

  $('#btnNewEntry').addEventListener('click', () => {
    S.mutate(() => S.createEntry());
    renderEditor();
    if (ui.tool === 'nav') toast('New entry created – select a region and start drawing');
    if (ui.panelCollapsed) togglePanel();
  });

  // Chip groups store codes; codes from imported files that are not in the vocabulary are still shown.
  const chipGroup = (field, legend, selected, single) => {
    const sel = Array.isArray(selected) ? selected : selected ? [selected] : [];
    const opts = V[field].concat(sel.filter((c) => !V[field].some((o) => o.code === c)).map((c) => ({ code: c, label: c })));
    return `<fieldset class="chips" data-field="${field}"${single ? ' data-single="1"' : ''}><legend>${legend}</legend>
      ${opts.map((o) => `<button type="button" class="chip" aria-pressed="${sel.includes(o.code)}" data-val="${esc(o.code)}">${esc(o.label)}</button>`).join('')}
    </fieldset>`;
  };

  function renderEditor() {
    const ed = $('#editor');
    const e = S.activeEntry();
    ed.dataset.for = e ? e.id : '';
    if (!e) { ed.innerHTML = ''; return; }
    ed.innerHTML = `
      <label class="fld"><span>Entry name</span><input type="text" id="edTitle" value="${esc(e.title)}" maxlength="80"></label>
      <div class="fld" style="--ic:${RP.intensityColor(e.intensity)}" id="edIntWrap">
        <span>Pain intensity (0–10)</span>
        <div class="int-row"><span class="int-val" id="edIntVal">${e.intensity}</span><span class="int-txt" id="edIntTxt">${RP.intensityText(e.intensity)}</span></div>
        <input type="range" class="int-range" id="edInt" min="0" max="10" step="1" value="${e.intensity}" aria-label="Pain intensity">
        <div class="int-scale"><span>0 No pain</span><span>10 Worst imaginable</span></div>
      </div>
      ${chipGroup('sensations', 'What does the pain feel like?', e.sensations)}
      ${chipGroup('duration', 'How long does it last?', e.duration, true)}
      ${chipGroup('triggers', 'Triggered or worsened by', e.triggers)}
      ${chipGroup('associatedSymptoms', 'Associated symptoms', e.associatedSymptoms)}
      ${chipGroup('dailyImpact', 'Affects daily life', e.dailyImpact)}
      <label class="fld"><span>Describe it in your own words</span><textarea id="edSymNotes" placeholder="E.g. radiates down my calf when I sit for a long time">${esc(e.symptomNotes)}</textarea></label>
      <label class="fld"><span>When did the pain start?</span><input type="datetime-local" id="edOnset" value="${esc(e.onset)}"></label>
      <label class="fld"><span>Notes</span><textarea id="edNotes">${esc(e.notes)}</textarea></label>
      <div id="edMeta"></div>
      <button type="button" class="btn danger" id="edDelete">${icon('trash')}Delete entry</button>`;

    const changed = () => { S.touch(e); S.save(); renderEntries(); renderEditorMeta(); };
    $('#edTitle').addEventListener('input', (ev) => { e.title = ev.target.value; changed(); });
    $('#edInt').addEventListener('input', (ev) => {
      e.intensity = +ev.target.value;
      $('#edIntVal').textContent = e.intensity;
      $('#edIntTxt').textContent = RP.intensityText(e.intensity);
      $('#edIntWrap').style.setProperty('--ic', RP.intensityColor(e.intensity));
      changed();
    });
    $$('.chips', ed).forEach((fs) => fs.addEventListener('click', (ev) => {
      const b = ev.target.closest('.chip');
      if (!b) return;
      const field = fs.dataset.field, v = b.dataset.val;
      if (fs.dataset.single) {
        e[field] = e[field] === v ? '' : v;
        $$('.chip', fs).forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.val === e[field])));
      } else {
        const arr = e[field];
        const i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else arr.push(v);
        b.setAttribute('aria-pressed', String(i < 0));
      }
      changed();
    }));
    $('#edSymNotes').addEventListener('input', (ev) => { e.symptomNotes = ev.target.value; changed(); });
    $('#edOnset').addEventListener('change', (ev) => { e.onset = ev.target.value; changed(); });
    $('#edNotes').addEventListener('input', (ev) => { e.notes = ev.target.value; changed(); });
    $('#edDelete').addEventListener('click', async () => {
      const v = await modal({
        title: `Delete “${esc(e.title)}”?`,
        body: '<p>The entry and all its drawings will be removed. You can undo with Ctrl+Z or the undo button.</p>',
        buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Delete', cls: 'danger-fill' }],
      });
      if (v !== 'ok') return;
      S.mutate(() => {
        const i = S.data.entries.indexOf(e);
        S.data.entries.splice(i, 1);
        const n = S.data.entries[Math.min(i, S.data.entries.length - 1)];
        S.data.activeEntryId = n ? n.id : null;
      });
      renderEditor();
    });
    renderEditorMeta();
  }

  function renderEditorMeta() {
    const e = S.activeEntry();
    const box = $('#edMeta');
    if (!e || !box) return;
    const regs = RP.regionList(e);
    const fmt = (iso) => new Date(iso).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    box.innerHTML = `
      <div class="fld"><span>Regions</span>
        <div class="reg-chips">${regs.length ? regs.map((r) => `<button type="button" class="reg-chip" data-region="${r.id}">${esc(r.name)}${r.view === 'back' ? ' (back)' : ''}</button>`).join('') : '<small style="color:var(--muted)">Draw on the body to link this entry to a region.</small>'}</div>
      </div>
      ${RP.pointNotes(e).length ? `<div class="fld"><span>Points with their own values</span><ul class="pt-notes">${RP.pointNotes(e).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      <div class="meta"><span>Drawings</span><b>${e.shapes.length}</b><span>Created</span><b>${fmt(e.createdAt)}</b><span>Last changed</span><b>${fmt(e.updatedAt)}</b></div>`;
    $$('.reg-chip', box).forEach((b) => b.addEventListener('click', () => selectRegion(b.dataset.region)));
  }

  // Mobile panel collapse
  function togglePanel() {
    ui.panelCollapsed = !ui.panelCollapsed;
    $('#panel').classList.toggle('collapsed', ui.panelCollapsed);
    $('#panelToggle').setAttribute('aria-expanded', String(!ui.panelCollapsed));
  }
  $('#panelToggle').addEventListener('click', togglePanel);
  if (matchMedia('(max-width: 860px)').matches) togglePanel();

  // ---------- dialogs ----------
  function modal({ title, body, buttons, onOpen }) {
    return new Promise((resolve) => {
      const d = $('#dlg');
      d.innerHTML = `<form method="dialog"><h3>${title}</h3>${body}<div class="dlg-actions">${buttons.map((b) => `<button class="btn ${b.cls || ''}" value="${b.value}">${b.label}</button>`).join('')}</div></form>`;
      d.addEventListener('close', () => resolve(d.returnValue || 'cancel'), { once: true });
      d.returnValue = '';
      d.showModal();
      if (onOpen) onOpen(d);
    });
  }

  function openTypesDialog() {
    const used = (id) => S.data.entries.some((e) => e.shapes.some((s) => s.typeId === id));
    const rows = () => S.data.painTypes.map((t) => `
      <div class="type-row" data-id="${t.id}">
        <input type="color" value="${t.color}" aria-label="Color">
        <input type="text" value="${esc(t.label)}" aria-label="Name" maxlength="40">
        <button type="button" class="btn icon-only small" data-del title="${used(t.id) ? 'In use – cannot be deleted' : 'Delete'}" ${used(t.id) || S.data.painTypes.length < 2 ? 'disabled' : ''}>${icon('trash')}</button>
      </div>`).join('');
    modal({
      title: 'Pain types',
      body: `<p>Each type has its own color on the map and in the report. Changes are saved immediately.</p><div class="type-rows" id="typeRows">${rows()}</div>
        <button type="button" class="btn" id="addType">${icon('plus')}Add type</button>`,
      buttons: [{ value: 'ok', label: 'Done', cls: 'primary' }],
      onOpen(d) {
        const refresh = () => { renderPalette(); renderMarks(); renderEntries(); updateBadge(); updateCursorSize(); S.save(); };
        const wire = () => {
          $$('.type-row', d).forEach((row) => {
            const t = S.data.painTypes.find((x) => x.id === row.dataset.id);
            row.querySelector('[type=color]').addEventListener('input', (ev) => { t.color = ev.target.value; refresh(); });
            row.querySelector('[type=text]').addEventListener('input', (ev) => { t.label = ev.target.value || 'Untitled'; refresh(); });
            row.querySelector('[data-del]').addEventListener('click', () => {
              S.data.painTypes = S.data.painTypes.filter((x) => x !== t);
              if (ui.typeId === t.id) ui.typeId = S.data.painTypes[0].id;
              $('#typeRows', d).innerHTML = rows(); wire(); refresh();
            });
          });
        };
        wire();
        $('#addType', d).addEventListener('click', () => {
          const palette = ['#0ea5e9', '#84cc16', '#f97316', '#a855f7', '#14b8a6', '#ef4444', '#64748b'];
          S.data.painTypes.push({ id: S.uid('t'), label: 'New type', color: palette[S.data.painTypes.length % palette.length] });
          $('#typeRows', d).innerHTML = rows(); wire(); refresh();
          const inputs = $$('.type-row [type=text]', d); inputs[inputs.length - 1].select();
        });
      },
    });
  }

  function openPatientDialog() {
    const p = S.data.patient;
    modal({
      title: 'Patient details',
      body: `<p>Optional. Shown at the top of the report. Stored only on this device.</p>
        <label class="fld"><span>Name</span><input type="text" id="pName" value="${esc(p.name)}" autocomplete="off"></label>
        <label class="fld"><span>Date of birth</span><input type="date" id="pBirth" value="${esc(p.birthDate)}"></label>
        <label class="fld"><span>Message to your clinician</span><textarea id="pNotes">${esc(p.notes)}</textarea></label>`,
      buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Save', cls: 'primary' }],
      onOpen(d) {
        d.addEventListener('close', () => {
          if (d.returnValue !== 'ok') return;
          p.name = $('#pName', d).value.trim(); p.birthDate = $('#pBirth', d).value; p.notes = $('#pNotes', d).value.trim();
          S.save();
        }, { once: true });
      },
    });
  }

  function openHelp() {
    modal({
      title: 'How to use PAINPRINT',
      body: `<ul class="help-list">
        <li><b>Navigate</b> (hand): drag to pan, pinch or scroll to zoom, tap a body part to enlarge it. This mode never draws.</li>
        <li><b>Brush</b>: draw freely where it hurts. <b>Area</b>: outline an area. <b>Arrow</b>: drag in the direction the pain radiates.</li>
        <li>Two fingers always zoom/pan – a stroke in progress is cancelled automatically.</li>
        <li>Once you use a stylus, only the stylus draws; fingers navigate.</li>
        <li>Each <b>entry</b> in the panel is one pain with its own intensity, sensations and symptoms.</li>
        <li><kbd>V</kbd> navigate · <kbd>B</kbd> brush · <kbd>A</kbd> area · <kbd>R</kbd> arrow · <kbd>E</kbd> eraser</li>
        <li>Hold <kbd>Space</kbd> to pan temporarily · <kbd>+</kbd>/<kbd>−</kbd> zoom · <kbd>0</kbd> fit · <kbd>Esc</kbd> full body</li>
        <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> undo · <kbd>Ctrl</kbd>+<kbd>Y</kbd> redo</li>
      </ul>`,
      buttons: [{ value: 'ok', label: 'Lukk', cls: 'primary' }],
    });
  }

  // ---------- sample patient & welcome ----------
  function loadDemo() {
    PP.demo.load();
    renderEditor();
    selectRegion(null);
    toast('Sample patient loaded – tap a body part or open the report');
  }
  function maybeWelcome() {
    let seen = false;
    try { seen = localStorage.getItem('painprint.welcomed') === '1'; } catch (e) { /* ignore */ }
    if (seen || S.data.entries.length) return;
    modal({
      title: 'Welcome to PAINPRINT',
      body: `<p>Show your clinician <b>exactly</b> where it hurts.</p>
        <ol class="help-list">
          <li><b>Tap a body part</b> to zoom in on it.</li>
          <li>Switch to <b>Brush</b>, <b>Area</b> or <b>Arrow</b> and draw where you feel pain – arrows show pain that radiates.</li>
          <li>Rate the <b>intensity</b> and describe how it feels in the panel.</li>
          <li>Open the <b>Report</b> to print or save a PDF for your appointment.</li>
        </ol>
        <p>Everything stays on this device – no account needed.</p>`,
      buttons: [{ value: 'empty', label: 'Start empty' }, { value: 'demo', label: 'Try a sample patient', cls: 'primary' }],
    }).then((v) => {
      try { localStorage.setItem('painprint.welcomed', '1'); } catch (e) { /* ignore */ }
      if (v === 'demo') loadDemo();
    });
  }

  // ---------- menu ----------
  const menu = $('#menu');
  function closeMenu() { menu.hidden = true; $('#btnMenu').setAttribute('aria-expanded', 'false'); }
  $('#btnMenu').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; $('#btnMenu').setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) closeMenu(); });
  menu.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    closeMenu();
    if (act === 'demo') {
      if (S.data.entries.length) {
        const v = await modal({ title: 'Load sample patient?', body: '<p>The sample patient replaces your current entries. You can undo afterwards.</p>', buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Load sample', cls: 'primary' }] });
        if (v !== 'ok') return;
      }
      loadDemo();
    }
    if (act === 'patient') openPatientDialog();
    if (act === 'types') openTypesDialog();
    if (act === 'help') openHelp();
    const download = (text, name) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    if (act === 'export') download(JSON.stringify(X.exportFile(S.data), null, 2), 'painprint');
    if (act === 'backup') download(S.exportJSON(), 'painprint-backup');
    if (act === 'import') $('#fileImport').click();
    if (act === 'reset') {
      const v = await modal({
        title: 'Delete all data?',
        body: '<p>All entries, drawings, pain types and patient details will be deleted from this device. This cannot be undone. Consider exporting first.</p>',
        buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Delete everything', cls: 'danger-fill' }],
      });
      if (v === 'ok') { S.reset(); ui.typeId = S.data.painTypes[0].id; renderPalette(); renderEditor(); updateBadge(); }
    }
  });
  $('#fileImport').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const text = await f.text();
      let json;
      try { json = JSON.parse(text); } catch (err) { throw new Error('The file is not valid JSON.'); }
      const parsed = X.parseImport(json);
      const n = parsed.kind === 'backup' ? parsed.data.entries.length : parsed.entries.length;
      const buttons = [{ value: 'cancel', label: 'Cancel' }];
      if (parsed.kind === 'entries') buttons.push({ value: 'replace', label: 'Replace all' }, { value: 'add', label: 'Add', cls: 'primary' });
      else buttons.push({ value: 'replace', label: 'Restore', cls: 'primary' });
      const v = await modal({
        title: parsed.kind === 'backup' ? 'Restore backup?' : 'Import entries?',
        body: parsed.kind === 'backup'
          ? `<p>“${esc(f.name)}” is a full backup with ${n} ${n === 1 ? 'entry' : 'entries'}. It replaces everything currently in the app.</p>`
          : `<p>“${esc(f.name)}” contains ${n} ${n === 1 ? 'entry' : 'entries'}. Add them to your existing entries, or replace everything?</p>`,
        buttons,
      });
      if (v !== 'add' && v !== 'replace') return;
      const warnings = S.importParsed(parsed, v);
      if (!S.data.painTypes.some((t) => t.id === ui.typeId)) ui.typeId = S.data.painTypes[0].id;
      renderPalette(); renderEditor(); updateBadge();
      if (warnings.length) {
        modal({
          title: 'Imported – please check',
          body: `<p>The data was imported, but some things should be checked:</p><ul class="help-list">${warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`,
          buttons: [{ value: 'ok', label: 'OK', cls: 'primary' }],
        });
      } else toast(`${n} ${n === 1 ? 'entry' : 'entries'} imported`);
    } catch (err) {
      modal({ title: 'Could not import', body: `<p>${esc(err.message)}</p>`, buttons: [{ value: 'ok', label: 'OK' }] });
    }
  });

  // ---------- report ----------
  $('#btnReport').addEventListener('click', () => {
    $('#report').innerHTML = RP.build();
    $('#reportOverlay').hidden = false;
    $('#reportOverlay').scrollTop = 0;
  });
  $('#reportClose').addEventListener('click', () => { $('#reportOverlay').hidden = true; });
  $('#reportPrint').addEventListener('click', () => window.print());

  // ---------- status / toast ----------
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
  S.onStatus((s) => {
    const el = $('#saveStatus');
    el.classList.toggle('error', s === 'error');
    el.textContent = s === 'pending' ? 'Saving…' : s === 'error' ? 'Could not save locally – export your data' : `Saved ${S.lastSaved.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  });
  window.addEventListener('pagehide', () => S.flush());
  document.addEventListener('visibilitychange', () => { if (document.hidden) S.flush(); });

  function updateHistoryButtons() {
    $('#btnUndo').disabled = !S.undoStack.length;
    $('#btnRedo').disabled = !S.redoStack.length;
  }

  S.onChange(() => {
    renderMarks();
    renderEntries();
    if (!$('#editor').dataset.for || $('#editor').dataset.for !== S.data.activeEntryId) renderEditor();
    else renderEditorMeta();
    $('#editor').dataset.for = S.data.activeEntryId || '';
    updateHistoryButtons();
  });

  // ---------- init ----------
  renderPalette();
  setTool('nav');
  renderMarks();
  renderEntries();
  renderEditor();
  $('#editor').dataset.for = S.data.activeEntryId || '';
  updateHistoryButtons();
  maybeWelcome();
  if (!S.storageOk) $('#saveStatus').textContent = 'Local storage unavailable – use export';

  // Expose for debugging/tests
  PP.app = { ui, cam, selectRegion, setTool, clientToWorld };
})();
