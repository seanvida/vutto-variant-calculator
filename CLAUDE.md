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
| **`index.html`** | **THE single canonical + LIVE file** (served at `/` by GitHub Pages). 34 models, enforced 3-step flow (Model → Year → cues), year groups from 2015, fuzzy model **search box** at Step 1, and the `VUTTO_MAP` Vutto-Calculator mapping. **Edit this one directly** — there is no separate "revised" file or promote step anymore. Rollback = git history. *(Prior `index-revised.html` / `index-extended.html` builds were consolidated into this file; recover from git if ever needed.)* |
| `vutto-variant-mapping.csv` | **Go-to reckoner** — our variant → Vutto-Calculator variant name. First 4 cols (Make, Model, Year Group, Variant) match `final34_models.csv` exactly; last col `Vutto Variant` is what the result screen shows. Drives the embedded `VUTTO_MAP`. Regenerate `VUTTO_MAP` from this whenever it changes. |
| `final34_models.csv` | **Master variant repository** — all 34 models / 193 variants with their visual-cue specs + diagnostic question order. Regenerated directly from `DATA` (see `/tmp/gencsv.mjs` pattern) so it always mirrors `index.html`. |
| `variants-new-4-models.csv` | Visual-cue spec reference for the first 4 web-sourced models (Splendor Plus, HF Deluxe, Radeon, Activa 125). |
| `variant-cues.csv` | Master taxonomy of all differentiating cues + how to spot each + visual-verifiability. |
| `.env` | `GEMINI_API_KEY` (working). Gitignored — never commit. |

> `index.html` is both the file you edit and the file that ships — there is no promote step.
> Validate (Node sim, below) before committing so you never push a broken root URL.

## Development

```
python3 -m http.server 8080      # then open http://localhost:8080/index.html
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
- **Single-variant generations are fine.** A generation may have one variant and
  `questions: []`; the engine resolves it the moment the year is chosen (`candidates.length <= 1`
  → result). Used for thin models (Activa 3G/4G, FZ-X, Destini Prime, Splendor Plus Xtec eras).
- **Override + editable breadcrumbs** are always available.
- **Model search box (Step 1):** `renderModelPicker` shows a fuzzy search input above the brand
  groups. `fuzzyScore()` ranks by contiguous-substring → subsequence → partial; `Enter` picks the
  top match. The `<input>` element is kept stable and only the results region (`host`) repaints on
  each keystroke — do NOT call full `render()` on input, or focus/characters are lost. The global
  `keydown` shortcut handler bails when an `INPUT`/`TEXTAREA` is focused so typing digits (125/150)
  doesn't trigger the `1–9` option shortcuts.
- Keyboard: `1–9` select options, `Backspace`/`Esc` go back one step (disabled while the search box
  is focused).
- **Vutto-Calculator mapping callout.** `const VUTTO_MAP` (embedded, keyed
  `Make|Model|Year Group|Variant` → Vutto variant name) is built from `vutto-variant-mapping.csv`.
  On the result screen, `vuttoCallout()` shows a pink **"Choose variant `X`"** box (with a Copy
  button) under the matched variant; the pick-list shows each option's Vutto name as a `Vutto: …`
  sub-label. No mapping → callout hidden. To regenerate after the CSV changes: rebuild the
  `VUTTO_MAP` block (parse CSV → `Make|Model|Year Group|Variant: "Vutto Variant"`), replace the
  block before `const QMETA`, and verify 0 unmapped against `DATA` before committing.

---

## PLAYBOOK — adding the next set of models

Follow this order every time. Budget ~1 research call + a few data edits per model.

### Step 0 — Decide the file
Edit `index.html` (the single canonical file). Add each model object to `DATA`; add the brand to
`BRAND_ORDER` if new; add any new cue key to `QMETA`.

### Variant definition (settled with the user)
A "variant" = every **hardware/trim** variant **plus every NAMED edition** (Super Squad,
MotoGP, Carbon, 100/125 Million, Knight…). **Plain colours are NOT separate variants** — add a
colour/edition only when it has an official edition name. Encode named editions as extra
variants discriminated by the `Colour` cue (or as a pick-list twin when truly badge-only).
Consequence: our counts are intentionally LOWER than a raw Gemini/dealer list that enumerates
every paint — the audit (below) excludes plain colours so the comparison is fair.

### ⚠️ Gemini free-tier quota (operational reality)
The free key allows only **20 grounded `generateContent` requests per DAY per model**
(`GenerateRequestsPerDayPerProjectPerModel-FreeTier = 20`). Grounded research + the coverage
audit both draw from this. So: **budget calls** (1 deep call per model, don't batch-burn),
expect 429 `RESOURCE_EXHAUSTED` once spent (its "retry in ~45s" is misleading — it's a daily
cap), and for a full 24-model re-research + audit in one day you need a **paid key**. Cap resets
~midnight Pacific.

### Coverage audit (completeness guardrail) — `tools/audit-coverage.mjs`
`node tools/audit-coverage.mjs [name…]` diffs our DATA lineup against a grounded source per
model and flags only the divergent ones. This is the guard the Node sim can't be: the sim
proves listed variants *resolve*; the audit proves the *list is complete*. Run it after any
batch (costs ~1 grounded call/model — mind the 20/day cap). Review only flagged models.

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

#### ⚠️ Cue-selection guardrails (learned from real inspector feedback)
A cue can uniquely resolve a variant in the Node sim and still be the *wrong* cue for a
human in a yard. Pick the cue an inspector can actually verify at a glance:
- **Distrust steel-vs-alloy wheels on scooters & commuters.** Steel wheels wear full covers
  that mimic alloys, so `Wheel Type` is an unreliable lead marker. Prefer the **instrument
  cluster** (`Meter Type`: analogue vs semi-digital vs SmartXonnect) or the **headlamp**
  (`Headlight`: halogen vs LED), which are unmistakable. *(This is exactly why Jupiter now
  leads with `Meter Type` and Activa 6G with `Headlight`.)* Only fall back to `Wheel Type`
  as a final tie-break when it is genuinely the sole difference (e.g. Jupiter Drum vs Drum
  Alloy).
- **Lead with the cue that defines the trim, not the cue that happens to differ.** Trims are
  usually defined by console / lighting / brakes; wheels often just track the trim and are
  hard to read.
- **`Seat Type` (single vs split) is a real, easy, under-used cue.** Many 125/150 commuters
  split a trim purely by one-piece vs split rider+pillion seat (Pulsar 125, Raider 125, Xtreme
  125R). It's unmistakable in the yard — use it whenever it's the genuine differentiator.
  *(Round-1 field feedback found Pulsar 125 & Raider 125 seat variants were missing entirely
  because seat type wasn't being modelled as a cue.)*
- **`Bluetooth` is now an askable cue, not always a pick-list twin.** The owner can confirm
  connectivity (and the console shows call/SMS alerts), so a BT-only trim can be split with the
  `Bluetooth` question (Yes/No) rather than collapsed. Only fall back to the pick-list when the
  *other* distinction is also invisible (e.g. a Racing-livery badge twin that already has BT).

### Step 4 — Handle non-visual distinctions honestly
If two variants differ only by something you can't see **and can't be asked** (i3S badge,
engine internals), give them **identical visual specs** so they fall to the pick-list. Do NOT
invent a fake visual difference. (Record the real difference in the CSV's "Visually Verifiable"
column.) **Exception — askable cues:** Bluetooth/connectivity is now captured by the `Bluetooth`
question because the owner can confirm it; prefer asking over a pick-list when the cue is askable.

### Step 5 — Validate (must be 0 mismatches)
Run the Node simulation (below) — it replays the real engine over every variant. Expect
`mismatch 0`. "Ambiguous" rows are fine **only** when they're intended visual twins.

> ⚠️ The sim only proves the chosen cue path **resolves** each *listed* variant. It does NOT
> prove the cue is the right real-world one, nor that the variant list is **complete** (it
> can't catch a missing variant like the Pulsar NS125 ABS, or a phantom one like the Classic
> 350 KS). So Step 5 must be paired with: (a) the cue guardrails in Step 3, and (b) an
> explicit lineup-completeness check in Step 1 — ask Gemini to list *every* variant including
> ABS/CBS and mid-cycle additions, and to confirm which trims were **never sold**.

### Step 5b — Completeness audit (MANDATORY GATE — do not skip)
The sim cannot see a *missing* variant. So for **every model you add or edit**, run:
```
node tools/audit-coverage.mjs "<Model>"      # e.g. "Pulsar 125"
```
It diffs our lineup against a grounded source and prints `⚠ REVIEW` with the variants we lack.
**Resolve every flag before shipping** — either add the missing variant, or consciously decide
it's out of scope per the variant definition (plain colour, not a named edition). This is the
guard that catches the "Pulsar 125 Neon was missing" class of bug — that slipped precisely
because this step had never been run (Gemini quota was exhausted; see quota note above).
Mind the 20/day quota: audit the models you touched, not all 34, unless on a paid key.

> **Do not ship un-audited when quota is exhausted.** If the 20/day cap blocks the audit,
> either wait for the reset (~midnight Pacific) / use the paid key, or do a manual lineup
> check against the brand's official site before shipping. The Round-1 misses below were all
> "shipped without the completeness gate." A real **field test by the team is itself a valid
> completeness audit** — treat that feedback as authoritative (it outranks Gemini grounding).

### Step 7 — Sync + ship
Update the relevant CSV, then commit & push. Confirm `.env` is NOT staged
(`git check-ignore .env`). Verify the live URL serves the change.

### Verification snippet (Node — paste into a temp `.mjs`)
```js
import { readFileSync } from "node:fs";
const html = readFileSync("index.html","utf8");
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
Journey tabs). The other 8 models — Splendor Plus, HF Deluxe, Radeon, Activa 125 (set 1) and
Honda SP125, Suzuki Access 125, TVS Raider 125, TVS Apache RTR 160 4V (set 2) — were
researched via Gemini + Google Search grounding (see Playbook Step 1), as were the **set-3**
16 models (TVS Sport, Pulsar 125, Xtreme 125R, Activa 5G, Splendor Plus Xtec, Pulsar 150,
Activa 3G/4G, Shine 100, Apache RTR 200 4V, Platina 110, Platina 100, Shine 125, Glamour Xtec,
FZ-X, Destini Prime, R15 V4). Flag any web-sourced spec for human confirmation before relying
on it — set-3 in particular leans on recent web data (some 2025/26 trims). Notes:
- `Apache RTR 160 4V` / `Apache RTR 200 4V` are separate model objects from the 2V `Apache RTR 160`.
- `Honda|Activa 3G / 4G` is one model object with two year groups (matching how it was requested);
  `Splendor Plus Xtec` is its own cluster, separate from the `Xtec` *variant* inside `Splendor Plus`.
- Brands added over time and present in `BRAND_ORDER`: `Suzuki` (set 2), `Yamaha` (set 3).
- `Front Suspension` cue (telescopic vs golden USD forks) is shared by the Apache 4V/200 4V and R15 V4.

### Round-1 team field-test feedback (applied — 193 variants total)
The team test-drove all 34 models in the yard and returned an add/remove list. Applied to
`index.html` + `final34_models.csv`. **Added:** Platina 110 `ABS` (Dec-2022 launch →
its own `2023 – 2026 (ABS added)` year group, CBS Drum/Disc continue); Bullet 350 `Electra
Twinspark (Double Disc)` (UCE era); Raider 125 `Single Seat - Disc` & `Split Seat - Disc`
(2023-24 & 2025-26 groups). **Removed:** Splendor Plus `Drum Spoke (Kick)`, `Self Spoke`,
`Disc (2025+)`; FZ-X `Hybrid (2025+)`. New cue keys: `Seat Type` (already existed), `Bluetooth`
(new — askable). **Pulsar 125 finalised at 10 variants** (team-defined): Neon ×2 (Drum, Disc) in
the `2019 – 2023 (Neon)` group; in the `2024 – 2026 (current lineup)` group → Drum ×2 (Single/Split
Seat), Disc ×2 (Single Seat = **halogen**, Split Seat = **LED**), Carbon Fibre ×4 (Single, Split,
Single Bluetooth, Split Bluetooth). The old `Disc (Standard)` / `Carbon Fibre Edition` entries were
dropped in favour of this seat/headlight/Bluetooth split.

**Why these slipped (root cause → fix):**
- *Missing seat-type variants (Pulsar 125, Raider 125):* seat type wasn't modelled as a cue
  for commuters, so whole branches of the lineup were invisible. → `Seat Type` promoted to a
  first-class cue in the Step-3 guardrails; use it wherever it's the real split.
- *Missing trims (Platina 110 ABS, Bullet double-disc Electra):* the completeness audit
  (Step 5b) was never actually run on these — same quota-exhaustion root cause as the original
  Pulsar Neon miss. The sim only proves *listed* variants resolve; it can't see a gap. → audit
  gate hardened (don't ship un-audited; team field test counts as an audit).
- *Phantom trims removed (Splendor spoke/kick base trims, FZ-X Hybrid, Splendor Disc 2025+):*
  over-enumeration from speculative recent (2025/26) web data and base trims not in the used
  market — exactly the "flag web-sourced 2025/26 specs" risk noted above. → be conservative
  with speculative recent trims; only add when confirmed, and prefer removing on field feedback.
- ⚠️ The Round-1 ADD specs (brake/headlight/console per new variant) were **inferred** from the
  variant names + existing data and still need **human confirmation** of exact visual cues.

## Secrets

`.env` holds a real, working `GEMINI_API_KEY` (used for research, see Playbook). It is
gitignored. ⚠️ The hosted page is **static** — never call Gemini directly from the browser
(the key would be exposed). A "search any unknown model" feature needs a server-side proxy
holding the key. Rotate the key if it's ever pasted into a public channel.
