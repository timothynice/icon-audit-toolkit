# Testing the icon-audit / icon-fix skills

`fixture-app/` is a ~25-file synthetic Vue project with **12 planted findings and 2
false-positive traps** — the ground truth is `GROUND-TRUTH.md` (never show it to a test
agent). Use it to regression-test any change to the skills or scripts.

## Script regression (cheap — run after ANY script edit)

```bash
npm test
```
Expected extraction: 6 registry icons (across all three export styles), 8 inline SVGs,
3 public assets, 1 unknown icon string (`IconGhost` — a PLANTED broken ref, the one
legitimate unknown), 0 hits for `IconExample` (doc comment) or `IconKind` (TS generic).
The builder must self-check its emitted page script (`new Function`) — a build that
writes a page whose script doesn't parse is a builder bug.

## Audit-quality test (subagent, ~20 min)

Give an agent the fixture and the user-style task ("create a standalone HTML page that
comprehensively audits the icons…"), with the skill available. Grade against
GROUND-TRUTH.md: 12/12 findings, 0 false positives, plus the structural bar — config +
data + curation + regenerable README produced, standard page anatomy (stats, mechanism
bars, issues with severity, canonical map, coverage notes), both themes verified.

## Fix-loop test (subagent, ~20 min)

Copy `fixture-app` + a generated audit into a git-initialized temp repo, then task an
agent: "Fix <the close/dismiss issue> and keep the audit's tracking up to date."
Pass = all listed sites migrated, scoped commits, status flipped with `resolvedIn`,
stale file:line keys refreshed, obsolete curation entries retired, audit re-run, page
shows the issue Resolved with scan-verified 0 matches and the progress header advanced.

## Dispatcher plumbing test (minutes, no tokens)

Run `scripts/fix-server.mjs` against the temp repo with `--runner "node <stub>"` where
the stub reads `$ICON_FIX_PROMPT_FILE`, emits a few stream-json lines, performs one real
edit + status flip, and exits 0. Then: `POST /fix`, watch `/events` SSE, and assert the
rebuilt page reflects the change. (History: this exact protocol validated the loop —
and the with-artifacts baseline run passed the fix-loop test with NO skill installed,
which is why icon-fix is deliberately a thin contract, not a process manual.)
