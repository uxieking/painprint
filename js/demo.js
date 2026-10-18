/* PAINPRINT – sample patient so judges/testers can explore a filled-in pain diary instantly. */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});
  const B = PP.body, S = PP.store;

  const ellipse = (cx, cy, rx, ry, n = 28) =>
    Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  const wobble = (pts, amp) => pts.map(([x, y], i) => [x + Math.sin(i * 1.7) * amp, y + Math.cos(i * 1.3) * amp]);
  const round = (pts) => pts.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function shape(kind, view, level, width, points, createdAt) {
    return B.tagShape({ id: S.uid('s'), kind, view, level, typeId: null, width, points: round(points), createdAt });
  }
  const daysAgo = (d, h = 9, m = 15) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(h, m, 0, 0); return t.toISOString(); };
  const localInput = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  function entry(fields, shapes) {
    const e = S.blankEntry();
    Object.assign(e, fields);
    e.createdAt = e.updatedAt = e.occurredAt;
    e.shapes = shapes;
    return e;
  }

  // Shapes reused across diary entries
  const backArea = (lv, t) => shape('area', 'back', lv, 1.4, wobble(ellipse(182, 405, 34, 26), 1.2), t);
  const legArrow = (lv, t, end = 880) => shape('arrow', 'back', lv, 3.2, [[172, 440], [166, 500], [164, 570], [166, 650], [166, 730], [165, end - 60], [166, end]], t);
  const heel = (lv, t) => shape('stroke', 'back', lv, 5, [[156, 940], [160, 948], [166, 952], [172, 950], [176, 944]], t);
  const temple = (lv, t) => shape('area', 'front', lv, 1, wobble(ellipse(165, 70, 10, 13), 0.6), t);
  const eye = (lv, t) => shape('stroke', 'front', lv, 3, [[180, 87], [184, 89], [189, 88]], t);
  const jaw = (lv, t) => shape('stroke', 'front', lv, 4, [[220, 104], [226, 112], [228, 122], [222, 128]], t);

  function build() {
    const onsetBack = localInput(daysAgo(34, 17));
    const list = [];
    let t;

    t = daysAgo(31, 19, 40);
    list.push(entry({
      title: 'Back pain after moving furniture', intensity: 8, intensityManual: true, occurredAt: t,
      sensations: ['aching', 'stabbing'], duration: 'days', triggers: ['lifting'], associatedSymptoms: ['stiffness'],
      dailyImpact: ['sleeping', 'work'], context: 'Carried boxes all afternoon while moving.', onset: onsetBack,
    }, [backArea(8, t)]));

    t = daysAgo(27, 7, 10);
    list.push(entry({
      title: 'Morning stiffness, pain into leg', intensity: 7, occurredAt: t,
      sensations: ['aching', 'shooting'], duration: 'hours', triggers: ['morning', 'sitting'], associatedSymptoms: ['stiffness', 'tingling'],
      dailyImpact: ['walking', 'work'], context: 'Could barely get out of bed. Better after a hot shower.', onset: onsetBack,
    }, [backArea(6, t), legArrow(7, t, 700)]));

    t = daysAgo(18, 15, 30);
    list.push(entry({
      title: 'Migraine at work', intensity: 8, occurredAt: t,
      sensations: ['throbbing', 'pressing'], duration: 'hours', triggers: ['stress'], associatedSymptoms: ['headache', 'nausea'],
      dailyImpact: ['concentration', 'work'], context: 'Deadline week, skipped lunch, bright office lights.', onset: localInput(daysAgo(400, 12)),
    }, [temple(6, t), eye(8, t)]));

    t = daysAgo(11, 22, 5);
    list.push(entry({
      title: 'Jaw pain at night', intensity: 4, occurredAt: t,
      sensations: ['aching', 'tender'], duration: 'hours', triggers: ['night', 'stress'], associatedSymptoms: ['headache'],
      dailyImpact: ['sleeping'], context: 'Woke up clenching my teeth.', onset: '',
    }, [jaw(4, t)]));

    t = daysAgo(3, 8, 0);
    list.push(entry({
      title: 'Lower back pain into left leg', intensity: 9, occurredAt: t,
      sensations: ['aching', 'shooting', 'electric'], duration: 'constant', triggers: ['sitting', 'lifting', 'morning'],
      associatedSymptoms: ['tingling', 'numbness', 'stiffness'], dailyImpact: ['sleeping', 'work', 'walking'],
      symptomNotes: 'Deep ache in the lower back. Shoots down the back of the left leg after sitting more than 20 minutes.',
      context: 'Long car drive the day before (5 hours).', onset: onsetBack,
      notes: 'Ibuprofen helps for ~3 hours. Want to ask about a referral to physiotherapy.',
    }, [backArea(7, t), legArrow(9, t), heel(4, t)]));

    t = daysAgo(0, 10, 20);
    list.push(entry({
      title: 'Left shoulder when lifting arm', intensity: 5, occurredAt: t,
      sensations: ['burning', 'stabbing'], duration: 'minutes', triggers: ['movement', 'lifting'],
      associatedSymptoms: ['reduced_mobility'], dailyImpact: ['sleeping', 'self_care'],
      context: 'Reaching for the top shelf in the kitchen.', onset: localInput(daysAgo(10, 18)),
    }, [
      shape('stroke', 'front', 5, 6, [[262, 196], [270, 200], [278, 206], [284, 214], [288, 224]], t),
      shape('arrow', 'front', 3, 2.6, [[284, 232], [286, 262], [285, 292]], t),
    ]));
    return list;
  }

  /** 90 days of "How are you today?" answers that follow the diary's flare-ups. */
  function checkins() {
    const out = [];
    for (let d = 89; d >= 0; d--) {
      if (d % 3 === 1 && d > 10) continue; // a realistic diary has gaps
      const day = new Date(); day.setDate(day.getDate() - d);
      const flare = Math.max(0, 3.2 - Math.abs(d - 30) / 3) + Math.max(0, 2.7 - Math.abs(d - 3) / 1.4) + Math.max(0, 1.6 - Math.abs(d - 18));
      const v = 1.2 + Math.sin(d / 4.3) * 0.8 + flare;
      const idx = Math.max(0, Math.min(4, Math.round(v)));
      out.push({ date: dateKey(day), mood: PP.vocab.MOODS[idx].code, at: day.toISOString() });
    }
    return out;
  }

  function load() {
    S.mutate(() => {
      S.data.entries = build();
      S.data.checkins = checkins();
      S.data.activeEntryId = S.data.entries[S.data.entries.length - 1].id;
      S.data.patient = { name: 'Alex Sample', birthDate: '1988-04-12', notes: 'Sample patient – generated for the demo. Next appointment: back pain follow-up.' };
    });
  }

  PP.demo = { build, load };
})();
