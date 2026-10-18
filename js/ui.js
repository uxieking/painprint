/* PAINPRINT – shared UI helpers: DOM, icons, dialogs, popovers, toasts, formatting, mini body maps. */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const B = PP.body, R = PP.render, V = PP.vocab;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const ICONS = {
    hand: 'M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
    pen: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
    area: 'M12 3a9 9 0 0 1 0 18M12 21a9 9 0 0 1 0-18M3.5 9h.01M3 13h.01M5 17h.01M20.5 9h.01M21 13h.01M19 17h.01',
    arrow: 'M5 19 19 5M9 5h10v10',
    eraser: 'm7 21-4.3-4.3a2.4 2.4 0 0 1 0-3.4l9.6-9.6a2.4 2.4 0 0 1 3.4 0l5.6 5.6a2.4 2.4 0 0 1 0 3.4L13 21M22 21H7M5 11l9 9',
    undo: 'M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13',
    redo: 'M21 7v6h-6M3 17a9 9 0 0 1 15-6.7l3 2.7',
    fit: 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7',
    back: 'M19 12H5M12 19l-7-7 7-7',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
    plus: 'M12 5v14M5 12h14',
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z',
    track: 'M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 9v4l2.5 2M10 2h4',
    history: 'M3 21h18M6 17V11M10 17V6M14 17v-8M18 17v-4M12 3l.01 0',
    report: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 15l2 2 4-4',
    eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
    eyeoff: 'M9.9 4.2A10 10 0 0 1 12 4c7 0 10 8 10 8a13 13 0 0 1-1.7 2.7M6.6 6.6A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M14.1 14.1a3 3 0 1 1-4.2-4.2',
    trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    bolt: 'M13 2 3 14h9l-1 8 10-12h-9l1-8Z',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
    activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
    chev: 'm9 18 6-6-6-6',
  };
  const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;
  const applyIcons = (root = document) => $$('[data-icon]', root).forEach((el) => {
    if (!el.querySelector(':scope > svg.ic')) el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
  });

  // ---------- formatting ----------
  const fmtDateTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const fmtShort = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); };
  const fmtTime = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); };
  /** ISO → value for <input type="datetime-local"> in local time. */
  const toLocalInput = (iso) => { const d = new Date(iso || Date.now()); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);
  const dayKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // ---------- mood faces ----------
  function moodFace(m) {
    const mouths = {
      great: 'M14 27 Q22 34 30 27', okay: 'M15 28 Q22 31 29 28', not_good: 'M15 29 L29 29',
      bad: 'M15 31 Q22 26 29 31', severe: 'M14 32 Q22 24 30 32',
    };
    return `<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="20" fill="${m.color}"/>
      <circle cx="16" cy="18" r="2.3" fill="#1f2937"/><circle cx="28" cy="18" r="2.3" fill="#1f2937"/>
      <path d="${mouths[m.code]}" fill="none" stroke="#1f2937" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  }

  // ---------- mini body maps (light, for cards) ----------
  /** Both views side by side with the given entries' markings (no decorations). */
  function miniMapSVG(entries, opts = {}) {
    const views = opts.views || B.VIEWS;
    let x0 = Infinity, x1 = -Infinity, body = '';
    for (const v of views) {
      x0 = Math.min(x0, B.OFF[v]); x1 = Math.max(x1, B.OFF[v] + B.VIEW_W);
      body += `<g transform="translate(${B.OFF[v]} 0)">${B.bodySVG(v, { labels: false })}${R.marksSVG(v, entries, { includeHidden: true })}</g>`;
    }
    return `<svg class="mini" viewBox="${x0 - 10} 0 ${x1 - x0 + 20} 1000" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
  }

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

  let toastTimer;
  function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // ---------- popover anchored to an element inside the shell ----------
  let popCleanup = null;
  function closePopover() {
    const p = $('#popover');
    p.hidden = true; p.innerHTML = '';
    if (popCleanup) { popCleanup(); popCleanup = null; }
  }
  function openPopover(anchor, html, onClick, align = 'left') {
    closePopover();
    const p = $('#popover'), shell = $('#shell');
    p.innerHTML = html; p.hidden = false;
    const a = anchor.getBoundingClientRect(), s = shell.getBoundingClientRect();
    p.style.top = Math.round(a.bottom - s.top + 6) + 'px';
    if (align === 'right') { p.style.right = Math.round(s.right - a.right) + 'px'; p.style.left = 'auto'; }
    else { p.style.left = Math.max(12, Math.round(a.left - s.left)) + 'px'; p.style.right = 'auto'; }
    const click = (e) => { const b = e.target.closest('[data-v]'); if (b) { const v = b.dataset.v; closePopover(); onClick(v); } };
    const outside = (e) => { if (!p.contains(e.target) && !anchor.contains(e.target)) closePopover(); };
    const key = (e) => { if (e.key === 'Escape') closePopover(); };
    p.addEventListener('click', click);
    setTimeout(() => document.addEventListener('pointerdown', outside), 0);
    document.addEventListener('keydown', key);
    popCleanup = () => { p.removeEventListener('click', click); document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); };
  }

  // ---------- simple event bus between screens ----------
  const listeners = {};
  const on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  const emit = (ev, ...a) => (listeners[ev] || []).forEach((f) => f(...a));

  function download(text, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  PP.ui = {
    $, $$, esc, icon, applyIcons, fmtDateTime, fmtShort, fmtTime, toLocalInput, fromLocalInput, dayKey,
    moodFace, miniMapSVG, modal, toast, openPopover, closePopover, on, emit, download,
    levelColor: V.levelColor, levelText: V.levelText,
  };
})();
