# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

## Project

**Bike Variant Finder** — a single-file web tool that identifies the exact variant of a
two-wheeler by walking the user through a short, model-specific question flow. Built for
differentiating variants of the same model (e.g. Royal Enfield Classic 350 → "Heritage" vs
"Dark" vs "Signals") based on the features that actually differ between them.

There is no build step, no framework, and no runtime dependencies. Everything lives in
`index.html`.

## Development

Open `index.html` directly in a browser, or serve locally:

```
python3 -m http.server 8080
# then visit http://localhost:8080
```

There is no lint, test, or build pipeline.

## Data source

All data was transcribed from a Google Sheet
(`docs.google.com/spreadsheets/d/1rHQSKc_lLPY3HqugLSC8QgySSonMSbNjDIlHT6mnjGQ`):

- **Variants tab** — the spec matrix: one row per `Make / Model / Variant`, with the
  distinguishing feature columns (Abs, Wheel Type, Self Start, Adjustable Levers,
  LED Indicators, Meter Type, Front/Rear Brake Type, Backrest, Windscreen, Headlight,
  USB Charging Port, Ride Modes, Smart Key, Colour) plus Manufacturing Year/Month buckets.
- **Journey tab** — the ordered list of questions to ask per `Make / Model / Year` bucket
  (columns `1st`…`6th`), plus the intended UX flow.

The giant ID-keyed catalog tab in the sheet is the full vehicle list and is **not** used by
this tool — only the Variants + Journey tabs matter here.

If the sheet changes, update the `DATA` object in `index.html` to match. Each model entry is:

```js
"Make|Model": {
  make, model,
  generations: [
    { yearLabel, questions: [<column keys in ask order>], variants: [ { name, specs: {<col>: <value>} } ] }
  ]
}
```

## Architecture (`index.html`)

- **CSS** — in `<head>`; dark theme driven by CSS custom properties in `:root`.
- **DATA** — the transcribed sheet data (Variants + Journey), keyed `"Make|Model"`.
- **QMETA** — friendly question label + hint for each spec column.
- **Engine / state** — a small state machine (`{ modelKey, genIndex, answers, override }`)
  with a `render()` dispatcher. Key behaviours mirror the Journey tab's intent:
  - Year/generation step is **auto-skipped** when a model has only one generation.
  - Questions are asked in the sheet's order, but any question that can no longer
    discriminate among the remaining candidates is **auto-skipped**.
  - As soon as the candidate set collapses to one variant, remaining questions are
    **not asked** (early termination).
  - Comma-separated colour values map several colours to one variant; a blank spec value
    is treated as a wildcard (never eliminates a variant).
  - If two+ variants share identical recorded specs, the tool presents them as a final
    pick list rather than guessing.
  - The user can always **override** the suggestion and pick any variant manually.
  - Breadcrumb chips let the user jump back and edit any earlier answer.

## Conventions

- Spec column keys in `DATA[...].variants[].specs` must match the keys used in
  `generations[].questions` and in `QMETA` exactly (case-sensitive).
- Keep it dependency-free and single-file. Do not add a build step.

## Secrets

`.env` holds a placeholder `GEMINI_API_KEY` for future AI features. It is **not** currently
wired into the app (the matching logic is fully deterministic). `.env` is gitignored.
