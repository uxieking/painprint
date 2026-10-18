/* PAINPRINT – sample patient so judges/testers can explore a filled-in map instantly. */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const B = PP.body, S = PP.store;

  const ellipse = (cx, cy, rx, ry, n = 28) =>
    Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  const wobble = (pts, amp) => pts.map(([x, y], i) => [x + Math.sin(i * 1.7) * amp, y + Math.cos(i * 1.3) * amp]);
  const round = (pts) => pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);

  function shape(kind, view, typeId, width, points, createdAt) {
    return B.tagShape({ id: S.uid('s'), kind, view, typeId, width, points: round(points), createdAt });
  }
  const daysAgo = (d, h = 9) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, 15, 0, 0); return t.toISOString(); };
  const localInput = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  function build() {
    const entries = [];

    // 1 – Lower back pain radiating down the left leg (back view: patient's left = viewer's left)
    let t = daysAgo(3, 8);
    let e = S.blankEntry();
    Object.assign(e, {
      title: 'Lower back pain into left leg', intensity: 7, createdAt: t, updatedAt: daysAgo(0, 7),
      sensations: ['aching', 'shooting'], duration: 'constant', triggers: ['sitting', 'lifting', 'morning'],
      associatedSymptoms: ['tingling', 'numbness', 'stiffness'], dailyImpact: ['sleeping', 'work', 'walking'],
      symptomNotes: 'Deep ache in the lower back. Shoots down the back of the left leg after sitting more than 20 minutes.',
      onset: localInput(daysAgo(21, 7)), notes: 'Started after moving furniture.',
    });
    e.shapes.push(
      shape('area', 'back', 't_ache', 1.4, wobble(ellipse(182, 405, 34, 26), 1.2), t),
      shape('arrow', 'back', 't_rad', 3.2, [[172, 440], [166, 500], [164, 570], [166, 650], [166, 730], [165, 820], [166, 880]], t),
      shape('stroke', 'back', 't_tingle', 5, [[156, 940], [160, 948], [166, 952], [172, 950], [176, 944]], t),
    );
    entries.push(e);

    // 2 – Migraine, right temple (front view: patient's right = viewer's left)
    t = daysAgo(1, 16);
    e = S.blankEntry();
    Object.assign(e, {
      title: 'Migraine – right temple', intensity: 6, createdAt: t, updatedAt: t,
      sensations: ['throbbing', 'pressing'], duration: 'hours', triggers: ['stress', 'heat'],
      associatedSymptoms: ['headache', 'nausea', 'dizziness'], dailyImpact: ['concentration', 'work', 'mood'],
      symptomNotes: 'Pulsing pain behind the right eye, light makes it worse.', onset: localInput(daysAgo(60, 12)), notes: '',
    });
    e.shapes.push(
      shape('area', 'front', 't_sharp', 1, wobble(ellipse(170, 70, 14, 17), 0.6), t),
      shape('stroke', 'front', 't_sharp', 3, [[178, 86], [182, 88], [186, 88]], t),
    );
    entries.push(e);

    // 3 – Left shoulder, burning on movement (front view: patient's left = viewer's right)
    t = daysAgo(0, 10);
    e = S.blankEntry();
    Object.assign(e, {
      title: 'Left shoulder', intensity: 4, createdAt: t, updatedAt: t,
      sensations: ['burning', 'stabbing'], duration: 'minutes', triggers: ['movement', 'lifting'],
      associatedSymptoms: ['reduced_mobility'], dailyImpact: ['sleeping', 'self_care'],
      symptomNotes: 'Sharp when lifting the arm above shoulder height.', onset: localInput(daysAgo(10, 18)), notes: '',
    });
    e.shapes.push(
      shape('stroke', 'front', 't_burn', 6, [[262, 196], [270, 200], [278, 206], [284, 214], [288, 224]], t),
      shape('arrow', 'front', 't_rad', 2.6, [[284, 232], [286, 262], [285, 292]], t),
    );
    entries.push(e);
    return entries;
  }

  function load() {
    S.mutate(() => {
      S.data.entries = build();
      S.data.activeEntryId = S.data.entries[0].id;
      S.data.patient = { name: 'Alex Sample', birthDate: '1988-04-12', notes: 'Sample patient – generated for the demo.' };
    });
  }

  PP.demo = { build, load };
})();
