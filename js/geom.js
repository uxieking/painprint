/* PAINPRINT – geometry helpers (pure functions, no DOM). */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});

  const r2 = (v) => Math.round(v * 100) / 100;
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function distToSeg(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  function distToPolyline(p, pts, closed) {
    if (!pts.length) return Infinity;
    if (pts.length === 1) return dist(p, pts[0]);
    let m = Infinity;
    for (let i = 0; i < pts.length - 1; i++) m = Math.min(m, distToSeg(p, pts[i], pts[i + 1]));
    if (closed) m = Math.min(m, distToSeg(p, pts[pts.length - 1], pts[0]));
    return m;
  }

  function pointInPoly(p, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  const pointInEllipse = (p, e) => ((p[0] - e.cx) / e.rx) ** 2 + ((p[1] - e.cy) / e.ry) ** 2 <= 1;

  function bbox(pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      if (x < x0) x0 = x; if (y < y0) y0 = y;
      if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  function polyArea(pts) {
    let a = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
    return Math.abs(a / 2);
  }

  function pathLength(pts) {
    let l = 0;
    for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
    return l;
  }

  /** Ramer–Douglas–Peucker simplification (iterative). */
  function simplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [s, e] = stack.pop();
      let md = 0, mi = -1;
      for (let i = s + 1; i < e; i++) {
        const d = distToSeg(pts[i], pts[s], pts[e]);
        if (d > md) { md = d; mi = i; }
      }
      if (md > eps && mi > 0) { keep[mi] = 1; stack.push([s, mi], [mi, e]); }
    }
    return pts.filter((_, i) => keep[i]);
  }

  /** Insert points so no segment is longer than `step`. */
  function densify(pts, step, closed) {
    if (pts.length < 2) return pts.slice();
    const out = [];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const k = Math.max(1, Math.ceil(dist(a, b) / step));
      for (let j = 0; j < k; j++) out.push([a[0] + ((b[0] - a[0]) * j) / k, a[1] + ((b[1] - a[1]) * j) / k]);
    }
    if (!closed) out.push(pts[pts.length - 1].slice());
    return out;
  }

  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const fmt = (p) => r2(p[0]) + ' ' + r2(p[1]);

  /** Smooth SVG path through points using quadratic midpoints. */
  function smoothPath(pts, closed) {
    const n = pts.length;
    if (!n) return '';
    if (n === 1) return `M${fmt(pts[0])} l0.01 0`;
    if (n === 2) return `M${fmt(pts[0])} L${fmt(pts[1])}${closed ? 'Z' : ''}`;
    let d;
    if (closed) {
      d = `M${fmt(mid(pts[n - 1], pts[0]))}`;
      for (let i = 0; i < n; i++) d += ` Q${fmt(pts[i])} ${fmt(mid(pts[i], pts[(i + 1) % n]))}`;
      return d + 'Z';
    }
    d = `M${fmt(pts[0])}`;
    for (let i = 1; i < n - 1; i++) d += ` Q${fmt(pts[i])} ${fmt(mid(pts[i], pts[i + 1]))}`;
    return d + ` L${fmt(pts[n - 1])}`;
  }

  function centroid(pts) {
    let x = 0, y = 0;
    for (const p of pts) { x += p[0]; y += p[1]; }
    return [x / pts.length, y / pts.length];
  }

  PP.geom = { r2, dist, distToSeg, distToPolyline, pointInPoly, pointInEllipse, bbox, polyArea, pathLength, simplify, densify, smoothPath, centroid };
})();
