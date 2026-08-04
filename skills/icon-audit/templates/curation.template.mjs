// icon-audit curation module — the HAND-AUTHORED semantic layer.
// Every export is optional; the builder runs without this file in raw-inventory mode.
// Author it AFTER reviewing the digests (digest.mjs) — this file is where audit VALUE lives.
// Keep it next to audit.config.mjs and update it as cleanup lands.

// Human glyph label + observed roles per library icon. Un-annotated icons get an
// auto-derived label from their name. Annotate at least every icon involved in an issue.
export const ICON_NOTES = {
  // IconTrash: { label: 'Trash can', roles: ['Delete file (FileRow)', 'Delete item (rows)'] },
}

// Classification for EVERY inline <svg> the extractor found (see digest-inline.txt).
// Key: '<path-relative-to-src-root>:<line>'.
// kind: 'icon' (default) | 'chart' | 'decor' | 'css-caret' — non-icon kinds are inventoried
// but excluded from icon issues. group ties same-artwork/same-meaning families together
// (close-x, chevron, trash, search, plus, ... — free-form; used for grouping + labels).
export const INLINE_META = {
  // 'components/Modal.vue:9': { label: 'X', meaning: 'Close modal', group: 'close-x' },
}
// Optional: override/extend the group display names.
export const GROUP_LABELS = {}

// Unicode / emoji / HTML-entity glyphs that function as UI icons (curated from the raw
// glyph scan + the exotic-pattern sweep; leave out prose/debug hits, but COUNT them in
// COVERAGE_NOTES). a11y: note missing accessible names / missing aria-hidden.
export const GLYPH_UI = [
  // { char: '×', file: 'src/components/Banner.vue', line: 8, meaning: 'Dismiss banner', view: 'home', a11y: 'no accessible name' },
]

// Icons drawn by CSS: mask/background-image urls, data-URI carets, ::before content glyphs,
// border-triangles, status-dot systems, spinners.
export const CSS_ICONS = [
  // { label: 'Select caret (data URI)', asset: '(inline data:)', file: 'src/components/Form.vue', line: 20, meaning: 'Native select caret', view: 'settings' },
]

// Per public asset: label, status 'active' | 'dead' (unreferenced) | 'zombie' (referenced
// only from dead code/data), and an optional note (typos, baked fills, duplicates).
export const PUBLIC_META = {
  // '/icons/save.svg': { label: 'Save', status: 'active', note: 'baked fill #333333' },
}

// Extractor hits to suppress (doc-comment examples and other verified false positives).
export const SKIP_USAGES = [
  // { file: 'src/types.ts', line: 42 },
]

// THE ISSUE CATALOG. sev: 'high' (broken today / biggest coherence win) | 'med' (real
// contradiction needing a decision) | 'low' (hygiene). cat: 'contradiction' | 'duplicate'
// | 'fragmentation' | 'broken' | 'hygiene' | 'a11y'.
// evidence types: {type:'lib',key:'IconX'} {type:'inline',key:'<src-rel>:<line>'}
// {type:'public',key:'/icons/x.svg'} {type:'char',key:'×'} {type:'strsvg',key:'ICON_X'}
//
// FIX-LOOP fields (all optional):
//   status: 'open' (default) | 'in-progress' | 'fixed' | 'wontfix'
//   resolvedIn: 'abc1234'      — short commit of the fix
//   statusNote: '…'            — e.g. why a wontfix
//   verify: [{ pattern, flags?, include?, expect? }]
//     Regex predicates the BUILDER evaluates against the live source at build time.
//     Open issues show a live remaining-match count; issues marked 'fixed' whose scan
//     still matches get a red contradiction banner — done-ness is verified, not asserted.
//     include = substring filter on repo-relative paths; expect = allowed matches (default 0).
// Each open issue also gets a "copy fix prompt" button on the page, generated from these fields.
export const ISSUES = [
  // {
  //   id: 'X1', sev: 'high', cat: 'duplicate', title: 'Close is drawn 3 different ways',
  //   body: 'Plain-text statement of the defect with the concrete inventory…',
  //   evidence: [{ type: 'lib', key: 'IconX', cap: 'lib IconX' }, { type: 'char', key: '×', cap: 'text ×' }],
  //   refs: [['src/components/Modal.vue', 9], ['src/components/Banner.vue', 8]],
  //   rec: 'Standardize on lib IconX; replace the text × (it also lacks an accessible name).',
  //   status: 'open',
  //   verify: [{ pattern: '>×<', include: 'src/components' }],
  // },
]

// Canonical vocabulary — the decision sheet: one icon per meaning.
export const CANON = [
  // { meaning: 'Close / dismiss', canonical: 'IconX', migrate: 'text “×” ×1 · inline X ×1', issue: 'X1' },
]

// Honest coverage statement: what was scanned, how attribution works, what was excluded
// (prose glyphs, debug emoji, charts), and known gaps. Users trust audits that admit limits.
export const COVERAGE_NOTES = [
  // 'Scanned src/** (.vue/.ts) excluding tests; six usage mechanisms detected: …',
]

// Optional extra glyph vocabularies to display (e.g. a domain type→glyph map).
export const GLYPH_VOCABS = [
  // { title: 'Entity type glyphs (compact map view)', note: 'duplicated in a legacy prototype — drift risk', pairs: [['host', '▣'], ['link', '⇄']] },
]

// Optional: a file that defines icons as SVG template-literal strings
// (const ICON_X = `${SVG_OPEN}…${SVG_CLOSE}`) — they get extracted and rendered as evidence.
export const STRSVG_FILE = null
