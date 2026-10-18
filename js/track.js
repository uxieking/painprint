/* PAINPRINT – Track screen: zoomable glowing body, Front/Back turn-around, drawing tools,
 * pain levels 1–10 and the "Pain details" sheet. */
(function () {
  'use strict';
  const PP = window.PP, G = PP.geom, B = PP.body, R = PP.render, S = PP.store, V = PP.vocab, RP = PP.report;
  const { $, $$, esc, icon, modal, toast, openPopover, emit, toLocalInput, fromLocalInput, fmtDateTime } = PP.ui;

  const TOOL_HINT = {
    draw: 'Draw exactly where it hurts · <b>2 fingers</b> to zoom',
    area: 'Circle the painful area',
    arrow: 'Drag in the direction the pain <b>spreads</b>',
    erase: 'Rub out marks in this entry',
  };
  const SIZES = [{ px: 5, lbl: 'S' }, { px: 10, lbl: 'M' }, { px: 18, lbl: 'L' }];

  const ui = { tool: 'nav', lastDrawTool: 'draw', level: 7, size: 1, region: null, side: 'front', penSeen: false, space: false };
  try {
    const saved = JSON.parse(localStorage.getItem('painprint.track') || '{}');
    if (saved.level >= 1 && saved.level <= 10) ui.level = saved.level;
    if (saved.size >= 0 && saved.size < SIZES.length) ui.size = saved.size;
    if (saved.lastDrawTool) ui.lastDrawTool = saved.lastDrawTool;
  } catch (e) { /* storage unavailable */ }
  const saveUI = () => { try { localStorage.setItem('painprint.track', JSON.stringify({ level: ui.level, size: ui.size, lastDrawTool: ui.lastDrawTool })); } catch (e) { /* ignore */ } };
  const brushPx = () => SIZES[ui.size].px;

  const screen = $('#scr-track'), stage = $('#stage'), world = $('#world'), svg = $('#canvas');
  const brushCursor = $('#brushCursor'), sheet = $('#sheet');

  // ---------- world ----------
  function buildWorld() {
    let h = '';
    for (const view of B.VIEWS) {
      const glow = B.byView[view].map((r) => `<path d="${r.d}"/>`).join('');
      h += `<g class="view" data-view="${view}" transform="translate(${B.OFF[view]} 0)"><g class="body-glow">${glow}</g>${B.bodySVG(view)}<g class="marks glow" data-marks="${view}"></g></g>`;
    }
    world.innerHTML = h + '<g id="liveLayer"></g>';
  }
  buildWorld();
  const liveLayer = $('#liveLayer');
  const regionEls = new Map($$('.region', world).map((el) => [el.dataset.region, el]));

  // ---------- camera ----------
  // World units → screen px: screen = world * s + t. Drawings are stored in body units,
  // so they stay aligned at every zoom level, on every side and every screen size.
  const cam = { s: 1, tx: 0, ty: 0 };
  let size = { w: 0, h: 0 }, fitS = 1, stageRect = stage.getBoundingClientRect(), anim = null;
  const INSET = { l: 10, r: 78, t: 4, b: 118 }; // keep the body clear of the tool rail and bottom controls

  const viewRect = (side) => ({ x: B.OFF[side] - 12, y: -14, w: B.VIEW_W + 24, h: B.VIEW_H + 40 });
  function camForRect(r, ins = INSET) {
    const w = Math.max(40, size.w - ins.l - ins.r), h = Math.max(40, size.h - ins.t - ins.b);
    const s = Math.min(w / r.w, h / r.h);
    return { s, tx: ins.l + w / 2 - (r.x + r.w / 2) * s, ty: ins.t + h / 2 - (r.y + r.h / 2) * s };
  }
  const clampS = (s) => Math.max(fitS * 0.6, Math.min(fitS * 60, s));
  function applyCam() {
    world.setAttribute('transform', `matrix(${cam.s} 0 0 ${cam.s} ${cam.tx} ${cam.ty})`);
    // The glow filter is costly on big rasters – drop it when zoomed far in.
    const glow = cam.s / fitS < 5;
    $$('.marks', world).forEach((g) => g.classList.toggle('glow', glow));
    updateCursorSize();
  }
  function stopAnim() { if (anim) { cancelAnimationFrame(anim.raf); clearTimeout(anim.fallback); } anim = null; }
  function animateTo(t, ms = 300) {
    stopAnim();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) ms = 0;
    const from = { ...cam }, start = performance.now();
    const step = (now) => {
      const k = ms ? Math.min(1, (now - start) / ms) : 1;
      const e = 1 - Math.pow(1 - k, 3);
      const s = from.s * Math.pow(t.s / from.s, e);
      const c0 = [(size.w / 2 - from.tx) / from.s, (size.h / 2 - from.ty) / from.s];
      const c1 = [(size.w / 2 - t.tx) / t.s, (size.h / 2 - t.ty) / t.s];
      const c = [c0[0] + (c1[0] - c0[0]) * e, c0[1] + (c1[1] - c0[1]) * e];
      cam.s = s; cam.tx = size.w / 2 - c[0] * s; cam.ty = size.h / 2 - c[1] * s;
      applyCam();
      if (k < 1) anim.raf = requestAnimationFrame(step); else stopAnim();
    };
    // Fallback: browsers throttle animation frames in background tabs – always land on the target.
    anim = { raf: requestAnimationFrame(step), fallback: setTimeout(() => { if (anim) { stopAnim(); Object.assign(cam, t); applyCam(); } }, ms + 120) };
  }
  const regionRect = (id) => {
    const r = B.byId[id], bb = r.bbox, pad = Math.max(bb.w, bb.h) * 0.3 + 6;
    return { x: bb.x + B.OFF[r.view] - pad, y: bb.y - pad, w: bb.w + 2 * pad, h: bb.h + 2 * pad };
  };
  const fitTarget = () => (ui.region ? camForRect(regionRect(ui.region)) : camForRect(viewRect(ui.side)));
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
    fitS = camForRect(viewRect('front')).s;
    if (!old.w) { Object.assign(cam, fitTarget()); applyCam(); return; }
    const cx = (old.w / 2 - cam.tx) / cam.s, cy = (old.h / 2 - cam.ty) / cam.s;
    cam.s = (cam.s / oldFit) * fitS;
    cam.tx = size.w / 2 - cx * cam.s; cam.ty = size.h / 2 - cy * cam.s;
    applyCam();
  }
  new ResizeObserver(onResize).observe(stage);
  window.addEventListener('resize', onResize);

  const clientToWorld = (cx, cy) => [(cx - stageRect.left - cam.tx) / cam.s, (cy - stageRect.top - cam.ty) / cam.s];
  const toLocal = (w, view) => [w[0] - B.OFF[view], w[1]];

  // ---------- front / back (turn around) ----------
  function counterpart(id) {
    const r = B.byId[id];
    if (!r) return null;
    const other = r.view === 'front' ? 'back' : 'front';
    const same = `${other}.${r.key}${r.side ? '_' + r.side : ''}`;
    if (B.byId[same]) return same;
    return r.group === 'face' || r.group === 'head' ? `${other}.head` : null;
  }
  function showSide(side) {
    ui.side = side;
    $$('.view', world).forEach((g) => g.classList.toggle('off', g.dataset.view !== side));
    $$('#sideSeg button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.side === side)));
  }
  /** Turn the body around: a quick "spin" while the camera mirrors to the same spot on the other side. */
  function turnTo(side) {
    if (side === ui.side) return;
    const doSwap = () => {
      // mirror the current view centre: the patient's left stays the patient's left
      const c = [(size.w / 2 - cam.tx) / cam.s, (size.h / 2 - cam.ty) / cam.s];
      const lx = c[0] - B.OFF[ui.side];
      const nx = B.OFF[side] + (B.VIEW_W - lx);
      const next = ui.region ? counterpart(ui.region) : null;
      showSide(side);
      cam.tx = size.w / 2 - nx * cam.s; cam.ty = size.h / 2 - c[1] * cam.s;
      applyCam();
      setRegion(next, { animate: !!next });
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { doSwap(); return; }
    svg.classList.add('flip-out');
    setTimeout(() => { doSwap(); svg.classList.remove('flip-out'); }, 200);
  }
  $$('#sideSeg button').forEach((b) => b.addEventListener('click', () => turnTo(b.dataset.side)));

  // ---------- regions ----------
  function setRegion(id, { animate = true } = {}) {
    ui.region = id;
    if (id && B.byId[id].view !== ui.side) showSide(B.byId[id].view);
    stage.classList.toggle('focus', !!id);
    regionEls.forEach((el, rid) => el.classList.toggle('selected', rid === id));
    const reg = id && B.byId[id];
    $('#tTitle').textContent = reg ? reg.name : 'Track pain';
    $('#regionSelect').value = id || '';
    if (animate) animateTo(fitTarget());
    updateHint();
  }
  function buildRegionSelect() {
    const sel = $('#regionSelect');
    let h = '<option value="">Full body</option>';
    for (const view of B.VIEWS) {
      h += `<optgroup label="${B.VIEW_NAMES[view]}">` + B.byView[view].slice().sort((a, b) => a.name.localeCompare(b.name, 'en'))
        .map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('') + '</optgroup>';
    }
    sel.innerHTML = h;
    sel.addEventListener('change', () => setRegion(sel.value || null));
  }
  buildRegionSelect();
  $('#tBack').addEventListener('click', () => { if (ui.region) setRegion(null); else emit('go', 'home'); });
  $('#tFit').addEventListener('click', () => animateTo(fitTarget()));

  // ---------- tools, levels, size ----------
  const isDrawTool = (t) => t === 'draw' || t === 'area' || t === 'arrow' || t === 'erase';
  function setTool(t) {
    ui.tool = t;
    if (isDrawTool(t)) { ui.lastDrawTool = t; saveUI(); }
    $$('#tools .tool[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
    stage.className = stage.className.replace(/\btool-\w+/g, '').trim() + ' tool-' + t;
    if (!isDrawTool(t)) hideCursor();
    if (isDrawTool(t)) sheet.classList.remove('open');
    updateHint();
    updateCursorSize();
  }
  $$('#tools .tool[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('#hint').addEventListener('click', () => setTool(ui.tool === 'nav' ? (ui.lastDrawTool === 'erase' ? 'draw' : ui.lastDrawTool) : 'nav'));

  function updateHint() {
    const h = $('#hint');
    if (ui.tool === 'nav') h.innerHTML = ui.region ? 'Tap <b>Draw</b> and mark exactly where it hurts' : 'Tap a body area to zoom in · or tap <b>Draw</b>';
    else h.innerHTML = TOOL_HINT[ui.tool];
    h.title = ui.tool === 'nav' ? 'Switch to drawing' : 'Switch to move & zoom (no drawing)';
  }

  function renderLevels() {
    $('#levels').innerHTML = Array.from({ length: 10 }, (_, i) => 10 - i).map((l) =>
      `<button class="lvl" role="radio" aria-checked="${l === ui.level}" data-level="${l}" style="--c:${V.levelColor(l)}" title="Pain level ${l}/10 – ${V.levelText(l)}" aria-label="Pain level ${l}">${l}</button>`).join('');
  }
  $('#levels').addEventListener('click', (e) => {
    const b = e.target.closest('[data-level]');
    if (!b) return;
    ui.level = +b.dataset.level; saveUI(); renderLevels(); updateCursorSize();
    if (ui.tool === 'nav' || ui.tool === 'erase') setTool(ui.lastDrawTool === 'erase' ? 'draw' : ui.lastDrawTool);
    toast(`Pain level ${ui.level}/10 – ${V.levelText(ui.level)}`, 1200);
  });

  function renderSize() {
    $('#sizeDot').style.setProperty('--d', Math.min(20, SIZES[ui.size].px + 2) + 'px');
    $('#sizeLbl').textContent = SIZES[ui.size].lbl;
  }
  $('#btnSize').addEventListener('click', () => { ui.size = (ui.size + 1) % SIZES.length; saveUI(); renderSize(); updateCursorSize(); });

  const eraserPx = () => Math.max(18, brushPx() * 1.8);
  function updateCursorSize() {
    const d = ui.tool === 'erase' ? eraserPx() : ui.tool === 'draw' ? brushPx() : 8;
    brushCursor.style.width = brushCursor.style.height = d + 'px';
    brushCursor.style.setProperty('--c', V.levelColor(ui.level));
    brushCursor.classList.toggle('erase', ui.tool === 'erase');
  }

  // ---------- marks ----------
  function renderMarks() {
    const opts = { activeId: S.data.activeEntryId, dimInactive: true };
    for (const view of B.VIEWS) $(`[data-marks="${view}"]`, world).innerHTML = R.marksSVG(view, S.data.entries, opts);
  }

  // ---------- input ----------
  // Rules that prevent accidental markings:
  //  • Move mode never draws: drag = pan, pinch/wheel = zoom, tap = zoom into a body area.
  //  • In drawing modes a second finger immediately cancels the stroke and becomes pinch/pan.
  //  • After a multi-touch gesture nothing draws until all fingers are lifted.
  //  • Once a stylus has been used, finger touches only navigate (palm rejection).
  //  • Middle/right mouse button or holding Space always pans.
  const pointers = new Map();
  let gesture = null, lock = false, hoverRegionId = null;

  function ensureActiveEntry() {
    let e = S.activeEntry();
    if (!e) { e = S.createEntry(); renderEntryChip(); renderEditor(); }
    return e;
  }
  function strokeWidthFor(tool) {
    const s = cam.s;
    if (tool === 'draw') return brushPx() / s;
    if (tool === 'arrow') return Math.max(2.5, Math.min(brushPx() * 0.7, 10)) / s;
    return Math.max(1.6, brushPx() * 0.25) / s;
  }
  function startStroke(e) {
    const w = clientToWorld(e.clientX, e.clientY);
    const view = ui.side;
    if (ui.tool === 'erase') {
      if (!S.activeEntry()) { toast('Nothing to erase yet'); gesture = { kind: 'noop', id: e.pointerId }; return; }
      gesture = { kind: 'erase', id: e.pointerId, snap: S.snapshot(), changed: false, last: w };
      eraseSegment(w, w);
      return;
    }
    ensureActiveEntry();
    gesture = { kind: 'draw', id: e.pointerId, tool: ui.tool, view, level: ui.level, pts: [toLocal(w, view)], lastC: [e.clientX, e.clientY], width: strokeWidthFor(ui.tool) };
    liveLayer.setAttribute('transform', `translate(${B.OFF[view]} 0)`);
    renderLive();
  }
  function renderLive() {
    const g = gesture;
    if (!g || g.kind !== 'draw') { liveLayer.innerHTML = ''; return; }
    let kind = g.tool === 'draw' ? 'stroke' : g.tool;
    if (kind === 'arrow' && g.pts.length < 2) kind = 'stroke';
    liveLayer.innerHTML = R.shapeSVG({ kind, width: g.width, points: g.pts }, V.levelColor(g.level), 1);
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
    if (gesture.kind === 'erase' && gesture.changed) { S.restore(gesture.snap); renderMarks(); }
    gesture = null;
  }
  function commitStroke() {
    const g = gesture;
    gesture = null;
    liveLayer.innerHTML = '';
    const s = cam.s;
    let pts = g.pts.map((p) => [G.r2(p[0]), G.r2(p[1])]);
    const kind = g.tool === 'draw' ? 'stroke' : g.tool;
    if (kind === 'stroke') pts = G.simplify(pts, 0.35 / s);
    if (kind === 'area') {
      if (pts.length < 3 || G.polyArea(pts) < Math.pow(10 / s, 2)) { toast('Draw a circle around the painful area'); return; }
      pts = G.simplify(pts, 0.6 / s);
    }
    if (kind === 'arrow') {
      if (G.pathLength(pts) < 14 / s) { toast('Drag in the direction the pain spreads'); return; }
      const straight = G.simplify(pts, 6 / s);
      pts = straight.length === 2 ? straight : G.simplify(pts, 1 / s);
    }
    const shape = B.tagShape({ id: S.uid('s'), kind, view: g.view, level: g.level, typeId: null, width: G.r2(g.width), points: pts, createdAt: S.nowISO() });
    const first = !(S.activeEntry() && S.activeEntry().shapes.length);
    S.mutate(() => {
      const entry = ensureActiveEntry();
      entry.shapes.push(shape);
      S.syncIntensity(entry);
      S.touch(entry);
    });
    if (first) toast('Saved · open “Pain details” below to add when & why', 3200);
  }

  // Eraser: cuts freehand strokes where it touches; removes whole areas/arrows.
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
        if (sh.view !== ui.side) { next.push(sh); continue; }
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
    if (changed) { gesture.changed = true; S.touch(entry); renderMarks(); }
  }
  function finishErase() {
    const g = gesture;
    gesture = null;
    if (g.changed) { S.pushUndo(g.snap); S.syncIntensity(S.activeEntry()); S.changed(); }
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
    sheet.classList.remove('open');
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
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      let added = false;
      for (const ev of evs.length ? evs : [e]) added = addPoint(ev.clientX, ev.clientY) || added;
      if (added) renderLive();
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
      if (g.kind === 'draw' && g.id === e.pointerId) { if (e.type === 'pointercancel') abortStroke(); else commitStroke(); }
      else if (g.kind === 'erase' && g.id === e.pointerId) finishErase();
      else if (g.kind === 'noop' && g.id === e.pointerId) gesture = null;
      else if (g.kind === 'pan' && g.id === e.pointerId) {
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
    if (e.ctrlKey || isMouseWheel) zoomAt(px, py, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.0018)));
    else { cam.tx -= e.deltaX; cam.ty -= e.deltaY; applyCam(); }
  }, { passive: false });

  function handleTap(cx, cy) {
    const lp = toLocal(clientToWorld(cx, cy), ui.side);
    // Tapping a marking of another entry switches to that entry
    const hit = S.data.entries.find((en) => en.visible !== false && en.id !== S.data.activeEntryId && en.shapes.some((sh) => {
      if (sh.view !== ui.side) return false;
      const tol = 8 / cam.s + (sh.width || 0) / 2;
      return sh.kind === 'area' ? G.pointInPoly(lp, sh.points) || G.distToPolyline(lp, sh.points, true) < tol : G.distToPolyline(lp, sh.points) < tol;
    }));
    if (hit) { setActive(hit.id); toast(`Selected: ${hit.title}`); return; }
    const reg = B.hitRegion(ui.side, lp[0], lp[1]);
    if (reg) setRegion(reg.id);
  }
  function setHover(id) {
    if (hoverRegionId === id) return;
    if (hoverRegionId && regionEls.get(hoverRegionId)) regionEls.get(hoverRegionId).classList.remove('hover');
    hoverRegionId = id;
    if (id && ui.tool === 'nav') regionEls.get(id).classList.add('hover');
  }
  function updateHover(cx, cy) {
    const lp = toLocal(clientToWorld(cx, cy), ui.side);
    const r = B.hitRegion(ui.side, lp[0], lp[1]);
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

  $('#btnUndo').addEventListener('click', () => S.undo());
  $('#btnRedo').addEventListener('click', () => S.redo());

  // Keyboard (only while the Track screen is visible)
  const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const zoomCenter = (f) => { const s = clampS(cam.s * f); const wx = (size.w / 2 - cam.tx) / cam.s, wy = (size.h / 2 - cam.ty) / cam.s; animateTo({ s, tx: size.w / 2 - wx * s, ty: size.h / 2 - wy * s }, 180); };
  window.addEventListener('keydown', (e) => {
    if (!screen.classList.contains('active') || typing(e.target) || $('#dlg').open) return;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? S.redo() : S.undo(); return; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); S.redo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); if (!ui.space) { ui.space = true; stage.classList.add('tool-nav'); hideCursor(); } return; }
    const map = { v: 'nav', b: 'draw', a: 'area', r: 'arrow', e: 'erase' };
    if (map[k]) setTool(map[k]);
    else if (/^[0-9]$/.test(k)) { ui.level = k === '0' ? 10 : +k; saveUI(); renderLevels(); updateCursorSize(); }
    else if (k === 'f') turnTo(ui.side === 'front' ? 'back' : 'front');
    else if (k === '+' || k === '=') zoomCenter(1.5);
    else if (k === '-') zoomCenter(1 / 1.5);
    else if (e.key === 'Escape') setRegion(null);
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ' && ui.space) { ui.space = false; setTool(ui.tool); } });

  // ---------- entries ----------
  function setActive(id) {
    S.data.activeEntryId = id;
    S.save();
    renderAll();
  }
  function renderEntryChip() {
    const e = S.activeEntry();
    $('#entryChipText').textContent = e ? e.title : 'New entry';
    $('#entryChip').style.setProperty('--c', e ? V.levelColor(e.intensity) : '#64748b');
  }
  $('#entryChip').addEventListener('click', () => {
    const list = S.data.entries.slice().sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt));
    const html = `<button data-v="__new">${icon('plus')}<span class="pv-main"><b>New entry</b><small>Log a new pain episode now</small></span></button>`
      + (list.length ? '<hr>' : '')
      + list.map((e) => `<button data-v="${e.id}" class="${e.id === S.data.activeEntryId ? 'on' : ''}"><span class="pv-dot" style="--c:${V.levelColor(e.intensity)}"></span><span class="pv-main"><b>${esc(e.title)}</b><small>${fmtDateTime(e.occurredAt)} · ${e.intensity}/10</small></span></button>`).join('');
    openPopover($('#entryChip'), html, (v) => {
      if (v === '__new') newEntry();
      else setActive(v);
    }, 'right');
  });
  function newEntry() {
    S.mutate(() => S.createEntry());
    renderAll();
    setTool(ui.lastDrawTool === 'erase' ? 'draw' : ui.lastDrawTool);
    toast('New entry – choose a pain level and draw where it hurts');
  }

  // ---------- Pain details sheet ----------
  $('#sheetHandle').addEventListener('click', () => {
    sheet.classList.toggle('open');
    $('#sheetHandle').setAttribute('aria-expanded', String(sheet.classList.contains('open')));
  });
  function renderSheetSum() {
    const e = S.activeEntry();
    $('#sheetSum').innerHTML = e ? `${esc(e.title)} · <b style="color:${V.levelColor(e.intensity)}">${e.intensity}/10</b>` : 'Draw to start an entry';
  }

  const chipGroup = (field, legend, selected, opts = {}) => {
    const sel = Array.isArray(selected) ? selected : selected ? [selected] : [];
    const list = V[field].concat(sel.filter((c) => !V[field].some((o) => o.code === c)).map((c) => ({ code: c, label: c })));
    return `<fieldset class="chips${opts.outline ? ' outline' : ''}" data-field="${field}"${opts.single ? ' data-single="1"' : ''}><legend>${legend}</legend>
      ${list.map((o) => `<button type="button" class="chip" aria-pressed="${sel.includes(o.code)}" data-val="${esc(o.code)}">${esc(o.label)}</button>`).join('')}</fieldset>`;
  };

  function renderEditor() {
    const ed = $('#editor');
    const e = S.activeEntry();
    renderSheetSum();
    ed.dataset.for = e ? e.id : '';
    if (!e) {
      ed.innerHTML = `<p class="muted">Pick a pain level on the right, tap <b>Draw</b> and mark where it hurts. Your entry is created automatically – then come back here to add when, why and how it feels.</p>`;
      return;
    }
    const pct = (e.intensity / 10) * 100;
    ed.innerHTML = `
      <label class="fld"><input type="text" class="title-input" id="edTitle" value="${esc(e.title)}" maxlength="80" aria-label="Entry name"></label>
      <div class="fld"><span>When did it happen?</span>
        <div class="now-row"><input type="datetime-local" id="edWhen" value="${toLocalInput(e.occurredAt)}"><button type="button" class="btn" id="edNow">Now</button></div></div>
      <div class="fld" id="edIntWrap" style="--ic:${V.levelColor(e.intensity)};--p:${pct}%">
        <span>Intensity</span>
        <div class="int-row"><span class="int-val" id="edIntVal">${e.intensity}<small>/10</small></span>
          <input type="range" class="int-range" id="edInt" min="0" max="10" step="1" value="${e.intensity}" aria-label="Pain intensity 0 to 10"></div>
        <span class="int-txt" id="edIntTxt">${V.levelText(e.intensity)}${e.intensityManual ? '' : ' · follows the strongest color you drew'}</span>
      </div>
      ${chipGroup('sensations', 'Sensation', e.sensations)}
      ${chipGroup('duration', 'Duration', e.duration, { single: true })}
      ${chipGroup('triggers', 'Possible triggers', e.triggers, { outline: true })}
      <label class="fld"><span>Why? What were you doing?</span><textarea id="edContext" placeholder="E.g. long car drive, carried heavy bags, stressful meeting …">${esc(e.context)}</textarea></label>
      ${chipGroup('associatedSymptoms', 'Other symptoms', e.associatedSymptoms)}
      ${chipGroup('dailyImpact', 'What does it affect?', e.dailyImpact)}
      <label class="fld"><span>Describe it in your own words</span><textarea id="edSymNotes" placeholder="E.g. radiates down my calf when I sit for a long time">${esc(e.symptomNotes)}</textarea></label>
      <label class="fld"><span>When did this problem first start? <span class="help">(optional)</span></span><input type="datetime-local" id="edOnset" value="${esc(e.onset)}"></label>
      <label class="fld"><span>Notes for your doctor</span><textarea id="edNotes">${esc(e.notes)}</textarea></label>
      <div id="edMeta"></div>
      <div class="ed-actions"><button type="button" class="btn" id="edClear">${icon('eraser')} Clear drawings</button><button type="button" class="btn danger" id="edDelete">${icon('trash')} Delete entry</button></div>`;

    const changed = () => { S.touch(e); S.save(); renderEntryChip(); renderSheetSum(); renderEditorMeta(); emit('data'); };
    $('#edTitle').addEventListener('input', (ev) => { e.title = ev.target.value; changed(); });
    $('#edWhen').addEventListener('change', (ev) => { e.occurredAt = fromLocalInput(ev.target.value) || e.occurredAt; changed(); });
    $('#edNow').addEventListener('click', () => { e.occurredAt = new Date().toISOString(); $('#edWhen').value = toLocalInput(e.occurredAt); changed(); });
    $('#edInt').addEventListener('input', (ev) => {
      e.intensity = +ev.target.value; e.intensityManual = true;
      $('#edIntVal').innerHTML = `${e.intensity}<small>/10</small>`;
      $('#edIntTxt').textContent = V.levelText(e.intensity);
      $('#edIntWrap').style.setProperty('--ic', V.levelColor(e.intensity));
      $('#edIntWrap').style.setProperty('--p', e.intensity * 10 + '%');
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
        const arr = e[field], i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else arr.push(v);
        b.setAttribute('aria-pressed', String(i < 0));
      }
      changed();
    }));
    $('#edContext').addEventListener('input', (ev) => { e.context = ev.target.value; changed(); });
    $('#edSymNotes').addEventListener('input', (ev) => { e.symptomNotes = ev.target.value; changed(); });
    $('#edOnset').addEventListener('change', (ev) => { e.onset = ev.target.value; changed(); });
    $('#edNotes').addEventListener('input', (ev) => { e.notes = ev.target.value; changed(); });
    $('#edClear').addEventListener('click', async () => {
      if (!e.shapes.length) { toast('This entry has no drawings yet'); return; }
      const v = await modal({ title: 'Clear drawings?', body: `<p>All drawings in “${esc(e.title)}” are removed. Details are kept. You can undo.</p>`, buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Clear', cls: 'danger-fill' }] });
      if (v === 'ok') S.mutate(() => { e.shapes = []; S.touch(e); });
    });
    $('#edDelete').addEventListener('click', async () => {
      const v = await modal({ title: `Delete “${esc(e.title)}”?`, body: '<p>The entry and its drawings are removed. You can undo.</p>', buttons: [{ value: 'cancel', label: 'Cancel' }, { value: 'ok', label: 'Delete', cls: 'danger-fill' }] });
      if (v !== 'ok') return;
      S.mutate(() => {
        const i = S.data.entries.indexOf(e);
        S.data.entries.splice(i, 1);
        const n = S.data.entries[Math.min(i, S.data.entries.length - 1)];
        S.data.activeEntryId = n ? n.id : null;
      });
      sheet.classList.remove('open');
    });
    renderEditorMeta();
  }

  function renderEditorMeta() {
    const e = S.activeEntry();
    const box = $('#edMeta');
    if (!e || !box) return;
    const regs = RP.regionList(e);
    const notes = RP.pointNotes(e);
    box.innerHTML = `
      <div class="fld"><span>Where</span><div class="reg-chips">${regs.length ? regs.map((r) => `<button type="button" class="reg-chip" data-region="${r.id}">${esc(r.name)}${r.view === 'back' ? ' (back)' : ''}</button>`).join('') : '<span class="muted">Draw on the body to link this entry to a body area.</span>'}</div></div>
      ${notes.length ? `<div class="fld"><span>Spots with their own level</span><ul class="pt-notes">${notes.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      <div class="meta"><span>Drawings</span><b>${e.shapes.length}</b><span>Logged</span><b>${fmtDateTime(e.createdAt)}</b><span>Last changed</span><b>${fmtDateTime(e.updatedAt)}</b></div>`;
    $$('.reg-chip', box).forEach((b) => b.addEventListener('click', () => { sheet.classList.remove('open'); setRegion(b.dataset.region); }));
  }

  function renderAll() {
    renderMarks(); renderEntryChip();
    const e = S.activeEntry();
    if ($('#editor').dataset.for !== (e ? e.id : '')) renderEditor(); else { renderSheetSum(); renderEditorMeta(); }
    $('#btnUndo').disabled = !S.undoStack.length;
    $('#btnRedo').disabled = !S.redoStack.length;
  }

  // ---------- public API ----------
  function open({ entryId, newEntry: makeNew, region } = {}) {
    onResize(); // measure now – ResizeObserver only reports after the next paint
    if (makeNew) { S.mutate(() => S.createEntry()); setTool(ui.lastDrawTool === 'erase' ? 'draw' : ui.lastDrawTool); }
    if (entryId) S.data.activeEntryId = entryId;
    renderAll();
    const e = S.activeEntry();
    if (region === undefined && entryId && e && e.shapes.length) {
      const first = e.shapes.find((s) => s.primaryRegion);
      region = null;
      if (first) showSide(first.view);
    }
    if (region !== undefined) setRegion(region, { animate: size.w > 0 });
    if (size.w) animateTo(fitTarget(), 0);
  }

  renderLevels(); renderSize(); showSide('front'); setTool('nav'); renderAll();
  PP.track = { open, renderAll, setTool, setRegion, turnTo, ui, cam, clientToWorld, debug: () => ({ size, fitS, target: fitTarget() }) };
})();
