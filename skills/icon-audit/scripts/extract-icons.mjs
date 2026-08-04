#!/usr/bin/env node
// icon-audit extractor — static scan of a codebase for every icon mechanism.
// Usage: node extract-icons.mjs --config <audit.config.mjs> [--root <repoRoot>] [--out audit-data.json]
// All project-specific knowledge lives in the config file (see templates/audit.config.example.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// ---------- CLI ----------
const args = {}
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]
if (!args.config) { console.error('usage: extract-icons.mjs --config audit.config.mjs [--root dir] [--out audit-data.json]'); process.exit(1) }
const ROOT = path.resolve(args.root || process.cwd())
const CFG = (await import(pathToFileURL(path.resolve(args.config)).href)).default
const OUT = path.resolve(args.out || 'audit-data.json')

// ---------- config defaults ----------
const exts = CFG.exts || ['.vue', '.ts', '.tsx', '.jsx', '.js']
const excludeDir = new RegExp(CFG.excludeDirPattern || '__tests__|__mocks__|node_modules|dist|coverage|_screenshots')
const excludeFile = new RegExp(CFG.excludeFilePattern || '\\.spec\\.|\\.test\\.|\\.d\\.ts$|\\.stories\\.')
const aliases = CFG.aliases || {}
const compTagRe = new RegExp('<(' + (CFG.icons?.componentTag || 'Icon[A-Z]\\w*') + ')\\b([^>]*)>?', 'g')
const nameStrRe = new RegExp('["\'](' + (CFG.icons?.nameString || 'Icon[A-Z]\\w*') + ')["\']', 'g')
const dynamicHost = CFG.icons?.dynamicHost ?? 'AnyIcon'
const dynamicProp = CFG.icons?.dynamicProp || 'icon'
const dynRe = dynamicHost ? new RegExp('<' + dynamicHost + '\\b[^>]*:' + dynamicProp + '="([^"]+)"', 'g') : null
const publicDirs = (CFG.publicAssets?.dirs || []).map((d) => path.resolve(ROOT, d))
const pubUrlNames = publicDirs.map((d) => path.basename(d))
const pubRefRe = pubUrlNames.length
  ? new RegExp('["\'(](\\/(?:' + pubUrlNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\/[^"\')]+)["\')]', 'g')
  : null

// ---------- helpers ----------
const read = (f) => fs.readFileSync(f, 'utf8')
const exists = (f) => { try { fs.statSync(f); return true } catch { return false } }
function walk(dir, filter, out = []) {
  if (!exists(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (!excludeDir.test(e.name)) walk(p, filter, out) }
    else if (filter(p)) out.push(p)
  }
  return out
}
const rel = (f) => path.relative(ROOT, f)
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length
function ctxLines(lines, line, before = 2, after = 2) {
  const s = Math.max(0, line - 1 - before), e = Math.min(lines.length, line + after)
  return lines.slice(s, e).map((l) => l.trim()).filter(Boolean).join(' ⏎ ').slice(0, 400)
}
const isCommentLine = (l) => /^\s*(\/\/|\*|\/\*|<!--)/.test(l || '')

// ---------- 1. icon registry ----------
// Strategies:
//  indexAsyncExports — parse index.ts files for `(export )?const X = defineAsyncComponent(() => import("./Y"))`
//                      and `export { default as X } from "./Y"` re-exports.
//  componentFiles    — every component file in the dir tree IS an icon; name = basename.
const registry = {} // name -> {file, category}
for (const src of CFG.registry?.sources || []) {
  const dir = path.isAbsolute(src.dir) ? src.dir : path.resolve(ROOT, src.dir)
  if (!exists(dir)) { console.warn('registry source missing:', dir); continue }
  if (src.strategy === 'componentFiles') {
    for (const f of walk(dir, (p) => /\.(vue|tsx|jsx|svelte)$/.test(p))) {
      const name = path.basename(f).replace(/\.\w+$/, '')
      registry[name] = { file: f, category: path.relative(dir, path.dirname(f)) || '(root)' }
    }
  } else { // indexAsyncExports (default)
    for (const f of walk(dir, (p) => /(^|\/)index\.(ts|js|mjs)$/.test(p))) {
      const cat = path.relative(dir, path.dirname(f)) || '(root)'
      const t = read(f)
      for (const m of t.matchAll(/(?:export\s+)?const (\w+)\s*=\s*defineAsyncComponent\(\s*\(\)\s*=>\s*import\("\.\/(.+?)"\),?\s*\)/g)) {
        registry[m[1]] = { file: path.join(path.dirname(f), m[2]), category: cat }
      }
      for (const m of t.matchAll(/export\s*\{\s*default\s+as\s+(\w+)\s*\}\s*from\s*["']\.\/(.+?)["']/g)) {
        let file = path.join(path.dirname(f), m[2])
        if (!/\.\w+$/.test(file)) for (const c of ['.vue', '.tsx', '.jsx']) if (exists(file + c)) { file += c; break }
        registry[m[1]] = { file, category: cat }
      }
    }
  }
}

// ---------- 2. source files ----------
const files = []
for (const r of CFG.srcRoots || ['src']) walk(path.resolve(ROOT, r), (f) => exts.some((e) => f.endsWith(e)) && !excludeFile.test(f), files)
if (CFG.indexHtml && exists(path.resolve(ROOT, CFG.indexHtml))) files.push(path.resolve(ROOT, CFG.indexHtml))

// ---------- 3. usage scan ----------
const usages = []
const inlineSvgs = []
const GLYPH_RE = /[×ⓘ✕✖✗✓✔⋮⋯•●◦▪▸►▶▼▾▲‹›«»←→↑↓↔↻⟳⚠★☆ℹ✎✏⌄⌵]|\p{Extended_Pictographic}/gu
const ENTITY_RE = /&#x?[0-9a-fA-F]{2,6};/g
// symbol blocks only: 2190–2BFF (arrows/math/tech/shapes/dingbats) + 1F000+ emoji; decimal 8592–11263 / 126976+
const ENTITY_ALLOW = /^&#(?:x(?:2[1-9a-bA-B][0-9a-fA-F]{2}|1[fF][0-9a-fA-F]{3})|(?:8[5-9][0-9]{2}|9[0-9]{3}|1[01][0-9]{3}|12[0-9]{4}));$/

const ENCLOSING_RE = /<(button|a|Button\w*|\w*Button|ButtonMenuItem|SideNavItem|ActionChip|label|summary)\b/
function findEnclosing(lines, lineIdx) {
  for (let i = lineIdx; i >= Math.max(0, lineIdx - 8); i--) {
    const m = lines[i].match(ENCLOSING_RE)
    if (m) {
      let tag = ''
      for (let j = i; j < Math.min(lines.length, i + 10); j++) {
        tag += lines[j].trim() + ' '
        if (/>/.test(lines[j]) && j >= i) break
      }
      return tag.slice(0, 300)
    }
  }
  return null
}
function attrsOf(tagText) {
  const out = {}
  for (const [k, re] of Object.entries({
    title: /(?::|\b)title="([^"]+)"/, ariaLabel: /aria-label="([^"]+)"/,
    click: /@click(?:\.\w+)*="([^"]+)"|onClick=\{([^}]+)\}/, testid: /data-testid="([^"]+)"/,
    class: /class(?:Name)?="([^"]+)"/, tooltip: /(?:v-tooltip|:tooltip)="([^"]+)"/,
  })) { const m = tagText.match(re); if (m) out[k] = (m[1] || m[2] || '').slice(0, 120) }
  return out
}

let uid = 0
for (const f of files) {
  const text = read(f)
  const lines = text.split('\n')
  const r = rel(f)
  const isTpl = /\.(vue|svelte)$/.test(f)
  const isJsx = /\.(tsx|jsx)$/.test(f)

  // a) icon component tags — inside <template> for SFCs; whole file for JSX
  const tplStart = isTpl ? text.indexOf('<template>') : 0
  const tplEnd = isTpl ? text.lastIndexOf('</template>') : text.length
  for (const m of text.matchAll(compTagRe)) {
    if (isTpl && (tplStart < 0 || m.index < tplStart || m.index > tplEnd)) continue
    if (!isTpl && !isJsx) continue // plain ts/js: tags only appear in strings; nameStrRe covers those
    const line = lineOf(text, m.index)
    const tag = m[0].replace(/\s+/g, ' ').slice(0, 300)
    usages.push({ id: ++uid, kind: 'component', icon: m[1], file: r, line, tag,
      attrs: attrsOf(tag), enclosing: findEnclosing(lines, line - 1), ctx: ctxLines(lines, line) })
  }
  // b) icon-name string literals (validated against registry later)
  for (const m of text.matchAll(nameStrRe)) {
    const line = lineOf(text, m.index)
    if (isCommentLine(lines[line - 1])) continue
    const lineText = (lines[line - 1] || '').trim()
    usages.push({ id: ++uid, kind: 'string', icon: m[1], file: r, line,
      tag: lineText.slice(0, 300), attrs: attrsOf(lineText),
      enclosing: isTpl || isJsx ? findEnclosing(lines, line - 1) : null,
      ctx: ctxLines(lines, line), unknown: !registry[m[1]] })
  }
  // c) dynamic icon binds on the host component
  if (dynRe) for (const m of text.matchAll(dynRe)) {
    const expr = m[1]
    if (new RegExp("^'(" + (CFG.icons?.nameString || 'Icon[A-Z]\\w*') + ")'$").test(expr.trim())) continue
    const line = lineOf(text, m.index)
    usages.push({ id: ++uid, kind: 'dynamic', icon: null, dynamicExpr: expr, file: r, line,
      tag: m[0].replace(/\s+/g, ' ').slice(0, 300), attrs: attrsOf(m[0]),
      enclosing: findEnclosing(lines, line - 1), ctx: ctxLines(lines, line) })
  }
  // d) inline <svg> blocks
  for (const m of text.matchAll(/<svg[\s\S]*?<\/svg>/g)) {
    const line = lineOf(text, m.index)
    inlineSvgs.push({ id: `inline-${r}-${line}`, file: r, line, svg: m[0],
      enclosing: findEnclosing(lines, line - 1),
      attrs: attrsOf(m[0].split('\n')[0] || ''), ctx: ctxLines(lines, line, 3, 1) })
  }
  // e) public asset refs
  if (pubRefRe) for (const m of text.matchAll(pubRefRe)) {
    const line = lineOf(text, m.index)
    if (isCommentLine(lines[line - 1])) continue
    usages.push({ id: ++uid, kind: 'publicAsset', asset: m[1], file: r, line,
      tag: (lines[line - 1] || '').trim().slice(0, 300),
      attrs: attrsOf(lines[line - 1] || ''), enclosing: findEnclosing(lines, line - 1),
      ctx: ctxLines(lines, line) })
  }
  // f) unicode glyphs / emoji (raw characters)
  for (const m of text.matchAll(GLYPH_RE)) {
    const line = lineOf(text, m.index)
    if (isCommentLine(lines[line - 1])) continue
    usages.push({ id: ++uid, kind: 'glyph', char: m[0], file: r, line,
      tag: (lines[line - 1] || '').trim().slice(0, 300), attrs: attrsOf(lines[line - 1] || ''),
      enclosing: isTpl || isJsx ? findEnclosing(lines, line - 1) : null, ctx: ctxLines(lines, line, 1, 1) })
  }
  // g) HTML entities that decode to glyph ranges (unicode scans miss these)
  for (const m of text.matchAll(ENTITY_RE)) {
    if (!ENTITY_ALLOW.test(m[0])) continue
    const line = lineOf(text, m.index)
    if (isCommentLine(lines[line - 1])) continue
    const cp = m[0][2] === 'x' || m[0][2] === 'X' ? parseInt(m[0].slice(3, -1), 16) : parseInt(m[0].slice(2, -1), 10)
    usages.push({ id: ++uid, kind: 'glyph', char: String.fromCodePoint(cp) + ' (' + m[0] + ')', file: r, line,
      tag: (lines[line - 1] || '').trim().slice(0, 300), attrs: attrsOf(lines[line - 1] || ''),
      enclosing: isTpl || isJsx ? findEnclosing(lines, line - 1) : null, ctx: ctxLines(lines, line, 1, 1) })
  }
}

// ---------- 4. import graph + view attribution ----------
const edges = {}
const libImports = {}
const libPrefix = CFG.libScan?.importPrefix || ''
function resolveImport(fromFile, spec) {
  let base = null
  if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else for (const [a, target] of Object.entries(aliases)) if (spec.startsWith(a)) base = path.resolve(ROOT, target, spec.slice(a.length))
  if (!base) return null
  for (const c of [base, ...exts.map((e) => base + e), ...exts.map((e) => path.join(base, 'index' + e))]) {
    if (exists(c) && fs.statSync(c).isFile()) return c
  }
  return null
}
for (const f of files) {
  const text = read(f)
  edges[rel(f)] = []
  for (const m of text.matchAll(/import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']|import\(["']([^"']+)["']\)|require\(["']([^"']+)["']\)/g)) {
    const spec = m[2] || m[3] || m[4]
    if (!spec) continue
    if (libPrefix && spec.startsWith(libPrefix)) {
      const names = (m[1] || '').replace(/[{}]/g, '').split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter((n) => n && !/^type\b/.test(n))
      ;(libImports[rel(f)] ||= []).push(...names.map((name) => ({ name, subpath: spec.slice(libPrefix.length) })))
      continue
    }
    const t = resolveImport(f, spec)
    if (t) edges[rel(f)].push(rel(t))
  }
}
const fileViews = {}
const viewRoots = CFG.views?.roots || {}
for (const [view, roots] of Object.entries(viewRoots)) {
  const seen = new Set()
  const stack = roots.map((p) => rel(path.resolve(ROOT, p)))
  while (stack.length) {
    const cur = stack.pop()
    if (seen.has(cur)) continue
    seen.add(cur)
    ;(fileViews[cur] ||= new Set()).add(view)
    for (const nxt of edges[cur] || []) stack.push(nxt)
  }
}
// a root that imports other roots shouldn't paint everything (e.g. App.vue): if a file
// belongs to >1 view and one of them is the designated shell view, drop the shell.
const shellView = CFG.views?.shellView
if (shellView) for (const vs of Object.values(fileViews)) if (vs.size > 1) vs.delete(shellView)

// ---------- 5. second-level lib component scan (optional) ----------
const libComponentIcons = []
if (libPrefix && CFG.libScan?.srcRoot) {
  const LIBSRC = path.isAbsolute(CFG.libScan.srcRoot) ? CFG.libScan.srcRoot : path.resolve(ROOT, CFG.libScan.srcRoot)
  const seen = new Set()
  for (const { name, subpath } of Object.values(libImports).flat()) {
    const key = subpath + '/' + name
    if (seen.has(key)) continue
    seen.add(key)
    const dir = path.join(LIBSRC, subpath)
    let compFile = null
    for (const c of [path.join(dir, name + '.vue'), path.join(dir, name, name + '.vue'), path.join(dir, name + '.tsx')]) if (exists(c)) { compFile = c; break }
    if (!compFile && exists(dir) && fs.statSync(dir).isDirectory()) {
      const hit = walk(dir, (f2) => f2.endsWith('/' + name + '.vue') || f2.endsWith('/' + name + '.tsx'))[0]
      if (hit) compFile = hit
    }
    if (!compFile) { libComponentIcons.push({ component: name, subpath, file: null, icons: [], inlineSvgCount: 0 }); continue }
    const t = read(compFile)
    const icons = [...new Set([
      ...[...t.matchAll(compTagRe)].map((m) => m[1]),
      ...[...t.matchAll(nameStrRe)].map((m) => m[1]).filter((n) => registry[n]),
    ])]
    libComponentIcons.push({ component: name, subpath, file: path.relative(LIBSRC, compFile), icons, inlineSvgCount: (t.match(/<svg\b/g) || []).length })
  }
}

// ---------- 6. SVG markup ----------
function svgOf(compFile) {
  try { const m = read(compFile).match(/<svg[\s\S]*?<\/svg>/); return m ? m[0] : null } catch { return null }
}
const usedIconNames = [...new Set(usages.filter((u) => u.icon && !u.unknown).map((u) => u.icon))]
for (const lc of libComponentIcons) for (const n of lc.icons) if (!usedIconNames.includes(n)) usedIconNames.push(n)
const svgs = {}
for (const n of usedIconNames) if (registry[n]) svgs[n] = svgOf(registry[n].file)

const publicAssets = {}
for (const dir of publicDirs) {
  if (!exists(dir)) continue
  const urlBase = '/' + path.basename(dir)
  for (const f of fs.readdirSync(dir)) {
    if (f.startsWith('.')) continue // .DS_Store & friends
    if (fs.statSync(path.join(dir, f)).isDirectory()) continue
    const p = `${urlBase}/${f}`
    let svg = null, fills = []
    if (f.endsWith('.svg')) {
      svg = read(path.join(dir, f))
      fills = [...new Set([...svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)].map((m) => m[1]).filter((c) => c !== 'none'))]
    }
    publicAssets[p] = { svg, fills, referenced: usages.some((u) => u.asset === p) }
  }
}

// ---------- 7. duplicate-artwork detection ----------
function norm(svg) { if (!svg) return null; return (svg.match(/ d="[^"]+"/g) || []).join('|').replace(/\s/g, '') }
const byArt = {}
for (const [n, svg] of Object.entries(svgs)) { const k = norm(svg); if (k) (byArt[k] ||= []).push('lib:' + n) }
for (const [p, a] of Object.entries(publicAssets)) { const k = norm(a.svg); if (k) (byArt[k] ||= []).push('public:' + p) }
for (const s of inlineSvgs) { const k = norm(s.svg); if (k) (byArt[k] ||= []).push('inline:' + s.id) }
const duplicateArtwork = Object.values(byArt).filter((g) => g.length > 1)

// ---------- output ----------
const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  counts: { files: files.length, usages: usages.length, inlineSvgs: inlineSvgs.length,
    usedLibIcons: usedIconNames.filter((n) => registry[n]).length, registrySize: Object.keys(registry).length },
  registryCategories: Object.entries(registry).reduce((a, [n, v]) => { (a[v.category] ||= []).push(n); return a }, {}),
  usages, inlineSvgs, svgs, publicAssets, duplicateArtwork,
  fileViews: Object.fromEntries(Object.entries(fileViews).map(([f, s]) => [f, [...s]])),
  libComponentIcons,
  unknownIconStrings: usages.filter((u) => u.unknown).map((u) => ({ icon: u.icon, file: u.file, line: u.line })),
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
console.log('wrote', OUT)
console.log('usages by kind:', usages.reduce((a, u) => { a[u.kind] = (a[u.kind] || 0) + 1; return a }, {}))
console.log('registry:', Object.keys(registry).length, '| distinct lib icons used:', out.counts.usedLibIcons,
  '| inline svgs:', inlineSvgs.length, '| unknown icon strings:', out.unknownIconStrings.length,
  '| dup artwork groups:', duplicateArtwork.length)
if (out.unknownIconStrings.length) console.log('UNKNOWN NAMES (verify against registry before calling broken):', out.unknownIconStrings.slice(0, 10))
