// Completeness audit: diffs our DATA variant lineup against a grounded source.
// Complements verify (which only checks internal resolvability). Flags models
// whose variant COUNT/NAMES diverge from the real-world lineup, so a human
// reviews only the flagged few instead of all models.
//
// Usage:  node tools/audit-coverage.mjs            # audit every model
//         node tools/audit-coverage.mjs R15 FZ-X   # audit matching models
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../index-revised.html", import.meta.url), "utf8");
const s = html.indexOf("const DATA = {"), e = html.indexOf("\n};", s);
const DATA = eval("(" + html.slice(s + "const DATA = ".length, e + 2) + ")");

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const KEY = (env.match(/^GEMINI_API_KEY=(.*)$/m) || [])[1];
if (!KEY) { console.error("No GEMINI_API_KEY in .env"); process.exit(1); }

const filters = process.argv.slice(2);
const want = ([k, m]) => !filters.length || filters.some(f => (m.make + " " + m.model).toLowerCase().includes(f.toLowerCase()));

const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function ground(make, model) {
  const prompt = `For the ${make} ${model} (India, 2015-2026), count the COMPLETE official variant lineup: every distinct hardware/trim variant PLUS every NAMED special edition (e.g. Super Squad, MotoGP, Carbon, Knight). EXCLUDE plain colour options (Racing Blue, Red, etc.) that are the same hardware. End your reply with one line in EXACTLY this format and nothing after it:\nAUDIT: <number> | name1; name2; name3`;
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] })
      });
      const d = await r.json();
      const txt = (d.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
      const line = (txt.match(/AUDIT:\s*(\d+)\s*\|\s*(.*)$/m));
      if (line) return { count: +line[1], names: line[2].split(";").map(x => x.trim()).filter(Boolean) };
    } catch {}
    await new Promise(r => setTimeout(r, 6000));
  }
  return null;
}

const rows = [];
for (const [k, m] of Object.entries(DATA).filter(want)) {
  const ours = []; m.generations.forEach(g => g.variants.forEach(v => ours.push(v.name)));
  const src = await ground(m.make, m.model);
  if (!src) { rows.push({ model: m.model, ours: ours.length, src: "?", flag: "NO DATA" }); continue; }
  // flag if counts differ by >=2, or source has named items absent from ours
  const ourNorm = ours.map(norm);
  const missing = src.names.filter(n => !ourNorm.some(o => o.includes(norm(n)) || norm(n).includes(o)));
  const delta = src.count - ours.length;
  const flag = (Math.abs(delta) >= 2 || missing.length >= 2) ? "⚠ REVIEW" : "ok";
  rows.push({ model: m.model, ours: ours.length, src: src.count, delta, missing: missing.slice(0, 6).join(", "), flag });
  console.log(`${flag === "ok" ? "  " : flag} ${m.model.padEnd(22)} ours=${ours.length}  source=${src.count}  ${missing.length ? "missing: " + missing.slice(0,6).join(", ") : ""}`);
}
const flagged = rows.filter(r => r.flag !== "ok");
console.log(`\n${rows.length} models audited · ${flagged.length} flagged for human review`);
