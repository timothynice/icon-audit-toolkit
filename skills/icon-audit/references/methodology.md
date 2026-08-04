# Icon audit methodology

Six phases. The scripts do the mechanical work; phases 1 and 4 are judgment work and are
where audit value lives. Do not skip phase 4 review — an uncurated dump is an inventory,
not an audit.

## Phase 1 — Recon (before touching the scripts)

Answer these by reading the codebase; every answer maps to a config field:

| Question | Where to look | Config field |
|---|---|---|
| How are icons drawn? (component lib? name-string registry? inline svg? img assets?) | grep `import .*icon` (case-insensitive), `<svg`, `<img`, sample components | `icons.*`, `registry` |
| What naming pattern do icon components use? | the icon lib's exports | `icons.componentTag` / `nameString` |
| Is there a render-by-name host (AnyIcon, Icon, DynamicIcon)? | grep the lib | `icons.dynamicHost/Prop` |
| Where does icon artwork live? | icon lib source, possibly in node_modules or a sibling checkout | `registry.sources` (dir may be absolute) |
| Static icon files served from public/? | `public/**`, grep `/icons/` `/img/` | `publicAssets.dirs` |
| How does the app switch views/pages? | App shell, router | `views.roots` + `views.meta` (one entry per surface + each global chrome piece) |
| Deep-linkable routes? Deployed URL? Repo URL? | router/hash handling, CI/pages config, `git remote -v` | `views.meta[].hash`, `links.*` |
| Import aliases? | tsconfig/vite config `paths`/`alias` | `aliases` |
| External UI library whose components render their own icons? | package.json, imports | `libScan` |

Fill `templates/audit.config.example.mjs` → `docs/audits/generator/audit.config.mjs` in the
target repo. **views.roots is load-bearing**: files reachable from no root are marked
UNREACHED, which powers dead-code and zombie-asset findings. Root each view at the
component(s) its view-switch branch renders, plus one root per global chrome piece
(nav, top bar, palettes, app-level modals); set `shellView` to the app shell so it doesn't
paint every file.

## Phase 2 — Extract

```bash
node <skill>/scripts/extract-icons.mjs --config audit.config.mjs --root <repoRoot> --out audit-data.json
node <skill>/scripts/digest.mjs audit-data.json <digest-output-dir>
```

Read the console summary. Then, before anything else, resolve **unknown icon strings**:
a name matching the icon pattern but absent from the registry is either a real broken
reference (report it) or a registry-parsing gap (fix the config). Known export styles the
`indexAsyncExports` strategy handles — verify against these before declaring "broken":

```ts
export const IconX = defineAsyncComponent(() => import("./IconX.vue"));
export const IconY = defineAsyncComponent(          // multi-line form
	() => import("./IconY.vue"),
);
const IconZ = defineAsyncComponent(() => import("./IconZ.vue"));  // exported later via export { IconZ }
export { default as IconW } from "./IconW.vue";
```

If the lib uses another style, grep the lib for the name FIRST; only report "broken" when
the name is truly absent.

## Phase 3 — Exotic-pattern sweep (parallel subagent)

Naive scans miss whole mechanisms. Dispatch a read-only exploration subagent with
`references/exotic-sweep-prompt.md` (fill the placeholders) **in parallel with phase 2** —
or, if your agent has no subagents, run the same prompt yourself as a dedicated pass.
It hunts: unicode/emoji glyph buttons, HTML-entity glyphs, CSS `mask`/`background-image`
icons, data-URI select carets, `::before/::after` content glyphs, border-drawn triangles,
status-dot systems, `<img>` icons, icon fonts, favicon/PWA icons, SVG-strings-in-JS
(v-html registries), string-keyed icon maps, and dead/zombie public assets.

Cross-check its findings against the extractor's (the extractor also scans glyphs and
entities; the sweep adds CSS mechanisms, judgment, and the "what does it mean" layer).

## Phase 4 — Curation (the audit's value)

Read the digests END TO END (digest-icons, digest-inline, digest-misc, digest-public,
digest-glyphs, digest-unreached). Author `curation.mjs` from
`templates/curation.template.mjs`. Quality bar:

- **Classify every inline SVG** (label + meaning + group; kind `chart`/`decor` for
  data-viz and ornament — inventoried but excluded from icon issues).
- **Verify every "broken/dead" claim in source before publishing it.** Open the file.
  A favicon claim means checking the file exists; a zombie claim means confirming nothing
  imports the referencing component.
- **Glyph curation:** keep UI-role glyphs; exclude prose arrows, debug/console emoji,
  keyboard-shortcut hints (list them in COVERAGE_NOTES with counts instead).
- **Meanings come from context**, in priority order: aria-label/title/tooltip → click
  handler name → sibling label text → icon name (lowest confidence).
- **Issue taxonomy:** `contradiction` (one icon, conflicting meanings) · `duplicate`
  (one meaning, many artworks/mechanisms) · `fragmentation` (icons outside the canonical
  mechanism: inline svg, v-html strings, public img, css) · `broken` (missing favicon,
  dangling refs, dead/zombie assets, base-path bugs) · `hygiene` (naming/typos/legacy) ·
  `a11y` (icon-only controls without accessible names; decorative glyphs not aria-hidden).
- **Severity:** high = broken today or the largest coherence win; med = real contradiction
  needing a decision; low = hygiene to fold into adjacent work.
- **Every issue**: plain-language body with concrete inventory ("drawn 8 ways: …"),
  evidence glyph refs (they render from the real assets), refs (file+line for EVERY
  affected site — this is the work order), one actionable `rec`.
- **Canonical map (CANON):** one row per meaning — the decision sheet. This is the single
  most useful artifact for the icon owner; don't skip it.
- **COVERAGE_NOTES:** state what was scanned, how attribution works, what was excluded,
  and known gaps. Audits that admit limits get trusted; silent gaps read as "covered".

Classic findings to actively hunt (all found in real audits): close/dismiss drawn N ways;
chevron/caret mechanism sprawl (lib + img + mask + data-URI + unicode + entity); plus (+)
meaning add AND "view all" AND disclosure; eye icons for non-visibility meanings; delete
as trash in one feature and something else in another; brand icon reused as a state icon;
two parallel identity vocabularies for the same domain taxonomy; favicon pointing at a
missing file; public assets bypassing the deploy-base helper (breaks on subpath hosting);
baked fills in `<img>` icons (theme-hostile); filename typos; assets referenced only from
dead code (zombies); one-off SVG duplicating a lib icon inside the same feature.

## Phase 5 — Build + verify

```bash
node <skill>/scripts/build-audit.mjs --config audit.config.mjs --data audit-data.json \
  --curation curation.mjs --root <repoRoot> --out docs/audits/<date>-icon-audit.html
```

Builder facts: runs without `--curation` (raw-inventory mode — useful as a phase-2 sanity
pass); all curation text is HTML-escaped (write `<select>` freely in issue bodies); page
is one self-contained file (no CDN, no fonts to load), light+dark themes, client-side
filtering, app-link base switcher, source links.

Verify before delivering: open in a browser; check BOTH themes; run the filter (type a
term, pick a surface, clear); expand a lib-icon row, an inline group, a public asset;
click one source link and one app link; confirm no `undefined` text and no missing-glyph
placeholders you can fix. A `?` chip means a lookup failed — on a FIRST run that's usually
the registry not yielding that icon's SVG; on a RE-RUN it's usually a curation key gone
stale after code drift (file:line keys shift when files change; asset keys shift on renames,
including git-invisible case-only renames on macOS). Refresh the keys in curation.mjs —
including the copies inside issue `evidence` — and rebuild.
If a screenshot mid-page looks blank in an embedded browser pane, it's compositor lag on
a hidden pane, not the page — verify via anchored loads (`page.html#s3`) or DOM asserts.
After ANY rebuild you re-check in a browser, hard-refresh or add a cache-buster
(`?v=2`) — browsers cache the page aggressively, and a fixed page served stale looks
identical to an unfixed one (this burned a real session: the fix was live on disk while
both the user's browser and the verification pane showed the broken cached copy).

If you edit the page template: the whole page is ONE JS template literal, so any escape
sequence you want in the PAGE's script must be doubled (`\\n` to emit `\n`) — a single
`\n` inside a page-script string emits a raw newline and kills ALL page interactivity
with one SyntaxError (no theme, no filters, no buttons). The builder self-checks the
emitted script with `new Function` at build time and refuses to write a page whose
script doesn't parse — if it throws, hunt for un-doubled escapes. Also never add
`backdrop-filter` on sticky elements or
fixed full-viewport overlays (repaint cost on huge pages), and don't use
`content-visibility:auto` (breaks paint in some embedded Chromium builds).
If you find a bug in a skill script and can't write to the skill directory, patch the
OUTPUT, document the patch in the generator README, and report the bug explicitly in
your final summary so the skill gets fixed — never silently fork the scripts.

## Phase 6 — Deliver + make it regenerable

Copy the four generator inputs into the repo (`docs/audits/generator/`: config, curation,
audit-data.json, plus a README with the two run commands referencing the skill's scripts)
so the audit can be re-run after each cleanup batch — the stats strip shrinking is the
progress metric. Deliver the HTML file itself (it is the deliverable), lead your summary
with the top findings, state coverage honestly, and don't commit unless asked.

## The fix loop (acting on issues + tracking progress)

The page is the tracker; curation.mjs is the source of truth; the scan is the referee.

1. **Give issues a status** in curation (`status`, `resolvedIn`, `statusNote`) and, for
   any issue where it's expressible, a `verify` regex predicate (see the template). The
   builder renders status chips, a progress header (issues + affected sites resolved),
   a dimmed Resolved section, live remaining-match counts on open issues, and a red
   contradiction banner on any issue marked fixed that the scan still finds. Never track
   done-ness anywhere else (checkboxes, TODO files) — it will drift from the code.
2. **Acting on an issue**, three ways, same contract:
   - *copy fix prompt* button on every open card — a self-contained prompt (problem, fix,
     every file:line as a checklist, definition of done including the status flip). Paste
     into an agent session (Claude Code, Codex CLI, etc.) in the repo.
   - the **icon-fix skill** (`/icon-fix <id>`), which executes that contract end-to-end.
   - the **fix dispatcher** (`scripts/fix-server.mjs` — see its header for usage): a
     localhost server the page detects; open issues gain a *fix with <engine>* button
     (label follows the configured engine — Claude by default) that
     spawns a headless agent session with the server-built work order (default engine:
     the `claude` CLI; `--runner "<cmd>"` swaps in any other agent CLI — e.g. Codex's
     `codex exec` — with the prompt path arriving in `$ICON_FIX_PROMPT_FILE`), streams
     progress into a drawer on the page, re-runs the generator on completion, and reloads.
     Opt-in by starting it; localhost-only; one job at a time; needs a logged-in claude CLI
     (401 errors ⇒ run `claude` interactively and type `/login`; `claude login` is not a command).
     The server builds prompts from curation itself — it never executes page-supplied text.
3. **Closing the loop**: a fix is done only when the audit is re-run — extraction fresh,
   stale curation keys refreshed, status flipped with the commit, page rebuilt, verify
   passing, progress header advanced. The re-run is not optional bookkeeping; it is how
   the page stays truthful.

## Severity of scanner false positives (why the filters exist)

| False positive | Filter that prevents it |
|---|---|
| `computed<IconKind>` TS generic counted as component | component tags matched only inside `<template>`/JSX |
| `'IconZoomWindow'` in a doc comment counted as usage | comment-line filter (`//`, `*`, `/*`, `<!--`) + SKIP_USAGES for stragglers |
| Icon names in registry not matched (multi-line exports) | the three export-style regexes; verify before "broken" |
| `&#x2011;` (punctuation entity) counted as glyph | entity allowlist restricted to symbol blocks (2190–2BFF, emoji) |
| Prose arrows `A → B` counted as icons | glyph hits are curated in phase 4, never auto-reported |
