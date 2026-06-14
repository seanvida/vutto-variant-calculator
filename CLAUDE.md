# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project

**Vutto Variant Calculator** — a single-file web tool that identifies the exact variant of a
used two-wheeler by walking the user through a short, model-specific question flow, using only
**easy visual cues** a person can see on the bike. Built for Vutto's pre-owned two-wheeler
operations (inspection / cataloguing).

No build step, no framework, no runtime deps. Everything lives in one HTML file (only external
resource is Google Fonts — Plus Jakarta Sans).

Hosted on GitHub Pages: https://seanvida.github.io/vutto-variant-calculator/
(repo `seanvida/vutto-variant-calculator`). Pushing to `main` auto-redeploys.

## Files (read this first)

| File | Role |
|------|------|
| **`index-revised.html`** | **CANONICAL / current build.** 14 models, enforced 3-step flow (Model → Year → cues), year groups from 2015. Edit this one. |
| `index-extended.html` | Prior 14-model build (year step auto-skipped for single-gen). Kept for history. |
| `index.html` | Original 10-model build. Clean rollback point. Still what `/` serves. |
| `variants-new-4-models.csv` | Visual-cue spec reference for the 4 newest models (Splendor Plus, HF Deluxe, Radeon, Activa 125). |
| `variant-cues.csv` | Master taxonomy of all differentiating cues + how to spot each + visual-verifiability. |
| `.env` | `GEMINI_API_KEY` (working). Gitignored — never commit. |

> When promoting a build to be the live homepage, copy it over `index.html` (don't break the
> root URL). Confirm with the user before overwriting `index.html`.

## Development

```
python3 -m http.server 8080      # then open http://localhost:8080/index-revised.html
```
No lint/test/build pipeline. Verification = the Node simulation below + a browser walk-through.

## The finalized flow (applies to every model)

1. **Choose Model** — buttons grouped by brand.
2. **Choose Year group** — ALWAYS shown, even for single-generation models (one button then).
   This is deliberate: it forces year-coverage thinking so no era's variants get missed.
3. **Answer visual-cue questions** — asked one at a time, in the order defined per year group.
   Flow ends early the moment one variant is uniquely matched.

State machine: `{ modelKey, genIndex, answers, override }` with a `render()` dispatcher.
Step numbering is fixed: 1 = model, 2 = year, 3+ = questions.

## Data model

```js
"Make|Model": {
  make, model,
  generations: [
    {
      yearLabel: "2023 – 2026 (…)",          // human-readable era; see year-grouping rules
      questions: ["<col>", "<col>", …],       // visual cues, in the order to ask them
      variants: [ { name, specs: { "<col>": "<value>", … } }, … ]
    }
  ]
}
```
- `QMETA[col]` supplies the friendly question label + hint. Every key used in `questions` /
  `specs` MUST exist in `QMETA` (add it there if new).
- `BRAND_ORDER` controls brand grouping in the picker — add new brands there.

## Engine behaviours (don't re-derive these — they're settled)

- **Year step always shown** (`render()` routes to `renderYearPicker` whenever `genIndex === null`).
- **Auto-skip non-discriminating questions:** a question is only asked if the remaining
  candidates have ≥2 distinct values for it. So you can list a cue in `questions` for the
  spec recap even when it rarely discriminates — it'll be skipped when redundant.
- **Early termination:** as soon as candidates collapse to 1, remaining questions are skipped.
- **Comma = multiple values.** `"Graphite Grey, Dapper Grey"` means several colours → one
  variant. ⚠️ NEVER put a comma inside a single descriptive value (e.g. a colour like
  `"Gold pinstriped, blacked-out"`) — it will split into phantom options. Use `&` / `with` / `+`.
- **Blank spec value = wildcard** (never eliminates a variant).
- **Genuine visual twins → pick-list.** If two variants share identical *visual* specs (e.g.
  i3S vs non-i3S, which differ only by a badge), leave them indistinguishable; the tool shows
  an "almost there" pick-list. That IS the honest "can't tell visually" call-out.
- **Override + editable breadcrumbs** are always available.
- Keyboard: `1–9` select options, `Backspace`/`Esc` go back one step.

---

## PLAYBOOK — adding the next set of models

Follow this order every time. Budget ~1 research call + a few data edits per model.

### Step 0 — Decide the file
Edit `index-revised.html` (canonical). Add each model object to `DATA`; add the brand to
`BRAND_ORDER` if new; add any new cue key to `QMETA`.

### Step 1 — Research with Gemini (grounded)
The key is in `.env`. Use `gemini-2.5-flash` with Google Search grounding:
```bash
KEY=$(grep '^GEMINI_API_KEY=' .env | cut -d= -f2-)
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=$KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"<prompt>"}]}],"tools":[{"google_search":{}}]}'
```
Ask, per model: full variant list **grouped by year/era from 2015**, and for each variant the
**visual** cues (wheel type, front/rear brake disc-vs-drum, headlamp halogen-vs-LED, meter
type, start type, smart key, colour/theme). Explicitly ask "what changed year-over-year" and
"which distinctions are NOT visible (badge-only, Bluetooth, i3S, engine internals)".

### Step 2 — Build year groups (the spine)
Split the model's life (2015 → now) into eras where the **variant lineup or feature set
changed**. Common triggers: BS4→BS6→OBD2 emission steps, a platform/generation change, a
mid-cycle "smart"/connected/TFT update. Label each `yearLabel` with an explicit range:
`"2015 – 2020 (…)"`, `"2023 – 2024 (OBD2)"`, `"2025 onwards (TFT)"`. If the lineup never
changed, use a single group `"2015 – 2026 (all years)"` — still a real step in the UI.

### Step 3 — Per group, pick the ordered visual-cue questions
Decision tree for ordering `questions` (most-discriminating, most-visible first):
1. **Lead with the most obvious physical cue** that splits the group — usually
   `Wheel Type` (steel/alloy/spoke), `Meter Type` (analogue vs digital/TFT), or a brake
   (`Front`/`Rear Brake Type` disc-vs-drum). Prefer a cue that resolves a whole branch.
2. Then the next-most-visible cue, narrowing each branch.
3. Put **partial-visibility cues last** (e.g. `Self Start` = look for the e-start button;
   `Smart Key` = look for a keyless knob).
4. List `Colour` last (separates trims that are otherwise identical).
5. You may include a non-discriminating cue purely so it shows in the result recap — it'll
   auto-skip during questioning.
- Map each cue to the canonical `QMETA` key. Reuse existing keys; only add a new `QMETA`
  entry for a genuinely new cue.

### Step 4 — Handle non-visual distinctions honestly
If two variants differ only by something you can't see (i3S badge, Bluetooth pairing, engine
internals), give them **identical visual specs** so they fall to the pick-list. Do NOT invent
a fake visual difference. (Record the real difference in the CSV's "Visually Verifiable" column.)

### Step 5 — Validate (must be 0 mismatches)
Run the Node simulation (below) — it replays the real engine over every variant. Expect
`mismatch 0`. "Ambiguous" rows are fine **only** when they're intended visual twins.

### Step 6 — Browser smoke-test
Serve, open the file, walk one new model end to end (Model → Year → cues → result). Check the
year crumb, early-termination pills, and that no colour value split into phantom options.

### Step 7 — Sync + ship
Update the relevant CSV, then commit & push. Confirm `.env` is NOT staged
(`git check-ignore .env`). Verify the live URL serves the change.

### Verification snippet (Node — paste into a temp `.mjs`)
```js
import { readFileSync } from "node:fs";
const html = readFileSync("index-revised.html","utf8");
const s = html.indexOf("const DATA = {"), e = html.indexOf("\n};", s);
const DATA = eval("("+html.slice(s+"const DATA = ".length, e+2)+")");
const sp=r=>!r?[]:r.split(",").map(x=>x.trim()).filter(Boolean);
const vm=(v,k,val)=>{const r=v.specs[k];return r===undefined||r===""?true:sp(r).includes(val);};
const cand=(g,a)=>g.variants.filter(v=>a.every(x=>vm(v,x.key,x.value)));
const opt=(k,vs)=>{const o=[];vs.forEach(v=>sp(v.specs[k]).forEach(x=>o.includes(x)||o.push(x)));return o;};
const nq=(g,a,c)=>{const k=new Set(a.map(x=>x.key));for(const q of g.questions){if(!k.has(q)&&opt(q,c).length>=2)return q;}return null;};
let ok=0,amb=0,err=0,V=0;
for(const[,m]of Object.entries(DATA))m.generations.forEach(g=>g.variants.forEach(t=>{V++;const a=[];let n=0;
 while(n++<20){const c=cand(g,a);if(c.length<=1)break;const k=nq(g,a,c);if(!k)break;const p=sp(t.specs[k]).find(v=>opt(k,c).includes(v));if(p===undefined)break;a.push({key:k,value:p});}
 const f=cand(g,a).map(v=>v.name);
 if(f.length===1&&f[0]===t.name)ok++;else if(f.includes(t.name))amb++;else{err++;console.log("MISMATCH",m.model,t.name);}}));
console.log(`variants ${V} | unique ${ok} | ambiguous ${amb} | mismatch ${err}`);
```

---

## Design system (Vutto brand — do not substitute)

- **Font:** Plus Jakarta Sans (headings 800, tight tracking; body 400–600).
- **Colors (`:root` vars):** rose `#D23757` (primary/CTA/accent), ink `#111111` (headings),
  white bg, `#FCE8EF` pink pills/badges, green `#22C55E` positive ticks, greys for body.
- **Motion:** atmospheric pink radials + faint grid; staggered reveals; animated check +
  confetti on result; progress rail. Respects `prefers-reduced-motion`.

Keep every build on-brand, dependency-free, and single-file.

## Data provenance

Original 10 models came from the source Google Sheet
(`docs.google.com/spreadsheets/d/1rHQSKc_lLPY3HqugLSC8QgySSonMSbNjDIlHT6mnjGQ`, Variants +
Journey tabs). The 4 newest models were researched via Gemini + Google Search grounding (see
Playbook Step 1) — flag any web-sourced spec for human confirmation before relying on it.

## Secrets

`.env` holds a real, working `GEMINI_API_KEY` (used for research, see Playbook). It is
gitignored. ⚠️ The hosted page is **static** — never call Gemini directly from the browser
(the key would be exposed). A "search any unknown model" feature needs a server-side proxy
holding the key. Rotate the key if it's ever pasted into a public channel.
