/* PAINPRINT – controlled vocabularies. Data stores the codes; the UI shows the labels. */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});

  const list = (pairs) => pairs.map(([code, label]) => ({ code, label }));

  const V = {
    sensations: list([
      ['burning', 'Burning'], ['stabbing', 'Stabbing'], ['aching', 'Aching'], ['throbbing', 'Throbbing'],
      ['shooting', 'Shooting'], ['tingling', 'Tingling'], ['numb', 'Numb'], ['cramping', 'Cramping'],
      ['pressing', 'Pressing'], ['electric', 'Electric'], ['cutting', 'Cutting'], ['tender', 'Tender to touch'],
    ]),
    duration: list([
      ['seconds', 'Seconds'], ['minutes', 'Minutes'], ['hours', 'Hours'], ['days', 'Days'],
      ['weeks', 'Weeks or longer'], ['constant', 'Constant'],
    ]),
    triggers: list([
      ['movement', 'Movement'], ['rest', 'Rest'], ['sitting', 'Sitting'], ['standing', 'Standing'], ['walking', 'Walking'],
      ['lifting', 'Lifting'], ['touch', 'Touch'], ['stress', 'Stress'], ['cold', 'Cold'], ['heat', 'Heat'],
      ['night', 'At night'], ['morning', 'In the morning'],
    ]),
    associatedSymptoms: list([
      ['tingling', 'Tingling'], ['numbness', 'Numbness'], ['stiffness', 'Stiffness'], ['swelling', 'Swelling'],
      ['weakness', 'Weakness'], ['redness', 'Redness'], ['warmth', 'Warmth'], ['coldness', 'Coldness'],
      ['reduced_mobility', 'Reduced mobility'], ['headache', 'Headache'], ['nausea', 'Nausea'],
      ['dizziness', 'Dizziness'], ['fatigue', 'Fatigue'],
    ]),
    dailyImpact: list([
      ['sleeping', 'Sleeping'], ['concentration', 'Concentration'], ['work', 'Work / school'], ['walking', 'Walking'],
      ['exercise', 'Exercise'], ['household', 'Household chores'], ['self_care', 'Self-care'], ['driving', 'Driving'],
      ['social', 'Social life'], ['mood', 'Mood'],
    ]),
  };

  const labelMaps = Object.fromEntries(Object.entries(V).map(([k, arr]) => [k, Object.fromEntries(arr.map((o) => [o.code, o.label]))]));
  /** Label for a code; unknown codes are shown as-is so imported data is never lost. */
  const label = (field, code) => (labelMaps[field] && labelMaps[field][code]) || code;
  const labels = (field, codes) => (codes || []).map((c) => label(field, c));

  PP.vocab = { ...V, label, labels };
})();
