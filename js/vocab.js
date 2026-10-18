/* PAINPRINT – controlled vocabularies. Data stores the codes; the UI shows the labels. */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});

  const list = (pairs, group) => pairs.map(([code, label]) => ({ code, label, group }));

  const V = {
    sensations: list([
      ['burning', 'Burning'], ['stabbing', 'Stabbing'], ['sharp', 'Sharp'], ['dull', 'Dull'], ['aching', 'Aching'],
      ['throbbing', 'Throbbing'], ['shooting', 'Shooting'], ['electric', 'Electric shock-like'], ['pressure', 'Pressure'],
      ['cramping', 'Cramping'], ['tingling', 'Tingling'], ['numbness', 'Numbness'], ['tightness', 'Tightness'], ['other', 'Other'],
    ]),
    duration: list([
      ['seconds', 'Seconds'], ['minutes', 'Minutes'], ['hours', 'Hours'], ['days', 'Days'], ['weeks', 'Weeks'],
      ['months', 'Months'], ['constant', 'Constant'], ['intermittent', 'Intermittent'],
    ]),
    pattern: list([
      ['sudden_onset', 'Sudden onset'], ['gradual_onset', 'Gradual onset'], ['constant', 'Constant'], ['recurring', 'Recurring'],
      ['increasing', 'Increasing'], ['decreasing', 'Decreasing'], ['fluctuating', 'Fluctuating'],
    ]),
    // Potential triggers are things the patient *noticed* – never presented as causes.
    triggers: [
      ...list([['walking', 'Walking'], ['standing', 'Standing'], ['sitting', 'Sitting'], ['lying_down', 'Lying down'], ['exercise', 'Exercise'],
        ['repetitive_movement', 'Repetitive movement'], ['exertion', 'Physical exertion']], 'Physical'),
      ...list([['heat', 'Heat'], ['cold', 'Cold'], ['humidity', 'Humidity'], ['weather', 'Weather changes'], ['bright_light', 'Bright light'],
        ['noise', 'Noise']], 'Environmental'),
      ...list([['sleep', 'Sleep'], ['stress', 'Stress'], ['food', 'Food'], ['hydration', 'Hydration'], ['daily_activities', 'Daily activities']], 'Lifestyle'),
      ...list([['medication', 'Medication'], ['travel', 'Travel'], ['unknown', 'Unknown']], 'Other'),
    ],
    associatedSymptoms: list([
      ['dizziness', 'Dizziness'], ['nausea', 'Nausea'], ['fatigue', 'Fatigue'], ['weakness', 'Weakness'], ['numbness', 'Numbness'],
      ['tingling', 'Tingling'], ['tinnitus', 'Tinnitus'], ['headache', 'Headache'], ['vision_changes', 'Vision changes'],
      ['light_sensitivity', 'Sensitivity to light'], ['sound_sensitivity', 'Sensitivity to sound'], ['sleep_disturbance', 'Sleep disturbances'],
      ['balance', 'Balance difficulties'], ['swelling', 'Swelling'], ['other', 'Other'],
    ]),
    dailyImpact: list([
      ['walking', 'Walking'], ['standing', 'Standing'], ['sitting', 'Sitting'], ['sleeping', 'Sleeping'], ['eating', 'Eating'],
      ['drinking', 'Drinking'], ['concentration', 'Concentration'], ['working', 'Working'], ['studying', 'Studying'],
      ['communication', 'Communication'], ['social', 'Social activities'], ['personal_care', 'Personal care'],
      ['household', 'Household activities'], ['mobility', 'Mobility'], ['other', 'Other'],
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
