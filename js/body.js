/* PAINPRINT – anatomical body model.
 *
 * Coordinate system ("body units"): each view is 400 × 1000, origin top-left,
 * x to the right as seen by the viewer, y downwards.
 *   front view: viewer-left = patient's RIGHT side
 *   back view:  viewer-left = patient's LEFT side
 * In the app both views live side by side in one "world": back is offset by OFF.back on x.
 */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const G = PP.geom;

  const VIEW_W = 400, VIEW_H = 1000;
  const OFF = { front: 0, back: 460 };
  const WORLD = { x: -10, y: -10, w: 880, h: 1040 };
  const VIEWS = ['front', 'back'];

  const E = (cx, cy, rx, ry) => ({ t: 'e', cx, cy, rx, ry });
  const P = (...pts) => ({ t: 'p', pts });
  const mirrorShape = (s) => (s.t === 'e' ? { ...s, cx: VIEW_W - s.cx } : { t: 'p', pts: s.pts.map(([x, y]) => [VIEW_W - x, y]) });

  // Render order (bottom → top). Hit-testing walks this list in reverse.
  // Paired parts are defined for the viewer-left side and mirrored.
  const PARTS = [
    { key: 'neck', group: 'neck', shapes: [P([181, 126], [219, 126], [223, 171], [177, 171])] },
    { key: 'chest', group: { front: 'chest', back: 'back' }, shapes: [P([177, 170], [223, 170], [250, 198], [262, 226], [262, 330], [138, 330], [138, 226], [150, 198])] },
    { key: 'abdomen', group: { front: 'abdomen', back: 'back' }, shapes: [P([138, 330], [262, 330], [258, 395], [262, 452], [138, 452], [142, 395])] },
    { key: 'pelvis', group: { front: 'pelvis', back: 'buttocks' }, shapes: [P([138, 452], [262, 452], [268, 500], [270, 532], [200, 562], [130, 532], [132, 500])] },
    { key: 'thigh', pair: true, group: 'legs', shapes: [P([130, 532], [200, 562], [197, 600], [190, 700], [142, 700], [133, 640], [128, 580])] },
    { key: 'knee', pair: true, group: 'legs', shapes: [P([142, 700], [190, 700], [188, 762], [146, 762])] },
    { key: 'lower_leg', pair: true, group: 'legs', shapes: [P([146, 762], [188, 762], [186, 820], [179, 905], [158, 905], [146, 830], [143, 790])] },
    { key: 'foot', pair: true, group: 'feet', shapes: [P([158, 905], [179, 905], [182, 930], [186, 958], [180, 968], [150, 968], [143, 960], [150, 940], [156, 925])] },
    { key: 'shoulder', pair: true, group: 'shoulders', shapes: [P([177, 170], [150, 174], [124, 182], [107, 198], [99, 222], [100, 250], [131, 250], [138, 226], [150, 198])] },
    { key: 'upper_arm', pair: true, group: 'arms', shapes: [P([100, 250], [131, 250], [132, 300], [129, 375], [95, 375], [96, 300])] },
    { key: 'forearm', pair: true, group: 'arms', shapes: [P([95, 375], [129, 375], [124, 440], [120, 500], [94, 500], [91, 440])] },
    { key: 'hand', pair: true, group: 'hands', shapes: [P([94, 500], [120, 500], [123, 520], [125, 548], [123, 578], [117, 592], [109, 595], [101, 593], [94, 583], [91, 560], [84, 552], [78, 540], [79, 528], [85, 524], [91, 520])] },
    { key: 'ear', pair: true, group: 'head', shapes: [E(154, 84, 7, 14)] },
    { key: 'head', group: 'head', shapes: [E(200, 76, 46, 58)] },
    { key: 'temple', pair: true, group: 'head', views: ['front'], shapes: [E(165, 70, 9, 12)] },
    { key: 'face', group: 'face', views: ['front'], shapes: [E(200, 94, 34, 38)] },
    { key: 'jaw', pair: true, group: 'face', views: ['front'], shapes: [P([166, 96], [174, 100], [184, 114], [192, 126], [194, 131], [186, 130], [178, 123], [171, 113], [167, 104])] },
    { key: 'chin', group: 'face', views: ['front'], shapes: [E(200, 127, 11, 7)] },
    // Finer joints and details drawn on top of the larger regions (topmost = hit first)
    { key: 'eye', pair: true, group: 'face', views: ['front'], shapes: [E(186, 88, 8, 5)] },
    { key: 'elbow', pair: true, group: 'arms', shapes: [E(112, 376, 18, 13)] },
    { key: 'wrist', pair: true, group: 'arms', shapes: [E(107, 499, 15, 8)] },
    { key: 'fingers', pair: true, group: 'hands', shapes: [P([94, 557], [124, 557], [123, 578], [117, 592], [109, 595], [101, 593], [94, 583], [92, 562]), P([91, 548], [84, 552], [78, 540], [79, 528], [85, 524], [91, 531])] },
    { key: 'hip', pair: true, group: 'pelvis', shapes: [E(141, 492, 12, 24)] },
    { key: 'ankle', pair: true, group: 'legs', shapes: [E(168, 905, 15, 9)] },
    { key: 'toes', pair: true, group: 'feet', views: ['front'], shapes: [P([147, 950], [186, 950], [186, 958], [180, 968], [150, 968], [143, 960])] },
  ];

  const NAMES = {
    neck: { front: 'Neck', back: 'Back of neck' },
    chest: { front: 'Chest', back: 'Upper back' },
    abdomen: { front: 'Abdomen', back: 'Lower back' },
    pelvis: { front: 'Pelvis / groin', back: 'Buttocks' },
    thigh: { front: 'thigh', back: 'thigh (back)' },
    knee: { front: 'knee', back: 'back of knee' },
    lower_leg: { front: 'shin', back: 'calf' },
    foot: { front: 'foot / toes', back: 'foot / heel' },
    shoulder: { front: 'shoulder', back: 'shoulder (back)' },
    upper_arm: { front: 'upper arm', back: 'upper arm (back)' },
    forearm: { front: 'forearm', back: 'forearm (back)' },
    hand: { front: 'palm', back: 'back of hand' },
    head: { front: 'Head / forehead', back: 'Back of head' },
    face: { front: 'Face' },
    ear: { front: 'ear', back: 'ear' },
    temple: { front: 'temple' },
    jaw: { front: 'jaw' },
    chin: { front: 'Chin' },
    eye: { front: 'eye area' },
    elbow: { front: 'elbow (inner)', back: 'elbow' },
    wrist: { front: 'wrist', back: 'wrist (back)' },
    fingers: { front: 'fingers', back: 'fingers (back)' },
    hip: { front: 'hip', back: 'hip (back)' },
    ankle: { front: 'ankle', back: 'ankle / Achilles' },
    toes: { front: 'toes' },
  };
  const GROUP_NAMES = {
    head: 'Head', face: 'Face', neck: 'Neck', shoulders: 'Shoulders', arms: 'Arms', hands: 'Hands',
    chest: 'Chest', abdomen: 'Abdomen', back: 'Back', pelvis: 'Pelvis', buttocks: 'Buttocks', legs: 'Legs', feet: 'Feet',
  };
  const VIEW_NAMES = { front: 'Front', back: 'Back' };
  // Region codes used in the exchange format (unique together with the view). Paired parts get left_/right_ prefix.
  const CODES = {
    head: { front: 'head', back: 'back_of_head' }, face: { front: 'face' }, chin: { front: 'chin' }, neck: { front: 'neck', back: 'back_of_neck' },
    chest: { front: 'chest', back: 'upper_back' }, abdomen: { front: 'abdomen', back: 'lower_back' }, pelvis: { front: 'pelvis', back: 'buttocks' },
  };

  function shapeD(s) {
    if (s.t === 'e') {
      const { cx, cy, rx, ry } = s;
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
    }
    return 'M' + s.pts.map((p) => p.join(' ')).join('L') + 'Z';
  }
  function shapeBBox(s) {
    if (s.t === 'e') return { x: s.cx - s.rx, y: s.cy - s.ry, w: 2 * s.rx, h: 2 * s.ry };
    return G.bbox(s.pts);
  }
  function unionBBox(list) {
    const pts = [];
    for (const b of list) pts.push([b.x, b.y], [b.x + b.w, b.y + b.h]);
    return G.bbox(pts);
  }
  const inShape = (p, s) => (s.t === 'e' ? G.pointInEllipse(p, s) : G.pointInPoly(p, s.pts));

  // Build region list
  const regions = [];
  const byView = { front: [], back: [] };
  for (const view of VIEWS) {
    for (const part of PARTS) {
      if (part.views && !part.views.includes(view)) continue;
      const group = typeof part.group === 'string' ? part.group : part.group[view];
      const baseName = NAMES[part.key][view];
      const variants = part.pair
        ? [
            { screen: 'a', side: view === 'front' ? 'r' : 'l', shapes: part.shapes },
            { screen: 'b', side: view === 'front' ? 'l' : 'r', shapes: part.shapes.map(mirrorShape) },
          ]
        : [{ side: null, shapes: part.shapes }];
      for (const v of variants) {
        const id = `${view}.${part.key}${v.side ? '_' + v.side : ''}`;
        const code = v.side ? (v.side === 'r' ? 'right_' : 'left_') + part.key : CODES[part.key][view];
        const name = v.side ? (v.side === 'r' ? 'Right ' : 'Left ') + baseName : baseName;
        const reg = {
          id, code, view, key: part.key, side: v.side, group, groupName: GROUP_NAMES[group], name,
          shapes: v.shapes, d: v.shapes.map(shapeD).join(''), bbox: unionBBox(v.shapes.map(shapeBBox)),
        };
        regions.push(reg);
        byView[view].push(reg);
      }
    }
  }
  const byId = Object.fromEntries(regions.map((r) => [r.id, r]));
  const byCode = (view, code) => byView[view] && byView[view].find((r) => r.code === code);

  function hitRegion(view, x, y) {
    const list = byView[view];
    if (!list) return null;
    const p = [x, y];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].shapes.some((s) => inShape(p, s))) return list[i];
    }
    return null;
  }

  // Decorative anatomy lines (non-interactive). Side-specific parts are mirrored.
  const DECO_SIDE = {
    front: `
      <ellipse cx="186" cy="88" rx="5" ry="2.6"/><path d="M178 79 Q186 75 194 78"/>
      <path d="M182 184 Q160 181 132 192"/><circle cx="172" cy="262" r="2.2"/>
      <path d="M150 300 Q170 312 192 304"/>
      <ellipse cx="166" cy="731" rx="11" ry="15"/>
      <path d="M101 562 L100 590 M108 563 L108 594 M115 562 L116 591 M91 548 Q96 536 99 528"/>
      <path d="M160 950 L159 966 M167 952 L167 967 M174 952 L175 967"/>
      <path d="M104 377 Q112 372 121 377"/>`,
    back: `
      <path d="M150 212 Q170 204 186 214 L181 272 Q163 282 150 262 Z"/>
      <path d="M142 530 Q172 548 197 540"/>
      <path d="M152 733 Q167 740 182 733"/>
      <path d="M104 378 Q112 384 120 378"/>
      <path d="M101 556 L100 590 M108 557 L108 594 M115 556 L116 591"/>
      <path d="M99 548 Q107 552 116 548"/>
      <path d="M152 955 Q166 962 180 955"/>`,
  };
  const DECO_CENTER = {
    front: `
      <path d="M200 92 L195 107 Q200 110 205 107"/><path d="M189 119 Q200 125 211 119"/>
      <circle cx="200" cy="412" r="2.6"/><path d="M200 196 L200 300" class="faint"/>`,
    back: `
      <path d="M200 172 L200 452" class="dash"/><path d="M200 470 L200 548"/>
      <path d="M164 116 Q200 128 236 116"/>`,
  };
  function decoSVG(view) {
    return `${DECO_CENTER[view]}${DECO_SIDE[view]}<g transform="translate(${VIEW_W} 0) scale(-1 1)">${DECO_SIDE[view]}</g>`;
  }
  function labelsSVG(view) {
    const left = view === 'front' ? 'R' : 'L';
    const right = view === 'front' ? 'L' : 'R';
    return `<text x="200" y="1012" text-anchor="middle" class="view-title">${VIEW_NAMES[view].toUpperCase()}</text>
      <text x="34" y="430" text-anchor="middle" class="side-mark">${left}</text>
      <text x="366" y="430" text-anchor="middle" class="side-mark">${right}</text>`;
  }

  /** Body SVG fragment for one view (local coordinates). */
  function bodySVG(view, opts = {}) {
    const regs = byView[view]
      .map((r) => `<path class="region${opts.selected === r.id ? ' selected' : ''}" data-region="${r.id}" d="${r.d}"><title>${r.name}</title></path>`)
      .join('');
    return `<g class="regions">${regs}</g><g class="deco">${decoSVG(view)}</g>${opts.labels === false ? '' : `<g class="labels">${labelsSVG(view)}</g>`}`;
  }

  /**
   * Link a drawn shape to anatomical regions: samples the shape, hit-tests every
   * sample and stores coverage per region, the primary region and the shape's
   * points normalised to the primary region's bounding box (0..1).
   */
  function tagShape(shape) {
    let samples;
    if (shape.kind === 'area') {
      samples = G.densify(shape.points, 3, true);
      const bb = G.bbox(shape.points);
      const n = 14;
      for (let i = 0; i <= n; i++)
        for (let j = 0; j <= n; j++) {
          const p = [bb.x + (bb.w * i) / n, bb.y + (bb.h * j) / n];
          if (G.pointInPoly(p, shape.points)) samples.push(p);
        }
    } else {
      samples = G.densify(shape.points, 3, false);
    }
    const counts = {};
    let total = 0;
    for (const p of samples) {
      const r = hitRegion(shape.view, p[0], p[1]);
      total++;
      if (r) counts[r.id] = (counts[r.id] || 0) + 1;
    }
    shape.regions = Object.entries(counts)
      .map(([id, c]) => ({ id, coverage: Math.round((c / total) * 100) / 100 }))
      .sort((a, b) => b.coverage - a.coverage);
    shape.primaryRegion = shape.regions[0] ? shape.regions[0].id : null;
    if (shape.primaryRegion) {
      const bb = byId[shape.primaryRegion].bbox;
      shape.regionPoints = shape.points.map(([x, y]) => [Math.round(((x - bb.x) / bb.w) * 1e4) / 1e4, Math.round(((y - bb.y) / bb.h) * 1e4) / 1e4]);
    } else {
      shape.regionPoints = [];
    }
    return shape;
  }

  PP.body = { VIEW_W, VIEW_H, OFF, WORLD, VIEWS, VIEW_NAMES, GROUP_NAMES, regions, byView, byId, byCode, hitRegion, bodySVG, tagShape };
})();
