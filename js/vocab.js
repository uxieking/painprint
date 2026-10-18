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

  // Pain scale 1–10: each level has its own drawing color. 9 = orange, 10 = red.
  const LEVEL_COLORS = [null, '#a78bfa', '#8b5cf6', '#3b82f6', '#06b6d4', '#10b981', '#84cc16', '#facc15', '#ec4899', '#f97316', '#ef4444'];
  const levelColor = (l) => (l >= 1 ? LEVEL_COLORS[Math.min(10, Math.round(l))] : '#94a3b8');
  const levelText = (i) => (i <= 0 ? 'No pain' : i <= 3 ? 'Mild' : i <= 6 ? 'Moderate' : i <= 9 ? 'Severe' : 'Worst imaginable');

  // Daily check-in ("How are you today?"). `pain` maps the mood onto the 0–10 scale for the trend chart.
  const MOODS = [
    { code: 'great', label: 'Great', color: '#5eead4', pain: 0 },
    { code: 'okay', label: 'Okay', color: '#bbf7d0', pain: 2 },
    { code: 'not_good', label: 'Not good', color: '#fde68a', pain: 5 },
    { code: 'bad', label: 'Bad', color: '#fdba74', pain: 7 },
    { code: 'severe', label: 'Severe', color: '#fca5a5', pain: 9 },
  ];

  const labelMaps =Object.fromEntries(Object.entries(V).map(([k, arr]) => [k, Object.fromEntries(arr.map((o) => [o.code, o.label]))]));
  /** Label for a code; unknown codes are shown as-is so imported data is never lost. */
  const label = (field, code) => (labelMaps[field] && labelMaps[field][code]) || code;
  const labels = (field, codes) => (codes || []).map((c) => label(field, c));

  PP.vocab = { ...V, label, labels, LEVEL_COLORS, levelColor, levelText, MOODS };
})();
