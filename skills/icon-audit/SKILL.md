---
name: icon-audit
description: Use when asked to audit, inventory, map, or clean up icons/iconography across a codebase — which icon means what, duplicate or contradictory icons, dead icon assets, inconsistent icon usage — or when icons have drifted across mechanisms (icon library, inline SVGs, image assets, CSS masks, unicode glyphs), or when regenerating a previously generated icon-audit page.
---

# Icon Audit

## Overview

Produce a **single standalone HTML page** that inventories every icon in a codebase — rendered glyph, meaning, every usage location with source links, feature/surface attribution — plus a curated issue catalog (contradictions, duplicates, dead assets, broken refs) and a canonical icon-per-meaning decision map.

**Core principle: scripts do the mechanical sweep; your judgment goes into curation.** Reading every file by hand finds issues on a 25-file toy but does not survive a 500-file app and produces a one-off nobody can re-run. The pipeline separates config → extraction data → hand-authored curation → built page, so the audit is **regenerable after each cleanup batch** (the shrinking stats strip is the progress metric) and looks the same across projects.

## When to use

- "Audit/inventory/map our icons", "find duplicate or inconsistent icons", "icon cleanup"
- Symptoms: same action drawn N ways; one glyph with conflicting meanings; icon library + inline `<svg>` + `<img>` assets + unicode `×`/`▾` coexisting; dead icon files
- Re-running: an `audit.config.mjs`/`curation.mjs` already exists → update curation, re-run phases 2 & 5

**Not for:** designing new icons, one-off "what icon should X use" questions.

## Workflow (details: references/methodology.md — read it first)

| Phase | Do | Output |
|---|---|---|
| 1 Recon | Answer the recon table in methodology.md by reading the target codebase; fill `templates/audit.config.example.mjs` | `audit.config.mjs` |
| 2 Extract | `node <skill>/scripts/extract-icons.mjs --config audit.config.mjs --root <repo> --out audit-data.json` then `scripts/digest.mjs` | data + review digests |
| 3 Sweep | In parallel: dispatch a subagent with `references/exotic-sweep-prompt.md` (no subagents? run it yourself as a second pass) (CSS icons, entities, favicons, v-html registries, zombie assets) | findings to merge |
| 4 Curate | Read ALL digests + sweep; author `curation.mjs` from `templates/curation.template.mjs` (meanings, inline-SVG classification, issues, canonical map, coverage notes) | `curation.mjs` |
| 5 Build | `node <skill>/scripts/build-audit.mjs --config … --data … --curation … --out <date>-icon-audit.html`; verify in browser, both themes | the audit page |
| 6 Deliver | Copy config/curation/data + README into the repo (`docs/audits/generator/`); deliver the HTML; summary leads with top findings | regenerable audit |
| 7 Fix loop | Statuses + `verify` predicates live in curation; act via each card's copy-fix-prompt button or the icon-fix skill; re-run flips status, scan referees (methodology “The fix loop”) | shrinking page |

## Quality bar (non-negotiable)

- **Verify before you assert.** Every "broken/dead/zombie" claim gets checked in source. An icon name missing from the registry is a parsing gap until you've grepped the lib for it (three export styles are handled; see methodology).
- **Classify every inline SVG**; mark charts/decor as such — they're inventoried, never icon issues.
- **Canonical map is mandatory** — one icon per meaning; it's the owner's decision sheet.
- **Coverage notes are mandatory** — say what was scanned, excluded (prose glyphs, debug emoji), and unknown. Silent gaps read as "covered".
- Curated glyphs only: prose arrows and console emoji are counted in coverage notes, not reported as icons.

## Red flags — stop and course-correct

| Rationalization | Reality |
|---|---|
| "Small project, I'll just read every file" | Worked once on a toy; costs ~5k tokens/file and produces a one-off. Config + scripts take minutes and make the audit re-runnable. |
| "Raw inventory is enough, skip curation" | An inventory is not an audit. Issues, canonical map, and meanings are the deliverable. |
| "Name not in registry ⇒ broken" | Multi-line/`export {}` styles break naive parsers. Grep the lib first. |
| "I'll hand-write the HTML" | You lose the standard anatomy, filtering, theming, escaping, and regenerability. Extend the builder via curation instead. |
| "Skip the browser check" | Escaping/glyph-rendering bugs only show when rendered. Check both themes. |
