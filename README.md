# PAINPRINT

Let patients show exactly where it hurts. PAINPRINT is a 2D body map (front and back) where patients select a body region, open an enlarged anatomical view and draw their pain directly onto it – small localized spots, larger areas and arrows for radiating pain. Every drawing is stored as structured, coordinate-based data linked to anatomical regions, and can be exported as a patient report for clinicians.

## Live demo
**👉 https://uxieking.github.io/painprint/** – no account or login needed. Click **Try a sample patient** on the welcome screen to explore a filled-in pain map, or start empty and draw your own. Works on desktop, tablet (with stylus) and phone.

How to try it in 1 minute:
1. Tap a body part (e.g. the lower back) to open the enlarged view.
2. Press **Brush**, **Area** or **Arrow** and draw where it hurts – pinch with two fingers to zoom at any time.
3. Set intensity and sensations in the panel.
4. Open **Report** to see the printable patient report with full-body and enlarged views.

## Features
- Interactive front and back body views with 39 selectable regions (face, head, neck, shoulders, arms, hands, chest, abdomen, back, legs, feet …), left/right aware
- Enlarged region views with pinch-to-zoom, pan, wheel zoom and zoom controls
- Tools: freehand **Brush** (adjustable size), **Area** highlight, **Arrow** for radiating pain, **Eraser** (cuts strokes partially)
- Customizable pain types (color + label), undo / redo / clear
- Multiple independent pain entries, each with intensity (0–10), sensations, duration, triggers, associated symptoms, daily impact, onset, notes and timestamps
- Printable patient report with the full body and enlarged views of every marked region
- Autosave in the browser, JSON export/import

## Run
```
node tools/serve.js
```
Open http://localhost:5173. No dependencies and no build step (plain HTML/CSS/JS + SVG).

## Accuracy and modes
- Drawings are stored in **body coordinates** (400 × 1000 per view), not screen pixels. Zooming, panning and resizing only move the camera, so drawings stay aligned at every zoom level (verified to ~0.1 px at 1×, 6× and 40×).
- **Navigate** mode never draws. In drawing modes a second finger cancels the stroke in progress and becomes pinch/pan; nothing is drawn again until all fingers are lifted. After a stylus has been used, fingers only navigate (palm rejection). Space / middle or right mouse button pans temporarily.

## Project structure
| File | Responsibility |
|---|---|
| `js/geom.js` | Geometry: distances, point-in-polygon, simplification (RDP), smooth paths |
| `js/body.js` | Anatomical model: regions, laterality, hit-testing, linking drawings to regions |
| `js/vocab.js` | Code lists (sensations, duration, triggers, associatedSymptoms, dailyImpact) and labels |
| `js/store.js` | Data, persistence (localStorage), undo/redo |
| `js/exchange.js` | Exchange format (`bodyPoints`): export, import, validation |
| `js/render.js` | SVG rendering of lines, areas and arrows (shared by app and report) |
| `js/report.js` | Patient report: full body + enlarged regions + entry details |
| `js/app.js` | Camera (zoom/pan), input (touch/mouse/stylus), tools, panel, dialogs |

## Exchange format (Menu → Export entries)
One entry, as in [examples/entry-001.json](examples/entry-001.json):
```jsonc
{
  "id": "entry-001",
  "createdAt": "2026-10-18T10:30:00Z",
  "bodyPoints": [{
    "view": "front",            // front | back
    "x": 42, "y": 28,           // percent (0–100) of the view's width/height, from the top-left
    "region": "left_shoulder",  // region code, unique together with view
    "intensity": 7,             // 0–10
    "sensations": ["burning", "stabbing"]
  }],
  "duration": "hours",
  "triggers": ["movement"],
  "associatedSymptoms": ["tingling"],
  "dailyImpact": ["sleeping", "concentration"],
  "notes": "Example patient entry"
}
```
- The export file is `{ "app": "PAINPRINT", "format": "painprint-entries", "formatVersion": 1, "patient", "painTypes", "entries": [ … ] }`. Import also accepts a single entry or a plain list.
- **Optional extensions** (written by PAINPRINT so drawings survive an export/import round trip):
  - entry: `title`, `updatedAt`, `onset`, `description`, `intensity`
  - point: `kind` (stroke | area | arrow), `painType`, `width` (% of view width), `path` ([[x%, y%], …])
- One `bodyPoint` per drawing. x/y is the drawing's representative point: the start of an arrow, otherwise the point closest to the drawing's center.
- `region` is computed from the coordinates on export. On import the stated `region` is checked against the coordinates and mismatches are reported.
- Code lists: see [js/vocab.js](js/vocab.js). Region codes: `head`, `face`, `neck`, `chest`, `abdomen`, `pelvis` (front); `back_of_head`, `back_of_neck`, `upper_back`, `lower_back`, `buttocks` (back); and `left_`/`right_` + `shoulder`, `upper_arm`, `forearm`, `hand`, `thigh`, `knee`, `lower_leg`, `foot` (both views).
- Front view: viewer-left = patient's right. Back view: viewer-left = patient's left.

## Full backup (Menu → Download full backup)
Internal format with every detail: drawings in body coordinates (400 × 1000 per view), coverage per region (`regions[].coverage`) and points normalized to the primary region (`regionPoints`).
