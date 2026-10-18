# PAINPRINT
**Make the invisible understandable.**

Pain is invisible. At the doctor's office patients often forget, downplay – or, out of nerves, overstate – what they have felt for weeks. PAINPRINT is a pain diary you **draw**: patients mark exactly where it hurts on a zoomable body, pick the pain level as a color, and log **when** it happened and **why**. Their doctor gets the real pattern between visits – not just a snapshot of the day of the appointment.

## Live demo
**👉 https://uxieking.github.io/painprint/** – no account or login needed. Choose **Try a sample patient** on the welcome screen to explore a filled-in diary, or start empty and draw your own. Built mobile-first – best on a phone; on desktop it opens in a phone frame.

Try it in 1 minute:
1. **Home** – check in (“How are you today?”) and tap **New entry**.
2. **Track** – tap a body part (e.g. the jaw or the lower back) to zoom in, pick a pain level 1–10 and **Draw**. Use **Front / Back** to turn the body around.
3. Open **Pain details** – when it happened, sensations, duration, pattern, possible triggers and daily-life impact (0–10 per activity).
4. **History** – see the pain trend (7D/30D/90D), the diary timeline and patterns; **Download PDF** for your doctor.

## Features
- **Draw exactly where it hurts** – freehand, circled areas and arrows for pain that spreads, precise at every zoom level (drawings are stored in body coordinates, verified to ~0.1 px)
- **Pain scale 1–10 as color** – every mark carries its level (9 = orange, 10 = red); the entry's intensity follows the strongest color drawn
- **Turn the body around** – Front/Back flip; a zoomed area follows to the other side
- **52 anatomical regions**, left/right aware, down to jaw, temples, ears and chin
- **When & why** – each entry has the time it happened, context (“what were you doing?”), sensations, duration, triggers, symptoms and daily impact
- **Daily check-in** and a **pain trend** chart; **Patterns**: where it hurts most, when it happens, common triggers
- **Report / PDF** – between-visits summary, full body map, enlarged regions and a chronological pain diary
- **Private by design** – everything stays on the device; JSON export/import for sharing
- Accidental-mark protection: Move mode never draws, two fingers always zoom, stylus palm rejection
- **Point marker** for very localized pain and **Mark whole area** as an accessible alternative to freehand drawing; labels on every marking; zoom 1×–8×
- **76 anatomical regions** incl. eyes, ears, jaw, elbows, wrists, fingers, hips, ankles and toes – each side selectable
- **Pattern**, grouped **possible triggers** (recorded as observations, never as causes) and **daily-life impact rated 0–10 per activity**
- **History filters** (period, body area, symptom, intensity, trigger) and charts for intensity, entry frequency and daily-life impact – labelled as patient-reported
- **Safety Center** (disclaimer, worsening symptoms, emergency guidance without assuming any country's emergency number), **Privacy Center** (storage, collection, sharing, export, deletion), **Settings** (date format, clock, opacity) and **About**
- **5-step onboarding** and a clearly labelled **demo mode** with fictional data
- International: English UI, timestamps stored in UTC with time zone, dates in English with the device's regional format

> PAINPRINT is a documentation and communication tool – not a diagnostic or treatment platform. This demo uses fictional data only.

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
| `js/ui.js` | Shared UI helpers: icons, dialogs, popovers, mini body maps |
| `js/track.js` | Track screen: camera (zoom/pan), touch/mouse/stylus input, tools, pain levels, Front/Back, Pain details |
| `js/home.js` | Home: daily check-in, latest entry |
| `js/history.js` | History: pain trend, diary timeline, patterns |
| `js/demo.js` | Sample patient |
| `js/main.js` | App shell: navigation, settings, import/export, report screen |

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
