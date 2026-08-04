# Exotic-pattern sweep — subagent prompt template

Dispatch a read-only exploration subagent with this prompt (fill the {{placeholders}}),
in parallel with the extractor run. Its job is the icon mechanisms regex scans miss and
the "what does this glyph MEAN here" judgment layer.

---

You are auditing icon usage in a web app. Working directory: {{PROJECT_ROOT}}

Scan ONLY these locations: {{SCAN_PATHS}} (e.g. `src/**`, `index.html`, `public/**` — list
public/ but don't read binary files).

Find every "icon-like visual" that is NOT one of these already-covered patterns:
(a) components from the icon library ({{ICON_LIB_DESCRIPTION, e.g. "AnyIcon / Icon* from @acme/ui"}}),
(b) full inline `<svg>` elements in templates.

Specifically hunt for:
1. Unicode/emoji glyphs used as UI symbols in templates or JS strings — e.g. ✕ ✖ × ⋮ ⋯ ▾ ▸ ► ▼ ✓ ✔ ＋ − ⚠ ⚙ 🔍 ← → ↑ ↓ ⌄ ‹ › « » ⟳ ↻ ● ◦ ▪ ★ ☆ ℹ etc. Only count ones rendered as standalone symbols (button/label/indicator glyphs), not prose punctuation. Include emoji used as icons. ALSO grep numeric HTML entities (`&#x25BC;`, `&#9888;`) — raw-character scans miss those.
2. CSS-generated icons: `background-image` / `mask-image` with url(...svg) or `data:` URIs; `::before`/`::after` with non-empty `content:` glyphs; borders drawing triangles/carets; CSS-drawn status dots/swatches (report dot systems in aggregate per file); CSS spinners.
3. `<img>` tags whose src points at .svg/.png icons.
4. Icon fonts (fa-, mdi-, material-icons, q-icon, glyphicon, iconify class patterns; `@font-face` icon families).
5. Local components that ARE icons themselves (a component whose entire template is an svg glyph or a styled shape) — list what each draws.
6. Favicon / PWA icons in index.html and public/ — VERIFY the referenced files exist; note missing manifest/apple-touch-icon; note any in-app "favicon" setting disconnected from the document head.
7. String-keyed icon maps in TS/JS: objects mapping names → icon components, glyph strings, or asset paths; especially SVG-markup-in-string registries rendered via v-html/dangerouslySetInnerHTML (flag those as highest severity).

For EVERY finding report: file path (relative to repo root), line number, the exact snippet (trimmed ~120 chars), what the glyph/icon visually is, and what it appears to MEAN/do in context (e.g. "close button in modal header", "dropdown caret", "sort indicator"). Group findings by pattern type. Be exhaustive — this feeds a formal audit; missing instances is worse than borderline over-reporting. Exclude test files and generated/screenshot directories. Note accessibility problems as you go: icon-only controls with no accessible name; meaningful glyphs missing aria-hidden pairing with adjacent text.

Also do a reference tally: for each file in {{PUBLIC_ICON_DIRS}}, report whether the filename is referenced anywhere in the scanned source (grep by filename). List unreferenced ones explicitly, and note files referenced ONLY from components that nothing imports (zombies) if you can tell.

Your final report is raw data to merge into a machine-readable audit — use a compact structured format (one finding per line where possible), not prose paragraphs.
