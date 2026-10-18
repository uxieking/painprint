/* PAINPRINT – SVG rendering of pain markings (shared by the editor and the report). */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const G = PP.geom;
  const r2 = G.r2;

  /** Splits an arrow polyline into a trimmed shaft and a triangular head. */
  function arrowParts(pts, w) {
    const total = G.pathLength(pts);
    const L = Math.min(Math.max(w * 3.6, 5), total * 0.6 || 5);
    const P = pts[pts.length - 1];
    // Point L back along the path → arrow direction
    let acc = 0, Q = pts[0];
    for (let i = pts.length - 1; i > 0; i--) {
      const a = pts[i], b = pts[i - 1], d = G.dist(a, b);
      if (acc + d >= L) { const t = (L - acc) / d; Q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; break; }
      acc += d; Q = b;
    }
    let dx = P[0] - Q[0], dy = P[1] - Q[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const nx = -dy, ny = dx, hw = L * 0.55;
    const base = [P[0] - dx * L, P[1] - dy * L];
    const head = [P, [base[0] + nx * hw, base[1] + ny * hw], [base[0] - nx * hw, base[1] - ny * hw]];
    // Trim the shaft so its round cap hides under the head
    const cut = total - L * 0.7;
    const line = [pts[0]];
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      const d = G.dist(pts[i - 1], pts[i]);
      if (run + d >= cut) {
        const t = d ? (cut - run) / d : 0;
        line.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]);
        break;
      }
      run += d;
      line.push(pts[i]);
    }
    return { line, head };
  }

  function shapeSVG(sh, color, opacity = 1) {
    const w = sh.width || 2;
    if (sh.kind === 'stroke') {
      return `<path d="${G.smoothPath(sh.points, false)}" fill="none" stroke="${color}" stroke-width="${r2(w)}" stroke-linecap="round" stroke-linejoin="round" opacity="${0.85 * opacity}"/>`;
    }
    if (sh.kind === 'area') {
      return `<path d="${G.smoothPath(sh.points, true)}" fill="${color}" fill-opacity="${0.32 * opacity}" stroke="${color}" stroke-opacity="${0.9 * opacity}" stroke-width="${r2(w)}" stroke-linejoin="round"/>`;
    }
    if (sh.kind === 'point') {
      // Point marker for very localized pain: a solid dot with a soft halo
      const [x, y] = sh.points[0];
      return `<g opacity="${opacity}"><circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(w * 1.9)}" fill="${color}" fill-opacity=".22" stroke="${color}" stroke-width="${r2(w * 0.22)}"/><circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(w * 0.75)}" fill="${color}"/></g>`;
    }
    if (sh.kind === 'arrow') {
      const a = arrowParts(sh.points, w);
      const head = 'M' + a.head.map((p) => r2(p[0]) + ' ' + r2(p[1])).join('L') + 'Z';
      return `<g opacity="${opacity}"><path d="${G.smoothPath(a.line, false)}" fill="none" stroke="${color}" stroke-width="${r2(w)}" stroke-linecap="round" stroke-linejoin="round"/><path d="${head}" fill="${color}" stroke="${color}" stroke-width="${r2(w * 0.35)}" stroke-linejoin="round"/></g>`;
    }
    return '';
  }

  /** Drawing color: the pain level (1–10) if set, otherwise the legacy pain-type color. */
  function shapeColor(sh, typeById) {
    if (sh.level) return PP.vocab.levelColor(sh.level);
    return (typeById || ((id) => PP.store.typeById(id)))(sh.typeId).color;
  }

  /** All markings for one view. Inactive entries can be dimmed; the active one is drawn on top. */
  function marksSVG(view, entries, opts = {}) {
    const typeById = opts.typeById || ((id) => PP.store.typeById(id));
    const ordered = entries.filter((e) => e.visible !== false || opts.includeHidden);
    if (opts.activeId) ordered.sort((a, b) => (a.id === opts.activeId) - (b.id === opts.activeId));
    let out = '';
    for (const e of ordered) {
      const op = opts.activeId && opts.dimInactive && e.id !== opts.activeId ? 0.45 : 1;
      for (const sh of e.shapes) if (sh.view === view) out += shapeSVG(sh, shapeColor(sh, typeById), op);
    }
    return out;
  }

  function badgeSVG(x, y, r, n) {
    return `<g class="badge"><circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" fill="#111827" stroke="#fff" stroke-width="${r2(r * 0.18)}"/><text x="${r2(x)}" y="${r2(y)}" font-size="${r2(r * 1.15)}" fill="#fff" text-anchor="middle" dominant-baseline="central" font-weight="700" font-family="system-ui,sans-serif">${n}</text></g>`;
  }

  PP.render = { shapeSVG, shapeColor, marksSVG, badgeSVG, arrowParts };
})();
