---
name: icon-fix
description: Use when asked to fix, resolve, or execute an issue from an icon-audit page (e.g. "fix X1", "/icon-fix X3", "work through the icon cleanup", "resolve the close-button issue from the audit") in a repo that has a docs/audits icon audit, or when handed a copied fix prompt from an audit page.
---

# Icon Fix

Execute ONE icon-audit issue end-to-end: migrate every listed site, keep the audit truthful, prove it with the re-run. The contract below is the same one the audit page's *copy fix prompt* button and fix dispatcher emit — this skill is the conversational entry point (`/icon-fix X1`, or `next` = highest-severity open issue).

## The contract

1. **Load the work order.** Read `docs/audits/generator/curation.mjs` (+ README) in the target repo; find the issue by id. If it's already `fixed`/`wontfix`, say so and stop. The issue's `refs` are the exact checklist; `rec` is the definition of the fix.
2. **Migrate every ref.** Follow the repo's canonical mechanism (usually the icon library — see the audit's Canonical map). Never introduce new inline SVGs, image-asset icons, or unicode glyph buttons while fixing. Fold in per-site a11y fixes the issue's text calls out (e.g. missing aria-labels), but do NOT creep into other open issues — update their `body` text instead if your change alters their inventory.
3. **Run the repo's gates** (build/tests per its conventions). Commit the code fix first, so the tracking commit can reference it.
4. **Update the ledger** in `curation.mjs`: `status: 'fixed'`, `resolvedIn: '<short commit>'`, a one-line `statusNote`; add a `verify` regex predicate if one can express "0 remaining" (see the curation template); refresh every `file:line` key your edits shifted (`INLINE_META`, `GLYPH_UI`, issue `refs`/`evidence`); delete entries for artwork you removed.
5. **Re-run the audit** (commands in the generator README; scripts live in the icon-audit skill). Exception: when dispatched by the fix-server, skip this — the dispatcher re-runs it for you (your prompt will say so).
6. **Prove it.** The rebuilt page must show: this issue in Resolved with a green scan-verified line (or the re-run's own numbers dropped), the progress header advanced, and **no `?` evidence chips introduced** (a `?` = a curation key you failed to refresh). Check both themes if you changed page-side anything.
7. **Report**: sites migrated, files touched, commit, the before→after stats line, anything skipped and why.

## Red flags

| Rationalization | Reality |
|---|---|
| "Code's fixed, tracking can wait" | Untracked fixes make the page lie. Steps 4–6 ARE the task. |
| "I'll mark it fixed; the scan is a formality" | The rebuild's verify banner will publicly contradict you. Re-run first. |
| "While I'm here I'll fix these other icons too" | One issue per cycle. Note spillover in the other issues' bodies; leave them open. |
| "The skill script has a bug, I'll patch my copy" | Patch the OUTPUT if you must, report the bug in your summary — never silently fork scripts. |
| "Line numbers shifted, close enough" | Stale keys render as `?` chips and broken links. Refresh them. |

**REQUIRED BACKGROUND:** the icon-audit skill's `references/methodology.md` ("The fix loop") — read it if anything above is unclear or the repo's audit predates the fix loop.
