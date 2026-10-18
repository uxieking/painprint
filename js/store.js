/* PAINPRINT – data store: persistence (localStorage), undo/redo, import/export. */
(function () {
  'use strict';
  const PP = (window.PP = window.PP || {});

  const KEY = 'painprint.v1';
  const SCHEMA_VERSION = 1;
  const DEFAULT_TYPES = [
    { id: 't_burn', label: 'Burning', color: '#e4572e' },
    { id: 't_sharp', label: 'Stabbing / sharp', color: '#9b3fc4' },
    { id: 't_ache', label: 'Aching / dull', color: '#2f7fd8' },
    { id: 't_tingle', label: 'Tingling / numbness', color: '#d99a00' },
    { id: 't_rad', label: 'Radiating', color: '#119c86' },
    { id: 't_other', label: 'Other', color: '#d63384' },
  ];

  const nowISO = () => new Date().toISOString();
  const uid = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function entryBase() {
    const t = nowISO();
    return {
      id: uid('e'), title: '', intensity: 5, sensations: [], duration: '', triggers: [], associatedSymptoms: [],
      dailyImpact: [], symptomNotes: '', onset: '', notes: '', visible: true, createdAt: t, updatedAt: t, shapes: [],
      occurredAt: t, // when this pain episode happened (the diary time), editable by the patient
      timeZone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; } })(), // where the time was recorded
      context: '', // why / what the patient was doing
      pattern: [], otherSymptoms: '', otherTriggers: '',
      impactScores: {}, // activity code → 0 (no impact) … 10 (unable to do it)
      impactNotes: '',
      intensityManual: false, // until the user moves the slider, intensity follows the highest level drawn
    };
  }

  // Codes renamed when the vocabulary was aligned with the product spec
  const RENAMED = {
    numb: 'numbness', pressing: 'pressure', tender: 'sharp', cutting: 'sharp', lifting: 'exertion', movement: 'repetitive_movement',
    touch: 'other', night: 'sleep', morning: 'lying_down', rest: 'lying_down', work: 'working', self_care: 'personal_care',
    exercise_impact: 'exercise', driving: 'mobility', mood: 'social', stiffness: 'other', reduced_mobility: 'other',
    redness: 'other', warmth: 'other', coldness: 'other', weeks_or_longer: 'weeks',
  };
  const renameAll = (a) => [...new Set((a || []).map((c) => RENAMED[c] || c))];

  function defaults() {
    return {
      app: 'PAINPRINT', schemaVersion: SCHEMA_VERSION,
      patient: { name: '', birthDate: '', notes: '' },
      painTypes: DEFAULT_TYPES.map((t) => ({ ...t })),
      entries: [], activeEntryId: null, checkins: [], demo: false, onboarded: false,
      settings: { dateStyle: 'auto', clock: 'auto', markOpacity: 0.9, country: '' },
      createdAt: nowISO(), updatedAt: nowISO(),
    };
  }

  function normalize(d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.entries)) throw new Error('The file does not contain PAINPRINT data.');
    const base = defaults();
    const out = { ...base, ...d, schemaVersion: SCHEMA_VERSION };
    delete out.regions; delete out.coordinateSystem; delete out.exportedAt;
    out.patient = { ...base.patient, ...(d.patient || {}) };
    out.settings = { ...base.settings, ...(d.settings || {}) };
    if (!Array.isArray(out.painTypes) || !out.painTypes.length) out.painTypes = base.painTypes;
    out.entries = d.entries.map((e) => ({
      ...entryBase(), ...e, occurredAt: e.occurredAt || e.createdAt || nowISO(),
      sensations: renameAll(e.sensations), triggers: renameAll(e.triggers), associatedSymptoms: renameAll(e.associatedSymptoms), dailyImpact: renameAll(e.dailyImpact),
      impactScores: e.impactScores && typeof e.impactScores === 'object' ? e.impactScores : {},
      shapes: Array.isArray(e.shapes) ? e.shapes.filter((s) => s && Array.isArray(s.points) && s.points.length && PP.body.OFF[s.view] !== undefined) : [],
    }));
    out.checkins = Array.isArray(d.checkins) ? d.checkins.filter((c) => c && c.date && c.mood) : [];
    if (!out.entries.some((e) => e.id === out.activeEntryId)) out.activeEntryId = out.entries.length ? out.entries[0].id : null;
    return out;
  }

  const listeners = [];
  const statusListeners = [];
  let saveTimer = null;

  const store = {
    data: null, undoStack: [], redoStack: [], storageOk: true, lastSaved: null,
    uid, nowISO,

    load() {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { this.storageOk = false; }
      try { this.data = raw ? normalize(JSON.parse(raw)) : defaults(); }
      catch (e) { console.warn('PAINPRINT: could not read saved data', e); this.data = defaults(); }
    },

    save() {
      clearTimeout(saveTimer);
      this.emitStatus('pending');
      saveTimer = setTimeout(() => this.flush(), 300);
    },
    flush() {
      clearTimeout(saveTimer);
      try {
        this.data.updatedAt = nowISO();
        localStorage.setItem(KEY, JSON.stringify(this.data));
        this.storageOk = true;
        this.lastSaved = new Date();
        this.emitStatus('saved');
      } catch (e) {
        this.storageOk = false;
        this.emitStatus('error');
      }
    },
    onStatus(fn) { statusListeners.push(fn); },
    emitStatus(s) { statusListeners.forEach((f) => f(s)); },

    onChange(fn) { listeners.push(fn); },
    changed() { this.save(); listeners.forEach((f) => f()); },

    // Undo/redo covers drawings and entry creation/deletion. Restoring keeps the
    // current metadata (intensity, symptoms, …) of entries that still exist, so
    // undoing a stroke never silently reverts a form edit.
    snapshot() { return JSON.stringify({ entries: this.data.entries, activeEntryId: this.data.activeEntryId }); },
    restore(json) {
      const snap = JSON.parse(json);
      const cur = new Map(this.data.entries.map((e) => [e.id, e]));
      this.data.entries = snap.entries.map((se) => { const ce = cur.get(se.id); return ce ? { ...ce, shapes: se.shapes } : se; });
      this.data.entries.forEach((e) => this.syncIntensity(e));
      const ids = this.data.entries.map((e) => e.id);
      this.data.activeEntryId = ids.includes(this.data.activeEntryId) ? this.data.activeEntryId
        : ids.includes(snap.activeEntryId) ? snap.activeEntryId : ids[0] || null;
    },
    pushUndo(snap) {
      this.undoStack.push(snap);
      if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack.length = 0;
    },
    mutate(fn) { this.pushUndo(this.snapshot()); fn(); this.changed(); },
    undo() {
      if (!this.undoStack.length) return false;
      this.redoStack.push(this.snapshot());
      this.restore(this.undoStack.pop());
      this.changed();
      return true;
    },
    redo() {
      if (!this.redoStack.length) return false;
      this.undoStack.push(this.snapshot());
      this.restore(this.redoStack.pop());
      this.changed();
      return true;
    },

    activeEntry() { return this.data.entries.find((e) => e.id === this.data.activeEntryId) || null; },
    typeById(id) { return this.data.painTypes.find((t) => t.id === id) || { id, label: 'Unknown type', color: '#888888' }; },
    entryIndex(e) { return this.data.entries.indexOf(e) + 1; },

    createEntry() {
      const e = entryBase();
      const nums = this.data.entries.map((x) => +(/^Pain (\d+)$/.exec(x.title) || [])[1] || 0);
      e.title = 'Pain ' + (Math.max(0, ...nums) + 1);
      this.data.entries.push(e);
      this.data.activeEntryId = e.id;
      return e;
    },
    touch(entry) { entry.updatedAt = nowISO(); },
    /** Keep the entry's overall intensity in step with the drawing until the user sets it by hand. */
    syncIntensity(entry) {
      if (entry.intensityManual) return;
      const max = Math.max(0, ...entry.shapes.map((s) => s.level || 0));
      if (max) entry.intensity = max;
    },

    /** One "How are you today?" check-in per day (the latest answer wins). */
    setCheckin(mood) {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      this.data.checkins = this.data.checkins.filter((c) => c.date !== date);
      this.data.checkins.push({ date, mood, at: nowISO() });
      this.save();
    },
    todayCheckin() {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return this.data.checkins.find((c) => c.date === date) || null;
    },

    exportJSON() {
      const B = PP.body;
      return JSON.stringify({
        ...this.data,
        exportedAt: nowISO(),
        coordinateSystem: {
          units: 'body units', views: { front: { width: B.VIEW_W, height: B.VIEW_H }, back: { width: B.VIEW_W, height: B.VIEW_H } },
          origin: 'top-left of each view; x to the right as seen by the viewer, y downwards',
          laterality: 'front: viewer-left = patient right. back: viewer-left = patient left.',
          regionPoints: 'shape points normalised (0..1) to the bounding box of the shape’s primaryRegion',
        },
        regions: B.regions.map((r) => ({ id: r.id, view: r.view, side: r.side, group: r.group, name: r.name, bbox: r.bbox })),
      }, null, 2);
    },
    blankEntry: entryBase,

    /**
     * Import exchange-format entries (or a full backup).
     * mode "add" appends (an entry with an existing id replaces that entry); "replace" swaps all entries.
     * Returns warnings to show the user.
     */
    importParsed(parsed, mode) {
      if (parsed.kind === 'backup') {
        this.data = normalize(parsed.data);
        this.undoStack = []; this.redoStack = [];
        this.changed();
        return [];
      }
      const X = PP.exchange;
      const snap = this.snapshot();
      if (mode === 'replace') {
        if (Array.isArray(parsed.painTypes) && parsed.painTypes.length) this.data.painTypes = parsed.painTypes.map((t) => ({ ...t }));
        if (parsed.patient) this.data.patient = { ...this.data.patient, ...parsed.patient };
        this.data.entries = [];
      } else if (Array.isArray(parsed.painTypes)) {
        for (const t of parsed.painTypes) if (t && t.id && !this.data.painTypes.some((x) => x.id === t.id)) this.data.painTypes.push({ ...t });
      }
      const ctx = { typeIds: new Set(this.data.painTypes.map((t) => t.id)), defaultTypeId: this.data.painTypes[0].id };
      const warnings = [];
      let last = null;
      for (const dto of parsed.entries) {
        if (!dto || typeof dto !== 'object') continue;
        const { entry, warnings: w } = X.entryFromDTO(dto, ctx);
        warnings.push(...w);
        if (!entry.title) {
          const nums = this.data.entries.map((x) => +(/^Pain (\d+)$/.exec(x.title) || [])[1] || 0);
          entry.title = 'Pain ' + (Math.max(0, ...nums) + 1);
        }
        const i = this.data.entries.findIndex((x) => x.id === entry.id);
        if (i >= 0) this.data.entries[i] = entry; else this.data.entries.push(entry);
        last = entry;
      }
      if (last) this.data.activeEntryId = last.id;
      if (mode === 'replace') { this.undoStack = []; this.redoStack = []; } else this.pushUndo(snap);
      this.changed();
      return warnings;
    },
    reset() { this.data = defaults(); this.undoStack = []; this.redoStack = []; this.changed(); },
  };

  PP.store = store;
})();

// Load saved data as soon as the store exists (all UI modules read PP.store.data).
window.PP.store.load();
