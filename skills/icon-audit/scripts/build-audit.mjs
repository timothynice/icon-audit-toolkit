#!/usr/bin/env node
// icon-audit page builder — merges extraction data + curation into ONE standalone HTML file.
// Usage: node build-audit.mjs --config <audit.config.mjs> --data <audit-data.json> --out <page.html> [--curation <curation.mjs>]
// Curation is OPTIONAL: with no curation file you get a raw-inventory page (useful first pass);
// every curation export is optional (see templates/curation.template.mjs for the schema).
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const args = {}
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]
if (!args.config || !args.data || !args.out) {
  console.error('usage: build-audit.mjs --config audit.config.mjs --data audit-data.json --out page.html [--curation curation.mjs]')
  process.exit(1)
}
const CFG = (await import(pathToFileURL(path.resolve(args.config)).href)).default
const D = JSON.parse(fs.readFileSync(path.resolve(args.data), 'utf8'))
const CUR = args.curation ? await import(pathToFileURL(path.resolve(args.curation)).href) : {}
const ROOT = path.resolve(args.root || process.cwd())
const OUT = path.resolve(args.out)

// ---------- curation with defaults ----------
const ICON_NOTES = CUR.ICON_NOTES || {}
const INLINE_META = CUR.INLINE_META || {}
const GLYPH_UI = CUR.GLYPH_UI || []
const CSS_ICONS = CUR.CSS_ICONS || []
const PUBLIC_META = CUR.PUBLIC_META || {}
const SKIP_USAGES = CUR.SKIP_USAGES || []
const ISSUES = CUR.ISSUES || []
const CANON = CUR.CANON || []
const COVERAGE_NOTES = CUR.COVERAGE_NOTES || []
const GLYPH_VOCABS = CUR.GLYPH_VOCABS || []
const GROUP_LABELS = Object.assign({
  'close-x': 'Close / remove (X)', chevron: 'Disclosure chevrons', 'chevron-right': 'Chevron right',
  plus: 'Plus', trash: 'Trash', pencil: 'Pencil', search: 'Magnifier', copy: 'Copy', check: 'Check',
  help: 'Question circle', expand: 'Expand corners', bookmark: 'Bookmark', history: 'History clock',
  upload: 'Upload', lock: 'Padlock', pin: 'Map pin', arrow: 'Arrows', grip: 'Grip dots',
  strsvg: 'SVG-string registry', other: 'Other',
}, CUR.GROUP_LABELS || {})
const STRSVG_FILE = CUR.STRSVG_FILE || null

const PROJECT = CFG.project || {}
const VIEWS = Object.assign({}, CFG.views?.meta || {})
VIEWS['shared'] ||= { label: 'Shared data (all views)', nav: 'data modules imported across views', hash: '' }
VIEWS['UNREACHED'] ||= { label: 'Quarantined / dead code', nav: 'not reachable from any configured view root', hash: '', legacy: true }
const BASES = CFG.links?.bases || []
const SRC_URL = CFG.links?.sourceUrl || ''
const sharedThreshold = CFG.views?.sharedThreshold ?? 6

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const stripRoots = (CFG.srcRoots || ['src']).map((r) => r.replace(/\/+$/, '') + '/')
const srcRel = (f) => { for (const r of stripRoots) { const i = f.indexOf(r); if (i >= 0) return f.slice(i + r.length) } return f }

// ---------- string-SVG icons (optional) ----------
const strsvg = {}
if (STRSVG_FILE) {
  try {
    const t = fs.readFileSync(path.resolve(ROOT, STRSVG_FILE), 'utf8')
    const open = (t.match(/const SVG_OPEN\s*=\s*['"`]([^'"`]+)['"`]/) || [])[1] || '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">'
    for (const m of t.matchAll(/const (ICON_\w+)\s*=\s*`\$\{SVG_OPEN\}([\s\S]*?)\$\{SVG_CLOSE\}`/g)) strsvg[m[1]] = open + m[2] + '</svg>'
  } catch { /* optional */ }
}

// ---------- usage processing ----------
const skip = new Set(SKIP_USAGES.map((s) => s.file + ':' + s.line))
const usages = D.usages.filter((u) => u.kind !== 'glyph' && !skip.has(u.file + ':' + u.line))
const fileViews = D.fileViews || {}
const hasViewRoots = Object.keys(fileViews).length > 0
function viewsOf(file) {
  if (!hasViewRoots) return ['app']
  const v = fileViews[file]
  if (!v || v.length === 0) return ['UNREACHED']
  if (v.length > sharedThreshold) return ['shared']
  return v
}
if (!hasViewRoots) VIEWS['app'] ||= { label: PROJECT.name || 'App', nav: '', hash: '' }

function hintOf(u) {
  const a = u.attrs || {}
  if (a.ariaLabel) return a.ariaLabel
  if (a.title) return a.title
  if (a.tooltip) return a.tooltip
  const enc = u.enclosing || ''
  for (const re of [/aria-label="([^"{`$]+)"/, /(?:^|\s)title="([^"{`$]+)"/]) { const m = enc.match(re); if (m) return m[1] }
  if (a.click) return '@' + a.click.slice(0, 48)
  const m2 = enc.match(/@click(?:\.\w+)*="([^"]+)"/)
  if (m2) return '@' + m2[1].slice(0, 48)
  if (a.testid) return a.testid
  return (u.tag || '').slice(0, 70)
}

const byIcon = {}
for (const u of usages) { if (u.icon && !u.unknown) (byIcon[u.icon] ||= []).push(u) }
const iconNames = Object.keys(byIcon).sort((a, b) => byIcon[b].length - byIcon[a].length || a.localeCompare(b))
const iconLive = (n) => byIcon[n].some((u) => !viewsOf(u.file).every((v) => v === 'UNREACHED'))
const dynamics = usages.filter((u) => u.kind === 'dynamic')
const unknowns = D.unknownIconStrings || []

const inlines = D.inlineSvgs.map((s) => {
  const key = srcRel(s.file) + ':' + s.line
  const meta = INLINE_META[key] || { label: 'Inline SVG', meaning: (s.ctx || '').slice(0, 80), group: 'other' }
  return { ...s, key, meta, kind: meta.kind || 'icon', views: viewsOf(s.file) }
})
const inlineIcons = inlines.filter((s) => s.kind === 'icon')
const inlineOther = inlines.filter((s) => s.kind !== 'icon')
const inlineGroups = {}
for (const s of inlineIcons) (inlineGroups[s.meta.group] ||= []).push(s)

const pubUsages = usages.filter((u) => u.kind === 'publicAsset')
const pubAssets = Object.entries(D.publicAssets || {}).map(([p, a]) => ({
  path: p, ...a, meta: PUBLIC_META[p] || { label: p.split('/').pop(), status: a.referenced ? 'active' : 'dead' },
  sites: pubUsages.filter((u) => u.asset === p),
}))

// ---------- fix-loop: status model + scan verification ----------
const statOf = (i) => i.status || 'open'
const isResolved = (i) => statOf(i) === 'fixed' || statOf(i) === 'wontfix'
const GEN_DIR = path.relative(ROOT, path.dirname(path.resolve(args.config))) || 'docs/audits/generator'

// verify runner: evaluate each issue's regex predicates against the live source tree.
// Predicate: { pattern, flags?, include? (substring filter on repo-relative path), expect? (default 0) }
const verifyResults = {}
{
  const needs = ISSUES.filter((i) => Array.isArray(i.verify) && i.verify.length)
  if (needs.length) {
    const exts2 = CFG.exts || ['.vue', '.ts', '.tsx', '.jsx', '.js']
    const exDir = new RegExp(CFG.excludeDirPattern || '__tests__|node_modules|dist')
    const exFile = new RegExp(CFG.excludeFilePattern || '\\.spec\\.|\\.d\\.ts$')
    const srcFiles = []
    const walkSrc = (dir) => {
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const e of entries) {
        const p2 = path.join(dir, e.name)
        if (e.isDirectory()) { if (!exDir.test(e.name)) walkSrc(p2) }
        else if (exts2.some((x) => p2.endsWith(x)) && !exFile.test(p2)) srcFiles.push(p2)
      }
    }
    for (const r of CFG.srcRoots || ['src']) walkSrc(path.resolve(ROOT, r))
    if (CFG.indexHtml && fs.existsSync(path.resolve(ROOT, CFG.indexHtml))) srcFiles.push(path.resolve(ROOT, CFG.indexHtml))
    const cache = new Map()
    const textOf = (f) => { if (!cache.has(f)) { try { cache.set(f, fs.readFileSync(f, 'utf8')) } catch { cache.set(f, '') } } return cache.get(f) }
    for (const i of needs) {
      verifyResults[i.id] = i.verify.map((v) => {
        const re = new RegExp(v.pattern, (v.flags || '') + ((v.flags || '').includes('g') ? '' : 'g'))
        let count = 0
        for (const f of srcFiles) {
          const relPath = path.relative(ROOT, f)
          if (v.include && !relPath.includes(v.include)) continue
          count += (textOf(f).match(re) || []).length
        }
        const expect = v.expect ?? 0
        return { pattern: v.pattern, include: v.include || '', count, expect, pass: count <= expect }
      })
    }
  }
}

// fix prompt generator — self-contained text an agent (or /icon-fix) can execute.
function fixPrompt(i) {
  const refs = (i.refs || []).map(([f, l]) => `- ${f}:${l}`).join('\n')
  const verifyLines = (i.verify || []).map((v) => `- Scan check: /${v.pattern}/${v.include ? ' in paths containing "' + v.include + '"' : ''} must have ≤${v.expect ?? 0} matches.`).join('\n')
  return `You are working in a checkout of ${PROJECT.name || 'this repo'}. It has an icon audit; the generator inputs live in ${GEN_DIR}/ (audit.config.mjs, curation.mjs) and the re-run commands are in ${GEN_DIR}/README.md. If the icon-fix skill is installed, invoke it for issue ${i.id} instead of doing this manually.

Execute icon-audit issue ${i.id}: ${i.title}

Problem: ${i.body}

Fix: ${i.rec}

Affected sites (your checklist — migrate every one):
${refs || '- (see the audit page)'}

Definition of done:
- Every site above is migrated; no new inline SVGs, image-asset icons, or unicode glyph buttons are introduced.
- The project's build/tests/gates pass.
${verifyLines ? verifyLines + '\n' : ''}- Re-run the audit (commands in ${GEN_DIR}/README.md) and confirm this issue's numbers dropped.
- In ${GEN_DIR}/curation.mjs: set this issue's status to 'fixed' with resolvedIn: '<short commit>'; refresh any file:line keys your edits shifted (INLINE_META, GLYPH_UI, issue refs/evidence); delete INLINE_META entries for SVGs you removed.
- Rebuild the page and confirm no '?' evidence chips appeared and the progress header advanced.`
}

const sevCount = { high: 0, med: 0, low: 0 }
for (const i of ISSUES) sevCount[i.sev] = (sevCount[i.sev] || 0) + 1
const issuesResolved = ISSUES.filter(isResolved).length
const sitesTotal = ISSUES.reduce((a, i) => a + (i.refs || []).length, 0)
const sitesDone = ISSUES.filter(isResolved).reduce((a, i) => a + (i.refs || []).length, 0)
const liveIcons = iconNames.filter(iconLive)
const quarIcons = iconNames.filter((n) => !iconLive(n))
const deadPub = pubAssets.filter((a) => a.meta.status === 'dead').length
const zombiePub = pubAssets.filter((a) => a.meta.status === 'zombie').length
const glyphUsageCount = D.usages.filter((u) => u.kind === 'glyph').length
const mech = [
  ['Icon library (components + name strings + dynamic binds)', usages.filter((u) => (u.icon && !u.unknown) || u.kind === 'dynamic').length],
  ['Inline <svg> blocks (icon-shaped)', inlineIcons.length],
  ['Inline <svg> blocks (charts / decor)', inlineOther.length],
  ['Public asset references (img + CSS)', pubUsages.length],
  ['Unicode / emoji / entity glyphs (curated UI roles)', GLYPH_UI.length || glyphUsageCount],
  ['CSS-drawn icons (masks, carets, content, shapes)', CSS_ICONS.length],
].filter((m) => m[1] > 0)
const mechMax = Math.max(1, ...mech.map((m) => m[1]))

// ---------- glyph renderers ----------
function libGlyph(name, size = 18) {
  const svg = D.svgs[name]
  if (!svg) return '<span class="g g--missing" title="' + esc(name) + '">?</span>'
  return '<span class="g g--lib" data-icon="' + esc(name) + '">' + svg.replace('<svg', `<svg width="${size}" height="${size}"`) + '</span>'
}
function inlineGlyph(key) {
  const s = inlines.find((x) => x.key === key)
  if (!s) return '<span class="g g--missing">?</span>'
  if (s.kind !== 'icon') return '<span class="g g--chart" title="chart/decor">▦</span>'
  const svg = s.svg.replace(/\sv-(if|else-if|else|show)(="[^"]*")?/g, '').replace(/\s:(class|style)="[^"]*"/g, '')
  return '<span class="g g--inline">' + svg + '</span>'
}
function pubGlyph(p) {
  const a = D.publicAssets[p]
  if (!a || !a.svg) return '<span class="g g--missing">' + (p.endsWith('.png') ? 'png' : '?') + '</span>'
  return '<span class="g g--asset" title="rendered with its baked-in fills">' + a.svg.replace('<svg', '<svg width="18" height="18"') + '</span>'
}
const charGlyph = (c) => '<span class="g g--char">' + esc(c) + '</span>'
function strsvgGlyph(name) {
  const svg = strsvg[name]
  return svg ? '<span class="g g--inline">' + svg.replace('<svg', '<svg width="18" height="18"') + '</span>' : '<span class="g g--missing">?</span>'
}
function evGlyph(e) {
  if (e.type === 'lib') return libGlyph(e.key)
  if (e.type === 'inline') return inlineGlyph(e.key)
  if (e.type === 'public') return pubGlyph(e.key)
  if (e.type === 'char') return charGlyph(e.key)
  if (e.type === 'strsvg') return strsvgGlyph(e.key)
  return ''
}

// ---------- link helpers ----------
function ghLink(file, line) {
  const label = esc(file) + (line ? ':' + line : '')
  if (!SRC_URL) return '<span class="src">' + label + '</span>'
  return `<a class="src" href="${SRC_URL}${esc(file)}${line ? '#L' + line : ''}" target="_blank" rel="noopener">${label}</a>`
}
function viewChips(views) {
  return views.map((v) => {
    const meta = VIEWS[v] || { label: v }
    const cls = v === 'UNREACHED' || meta.legacy ? ' vc--dead' : (meta.chrome ? ' vc--chrome' : '')
    const hash = meta.hash || ''
    const title = esc(meta.nav || '')
    return hash
      ? `<a class="vc${cls}" data-hash="${esc(hash)}" href="#" title="${title}">${esc(meta.label)}</a>`
      : `<span class="vc${cls}" title="${title}">${esc(meta.label)}</span>`
  }).join('')
}

const SEV = {
  high: { label: 'High', icon: '▲', cls: 'sev--high' },
  med: { label: 'Medium', icon: '◆', cls: 'sev--med' },
  low: { label: 'Low', icon: '●', cls: 'sev--low' },
}
const CATL = { contradiction: 'contradiction', duplicate: 'duplicate', fragmentation: 'fragmentation', broken: 'broken / dead', hygiene: 'hygiene', a11y: 'accessibility' }

// ---------- section renderers ----------
const STATUS_CHIP = {
  open: '<span class="st st--openx">○ open</span>',
  'in-progress': '<span class="st st--prog">◐ in progress</span>',
  fixed: '<span class="st st--ok">✓ fixed</span>',
  wontfix: '<span class="st st--wontfix">⊘ won’t fix</span>',
}
function verifyLine(i) {
  const vr = verifyResults[i.id]
  if (!vr) return ''
  const st = statOf(i)
  const parts = vr.map((v) => `<code>/${esc(v.pattern)}/</code>${v.include ? ' in <code>' + esc(v.include) + '</code>' : ''}: <b>${v.count}</b> match${v.count === 1 ? '' : 'es'}${v.expect ? ' (allowed ≤' + v.expect + ')' : ''}`)
  const allPass = vr.every((v) => v.pass)
  if (st === 'fixed' && !allPass) {
    return `<p class="issue__verify issue__verify--fail">⚠ Marked fixed, but the scan still finds it — ${parts.join(' · ')}. Reopen or finish the stragglers, then rebuild.</p>`
  }
  if (st === 'fixed') return `<p class="issue__verify issue__verify--ok">Scan-verified at build time — ${parts.join(' · ')}.</p>`
  return `<p class="issue__verify">Live scan — ${parts.join(' · ')} remaining.</p>`
}
function issueCard(i) {
  const s = SEV[i.sev] || SEV.low
  const st = statOf(i)
  const ev = (i.evidence || []).map((e) => `<span class="ev">${evGlyph(e)}<span class="ev__cap">${esc(e.cap)}</span></span>`).join('')
  const refs = (i.refs || []).map(([f, l]) => `<li>${ghLink(f, l)}</li>`).join('')
  const resolvedMeta = isResolved(i) ? `<p class="issue__resolved-meta">${esc(st === 'fixed' ? 'Fixed' : 'Won’t fix')}${i.resolvedIn ? ' in ' + esc(i.resolvedIn) : ''}${i.statusNote ? ' — ' + esc(i.statusNote) : ''}</p>` : ''
  return `
  <article class="issue${isResolved(i) ? ' issue--resolved' : ''}" id="${esc(i.id)}" data-sev="${esc(i.sev)}" data-status="${esc(st)}">
    <header class="issue__head">
      <span class="issue__id">${esc(i.id)}</span>
      <span class="sev ${s.cls}"><span aria-hidden="true">${s.icon}</span>${s.label}</span>
      <span class="cat">${esc(CATL[i.cat] || i.cat)}</span>
      ${STATUS_CHIP[st] || esc(st)}
      ${!isResolved(i) ? `<span class="issue__actions"><button type="button" class="tbtn issue__run hidden" data-run="${esc(i.id)}">▶ fix with Claude</button><button type="button" class="tbtn issue__copy" data-copy="${esc(i.id)}">⧉ copy fix prompt</button></span>` : ''}
      <h3 class="issue__title">${esc(i.title)}</h3>
    </header>
    ${resolvedMeta}
    <p class="issue__body">${esc(i.body)}</p>
    ${ev ? `<div class="issue__ev">${ev}</div>` : ''}
    ${verifyLine(i)}
    ${refs ? `<details class="issue__refs"><summary>${i.refs.length} location${i.refs.length > 1 ? 's' : ''}</summary><ul>${refs}</ul></details>` : ''}
    <p class="issue__rec"><span class="rec-k">Fix</span> ${esc(i.rec)}</p>
    ${!isResolved(i) ? `<textarea class="sr-copy" id="prompt-${esc(i.id)}" readonly aria-hidden="true" tabindex="-1">${esc(fixPrompt(i))}</textarea>` : ''}
  </article>`
}

function iconRow(name) {
  const us = byIcon[name]
  const note = ICON_NOTES[name] || {}
  const label = note.label || name.replace(/^Icon/, '').replace(/([a-z])([A-Z0-9])/g, '$1 $2')
  const cat = (Object.entries(D.registryCategories || {}).find(([, arr]) => arr.includes(name)) || ['—'])[0]
  const allViews = [...new Set(us.flatMap((u) => viewsOf(u.file)))]
  const live = iconLive(name)
  const roles = (note.roles || []).map((r) => `<li>${esc(r)}</li>`).join('')
  const rows = us.map((u) => `<tr><td>${ghLink(u.file, u.line)}</td><td class="dim">${esc(u.kind)}</td><td>${viewChips(viewsOf(u.file))}</td><td class="dim">${esc(hintOf(u))}</td></tr>`).join('')
  const search = (name + ' ' + label + ' ' + (note.roles || []).join(' ')).toLowerCase()
  return `
  <details class="irow"${live ? '' : ' style="opacity:.62"'} data-search="${esc(search)}" data-views="${allViews.join(' ')}">
    <summary>
      ${libGlyph(name, 20)}
      <span class="irow__name">${esc(name)}</span>
      <span class="irow__label">${esc(label)}</span>
      <span class="irow__cat">${esc(cat)}</span>
      <span class="irow__views">${viewChips(allViews.slice(0, 5))}${allViews.length > 5 ? '<span class="vc">+' + (allViews.length - 5) + '</span>' : ''}</span>
      <span class="irow__n">${us.length}</span>
    </summary>
    <div class="irow__detail">
      ${roles ? `<ul class="roles">${roles}</ul>` : ''}
      <table class="utable"><thead><tr><th>Source location</th><th>via</th><th>Surface</th><th>Context</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
  </details>`
}

function inlineGroupCard(group, items) {
  const label = GROUP_LABELS[group] || group
  const rows = items.map((s) => `<tr><td>${inlineGlyph(s.key)}</td><td>${ghLink(s.file, s.line)}</td><td>${viewChips(s.views)}</td><td class="dim">${esc(s.meta.label)} — ${esc(s.meta.meaning)}</td></tr>`).join('')
  return `
  <details class="irow" data-search="${esc((label + ' ' + items.map((s) => s.meta.label + ' ' + s.meta.meaning).join(' ')).toLowerCase())}" data-views="${[...new Set(items.flatMap((s) => s.views))].join(' ')}">
    <summary>${inlineGlyph(items[0].key)}<span class="irow__name">${esc(label)}</span><span class="irow__label">${items.length === 1 ? esc(items[0].meta.meaning) : esc(items.length + ' hand-drawn instances')}</span><span class="irow__n">${items.length}</span></summary>
    <div class="irow__detail"><table class="utable"><thead><tr><th></th><th>Source location</th><th>Surface</th><th>What it is</th></tr></thead><tbody>${rows}</tbody></table></div>
  </details>`
}

function pubRow(a) {
  const st = a.meta.status
  const stChip = { active: '<span class="st st--ok">✓ active</span>', dead: '<span class="st st--dead">✕ dead</span>', zombie: '<span class="st st--zombie">◌ zombie</span>' }[st] || esc(st)
  const sites = a.sites.map((u) => `<li>${ghLink(u.file, u.line)} <span class="dim">${esc(hintOf(u))}</span></li>`).join('')
  const fills = (a.fills || []).map((f) => `<code class="fill" style="--sw:${esc(f)}">${esc(f)}</code>`).join(' ')
  return `
  <details class="irow" data-search="${esc((a.path + ' ' + a.meta.label + ' ' + st).toLowerCase())}" data-views="${[...new Set(a.sites.flatMap((u) => viewsOf(u.file)))].join(' ') || 'none'}">
    <summary>${pubGlyph(a.path)}<span class="irow__name">${esc(a.path)}</span><span class="irow__label">${esc(a.meta.label)}${a.meta.note ? ' — ' + esc(a.meta.note) : ''}</span>${stChip}<span class="irow__n">${a.sites.length}</span></summary>
    <div class="irow__detail">${fills ? `<p class="dim">Baked fills: ${fills}</p>` : ''}${sites ? `<ul class="sitelist">${sites}</ul>` : '<p class="dim">No references found in scanned source.</p>'}</div>
  </details>`
}

// by-surface rollup
const surfaceRoll = {}
for (const u of usages) {
  if (!((u.icon && !u.unknown) || u.kind === 'dynamic' || u.kind === 'publicAsset')) continue
  for (const v of viewsOf(u.file)) {
    const r = (surfaceRoll[v] ||= { icons: new Set(), files: new Set(), n: 0 })
    if (u.icon) r.icons.add(u.icon)
    r.files.add(u.file); r.n++
  }
}
for (const s of inlineIcons) for (const v of s.views) { const r = (surfaceRoll[v] ||= { icons: new Set(), files: new Set(), n: 0 }); r.files.add(s.file); r.n++ }
const surfaceOrder = [...(CFG.views?.order || Object.keys(VIEWS))]
for (const v of ['shared', 'UNREACHED']) if (!surfaceOrder.includes(v)) surfaceOrder.push(v)

function surfaceCard(v) {
  const r = surfaceRoll[v]
  if (!r) return ''
  const meta = VIEWS[v] || { label: v }
  const icons = [...r.icons].sort()
  const strip = icons.slice(0, 24).map((n) => `<span title="${esc(n)}">${libGlyph(n, 16)}</span>`).join('')
  return `
  <div class="surf${v === 'UNREACHED' || meta.legacy ? ' surf--dead' : ''}">
    <div class="surf__head">
      <h4>${esc(meta.label)}</h4>
      ${meta.hash ? `<a class="applink" data-hash="${esc(meta.hash)}" href="#">open ↗</a>` : ''}
    </div>
    <p class="surf__nav">${esc(meta.nav || '')}</p>
    <div class="surf__strip">${strip}${icons.length > 24 ? `<span class="dim">+${icons.length - 24}</span>` : ''}</div>
    <p class="surf__meta">${icons.length} lib icons · ${r.n} usage sites · ${r.files.size} files</p>
  </div>`
}

const libComp = (D.libComponentIcons || []).filter((c) => c.icons.length || c.inlineSvgCount)
const libCompRows = libComp.map((c) => `<tr><td class="mono">${esc(c.component)}</td><td>${c.icons.map((n) => `<span class="lc-ic">${libGlyph(n, 16)}<span class="mono dim">${esc(n)}</span></span>`).join(' ')}${c.inlineSvgCount ? `<span class="dim"> +${c.inlineSvgCount} inline svg</span>` : ''}</td><td class="dim mono">${esc(c.subpath)}</td></tr>`).join('')

const glyphRows = GLYPH_UI.map((g) => `<tr><td>${charGlyph(g.char)}</td><td>${esc(g.meaning)}</td><td>${viewChips([g.view || 'app'])}</td><td>${ghLink(g.file, g.line)}</td><td class="dim">${esc(g.a11y || '')}</td></tr>`).join('')
const rawGlyphRows = !GLYPH_UI.length ? D.usages.filter((u) => u.kind === 'glyph').map((u) =>
  `<tr><td>${charGlyph(u.char)}</td><td class="dim">uncurated — classify in curation.mjs</td><td>${viewChips(viewsOf(u.file))}</td><td>${ghLink(u.file, u.line)}</td><td class="dim">${esc((u.tag || '').slice(0, 60))}</td></tr>`).join('') : ''
const cssRows = CSS_ICONS.map((c) => `<tr><td>${c.asset && c.asset.startsWith('/') ? pubGlyph(c.asset) : '<span class="g g--char">✧</span>'}</td><td>${esc(c.label)}</td><td>${esc(c.meaning)}</td><td>${viewChips([c.view || 'app'])}</td><td>${c.line ? ghLink(c.file, c.line) : esc(c.file)}</td></tr>`).join('')
const vocabBlocks = GLYPH_VOCABS.map((v) => `
  <p class="dim" style="margin:10px 0 6px;font-size:13px">${esc(v.title)}${v.note ? ' — ' + esc(v.note) : ''}</p>
  <div style="border:1px solid var(--line);background:var(--surface);padding:12px 16px 6px">${v.pairs.map(([t, g]) => `<span class="tg"><span class="g g--char">${esc(g)}</span><span class="mono dim">${esc(t)}</span></span>`).join('')}</div>`).join('')
const canonRows = CANON.map((c) => `<tr><td>${esc(c.meaning)}</td><td class="mono">${esc(c.canonical)}</td><td class="dim">${esc(c.migrate)}</td><td>${c.issue ? `<a href="#${esc(c.issue)}" class="issue-ref">${esc(c.issue)}</a>` : ''}</td></tr>`).join('')
const mechBars = mech.map(([label, n]) => `
  <div class="bar"><span class="bar__label">${esc(label)}</span><span class="bar__track"><span class="bar__fill" style="width:${Math.max(2, Math.round((n / mechMax) * 100))}%"></span></span><span class="bar__n">${n}</span></div>`).join('')
const dynRows = dynamics.map((u) => `<tr><td>${ghLink(u.file, u.line)}</td><td class="mono dim">:icon="${esc(u.dynamicExpr)}"</td><td>${viewChips(viewsOf(u.file))}</td></tr>`).join('')
const unknownRows = unknowns.map((u) => `<tr><td class="mono">${esc(u.icon)}</td><td>${ghLink(u.file, u.line)}</td><td class="dim">name not found in registry — verify, then fix or add to SKIP_USAGES</td></tr>`).join('')

const title = `${PROJECT.name || 'Project'} — Icon Audit ${D.generatedAt}`
const hasCuration = ISSUES.length > 0

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{
  --bg:#f4f4f1; --surface:#fdfdfb; --surface2:#ecece7; --ink:#191d22; --ink2:#565d68; --ink3:#8a919c;
  --line:#d9d9d2; --line2:#c8c8bf; --accent:#0b7fc4; --accent-ink:#0a6da8; --accent-wash:rgba(11,127,196,.08);
  --high:#b3261e; --high-wash:rgba(179,38,30,.09); --med:#8a5a00; --med-wash:rgba(176,120,0,.11); --low:#3b5f8f; --low-wash:rgba(59,95,143,.10);
  --ok:#2c6b3f; --dead:#b3261e; --zombie:#8a5a00; --chip:#e7e7e0; --mono:ui-monospace,'SF Mono','Cascadia Code',Menlo,Consolas,monospace;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}
:root[data-theme=dark]{
  --bg:#101318; --surface:#171b21; --surface2:#1e242c; --ink:#dfe4ea; --ink2:#9aa3af; --ink3:#6b7480;
  --line:#272d36; --line2:#333b46; --accent:#58b6ec; --accent-ink:#7cc6f0; --accent-wash:rgba(88,182,236,.10);
  --high:#ef6a5e; --high-wash:rgba(239,106,94,.12); --med:#d9a514; --med-wash:rgba(217,165,20,.12); --low:#7ea7d8; --low-wash:rgba(126,167,216,.12);
  --ok:#5fae76; --dead:#ef6a5e; --zombie:#d9a514; --chip:#232a33;
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--ink);font:15px/1.55 var(--sans);-webkit-font-smoothing:antialiased}
.wrap{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:0 28px 120px}
.wrap::before{content:'';position:absolute;left:-40px;right:-40px;top:0;height:360px;pointer-events:none;z-index:-1;opacity:.5;
  background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);
  background-size:56px 56px;mask-image:linear-gradient(#000 0,transparent 100%);-webkit-mask-image:linear-gradient(#000 0,transparent 100%)}
a{color:var(--accent-ink)}
code,.mono{font-family:var(--mono);font-size:.86em}
.dim{color:var(--ink2)}
header.masthead{padding:54px 0 26px;border-bottom:2px solid var(--ink)}
.masthead .kicker{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent-ink);display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.masthead .kicker .rule{flex:1;height:1px;background:var(--line2)}
h1{font-family:var(--mono);font-weight:700;font-size:clamp(26px,4.4vw,44px);letter-spacing:-.02em;line-height:1.08;margin:14px 0 10px;text-wrap:balance}
h1 em{font-style:normal;color:var(--accent-ink)}
.masthead .sub{max-width:74ch;color:var(--ink2)}
.meta-line{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:18px;font-family:var(--mono);font-size:12px;color:var(--ink3)}
.meta-line b{color:var(--ink2);font-weight:600}
.toolbar{position:sticky;top:0;z-index:40;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 0;margin-top:6px;
  background:var(--bg);border-bottom:1px solid var(--line)}
.toolbar .grow{flex:1}
.tbtn{font-family:var(--mono);font-size:12px;border:1px solid var(--line2);background:var(--surface);color:var(--ink2);
  border-radius:6px;padding:5px 11px;cursor:pointer}
.tbtn:hover{color:var(--ink);border-color:var(--ink3)}
select.tbtn, input.tbtn{cursor:auto}
.toolbar label{font-family:var(--mono);font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:.08em}
nav.toc{display:flex;gap:4px 16px;flex-wrap:wrap;font-family:var(--mono);font-size:12px}
nav.toc a{text-decoration:none;color:var(--ink2)} nav.toc a:hover{color:var(--accent-ink)}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);margin:34px 0 8px}
.stat{background:var(--surface);padding:18px 16px 14px}
.stat .n{font-family:var(--mono);font-size:34px;font-weight:700;letter-spacing:-.03em;line-height:1}
.stat .n small{font-size:16px;color:var(--ink3);font-weight:400}
.stat .l{margin-top:7px;font-size:12px;color:var(--ink2)}
.stat--issues .n{color:var(--high)}
.stat--accent .n{color:var(--accent-ink)}
.bars{margin:26px 0 0;border:1px solid var(--line);background:var(--surface);padding:18px 20px}
.bars h3{font-family:var(--mono);font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin-bottom:14px}
.bar{display:grid;grid-template-columns:minmax(200px,340px) 1fr 52px;gap:12px;align-items:center;padding:4px 0}
.bar__label{font-size:13px;color:var(--ink2)}
.bar__track{height:14px;background:var(--surface2);border-radius:3px;overflow:hidden}
.bar__fill{display:block;height:100%;background:var(--accent);border-radius:3px 4px 4px 3px}
.bar__n{font-family:var(--mono);font-size:13px;text-align:right}
section{margin-top:64px}
.sec-head{display:flex;align-items:baseline;gap:16px;border-bottom:2px solid var(--ink);padding-bottom:8px;margin-bottom:6px}
.sec-head .no{font-family:var(--mono);font-size:13px;color:var(--accent-ink);letter-spacing:.1em}
.sec-head h2{font-family:var(--mono);font-size:21px;letter-spacing:-.01em}
.sec-head .count{margin-left:auto;font-family:var(--mono);font-size:12px;color:var(--ink3)}
.sec-intro{color:var(--ink2);max-width:80ch;margin:10px 0 22px}
.sec-sub{font-family:var(--mono);font-size:13px;margin:26px 0 10px;color:var(--ink2)}
.issue{border:1px solid var(--line);border-left:4px solid var(--line2);background:var(--surface);padding:18px 20px 16px;margin-bottom:14px}
.issue[data-sev=high]{border-left-color:var(--high)}
.issue[data-sev=med]{border-left-color:var(--med)}
.issue[data-sev=low]{border-left-color:var(--low)}
.issue__head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.issue__id{font-family:var(--mono);font-size:12px;color:var(--ink3)}
.sev{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:2px 9px;border-radius:99px;display:inline-flex;gap:6px;align-items:center}
.sev--high{color:var(--high);background:var(--high-wash)}
.sev--med{color:var(--med);background:var(--med-wash)}
.sev--low{color:var(--low);background:var(--low-wash)}
.cat{font-family:var(--mono);font-size:11px;color:var(--ink3);border:1px solid var(--line2);border-radius:99px;padding:2px 9px}
.issue__title{font-size:16.5px;font-weight:650;width:100%;margin-top:2px;letter-spacing:-.01em}
.issue__body{color:var(--ink2);max-width:88ch;margin-top:8px}
.issue__ev{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.ev{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--surface2);border-radius:7px;padding:5px 10px 5px 7px}
.ev__cap{font-family:var(--mono);font-size:11.5px;color:var(--ink2)}
.issue__refs{margin-top:12px;font-size:13px}
.issue__refs summary{cursor:pointer;color:var(--ink3);font-family:var(--mono);font-size:12px}
.issue__refs ul{columns:2;gap:28px;margin:8px 0 0 2px;list-style:none}
.issue__refs li{margin-bottom:3px;break-inside:avoid}
.issue__rec{margin-top:14px;padding:10px 14px;background:var(--accent-wash);border-left:3px solid var(--accent);color:var(--ink);max-width:100ch}
.rec-k{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent-ink);margin-right:8px}
.g{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:6px;background:var(--chip);flex:none;color:var(--ink)}
.g svg{display:block;width:18px;height:18px;overflow:visible}
.g--lib svg path:not([fill]),.g--lib svg circle:not([fill]),.g--lib svg rect:not([fill]){fill:currentColor}
.g--char{font-size:16px;font-family:var(--sans)}
.g--asset{background:#fff;border:1px solid var(--line)}
.g--missing{color:var(--ink3);font-family:var(--mono);font-size:10px}
.g--chart{color:var(--ink3)}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 16px}
.controls input[type=search]{min-width:260px;flex:1;max-width:420px}
.irow{border:1px solid var(--line);background:var(--surface);margin-bottom:6px}
.irow[open]{border-color:var(--line2)}
.irow>summary{display:flex;align-items:center;gap:12px;padding:9px 14px;cursor:pointer;list-style:none}
.irow>summary::-webkit-details-marker{display:none}
.irow>summary:hover{background:var(--surface2)}
.irow__name{font-family:var(--mono);font-size:13px;font-weight:600;min-width:150px}
.irow__label{color:var(--ink2);font-size:13px;flex:1;min-width:120px}
.irow__cat{font-family:var(--mono);font-size:11px;color:var(--ink3);min-width:80px}
.irow__views{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.irow__n{font-family:var(--mono);font-size:12.5px;color:var(--ink2);background:var(--surface2);border-radius:99px;padding:2px 9px;min-width:34px;text-align:center}
.irow__detail{padding:4px 14px 14px;border-top:1px dashed var(--line)}
.roles{margin:10px 0 4px 18px;color:var(--ink2);font-size:13px}
.vc{display:inline-block;font-family:var(--mono);font-size:10.5px;padding:1px 7px;border-radius:99px;background:var(--accent-wash);color:var(--accent-ink);text-decoration:none;white-space:nowrap}
.vc--chrome{background:var(--surface2);color:var(--ink2)}
.vc--dead{background:var(--high-wash);color:var(--high)}
a.vc:hover{outline:1px solid var(--accent)}
.utable{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px}
.utable th{text-align:left;font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);padding:4px 10px 6px;border-bottom:1px solid var(--line)}
.utable td{padding:5px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.utable tr:last-child td{border-bottom:none}
a.src,span.src{font-family:var(--mono);font-size:12px;text-decoration:none;color:var(--accent-ink);word-break:break-all}
span.src{color:var(--ink2)}
a.src:hover{text-decoration:underline}
.st{font-family:var(--mono);font-size:11px;padding:2px 9px;border-radius:99px;white-space:nowrap}
.st--ok{color:var(--ok);background:color-mix(in srgb,var(--ok) 12%,transparent)}
.st--dead{color:var(--dead);background:var(--high-wash)}
.st--zombie{color:var(--zombie);background:var(--med-wash)}
.st--openx{color:var(--ink3);background:var(--surface2)}
.st--prog{color:var(--accent-ink);background:var(--accent-wash)}
.st--wontfix{color:var(--ink3);background:var(--surface2);text-decoration:line-through}
.issue--resolved{opacity:.62;border-left-color:var(--ok)!important}
.issue--resolved .issue__body,.issue--resolved .issue__ev,.issue--resolved .issue__rec{display:none}
.issue--resolved[data-status=fixed] .issue__verify--fail{display:block}
.issue__resolved-meta{font-family:var(--mono);font-size:12px;color:var(--ok);margin-top:6px}
.issue__verify{margin-top:12px;font-size:13px;color:var(--ink2)}
.issue__verify--ok{color:var(--ok)}
.issue__verify--fail{padding:9px 13px;background:var(--high-wash);border-left:3px solid var(--high);color:var(--high);font-weight:550}
.issue__actions{margin-left:auto;display:inline-flex;gap:8px}
.issue__copy:hover,.issue__run:hover{color:var(--accent-ink);border-color:var(--accent)}
.issue__run{color:var(--ok);border-color:color-mix(in srgb,var(--ok) 45%,var(--line2))}
.fixdrawer{position:fixed;left:0;right:0;bottom:0;z-index:80;background:var(--surface);border-top:2px solid var(--accent);box-shadow:0 -6px 24px rgba(0,0,0,.25);max-height:42vh;display:flex;flex-direction:column}
.fixdrawer.hidden{display:none}
.fixdrawer__head{display:flex;gap:12px;align-items:center;padding:9px 18px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12.5px}
.fixdrawer__dot{width:9px;height:9px;border-radius:99px;background:var(--accent);animation:fixbeat 1.2s ease-in-out infinite}
.fixdrawer--done .fixdrawer__dot{background:var(--ok);animation:none}
.fixdrawer--error .fixdrawer__dot{background:var(--high);animation:none}
@keyframes fixbeat{0%,100%{opacity:1}50%{opacity:.3}}
.fixdrawer__title b{color:var(--accent-ink)}
.fixdrawer__close{margin-left:auto}
.fixdrawer__log{flex:1;overflow:auto;margin:0;padding:12px 18px;font-family:var(--mono);font-size:12px;line-height:1.55;white-space:pre-wrap;color:var(--ink2)}
.sr-copy{position:absolute;left:-9999px;top:0;width:10px;height:10px}
.progress{margin:10px 0 0;border:1px solid var(--line);background:var(--surface);padding:12px 20px 14px}
.progress__head{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;font-size:13px;color:var(--ink2);margin-bottom:9px}
.progress__head b{font-family:var(--mono);color:var(--ink)}
.progress__track{height:10px;background:var(--surface2);border-radius:99px;overflow:hidden}
.progress__fill{display:block;height:100%;background:var(--ok);border-radius:99px;min-width:2px;transition:width .3s}
.fill{padding:1px 7px 1px 20px;border:1px solid var(--line);border-radius:4px;position:relative}
.fill::before{content:'';position:absolute;left:5px;top:50%;translate:0 -50%;width:9px;height:9px;border-radius:2px;background:var(--sw,#000);border:1px solid var(--line2)}
.sitelist{list-style:none;margin-top:8px}
.sitelist li{padding:3px 0;border-bottom:1px dashed var(--line)}
.sitelist li:last-child{border:none}
.ctable{width:100%;border-collapse:collapse;font-size:13.5px;background:var(--surface);border:1px solid var(--line)}
.ctable th{font-family:var(--mono);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);text-align:left;padding:10px 14px;border-bottom:2px solid var(--ink)}
.ctable td{padding:9px 14px;border-bottom:1px solid var(--line);vertical-align:top}
.ctable tr:hover td{background:var(--surface2)}
.issue-ref{font-family:var(--mono);font-size:12px;text-decoration:none;border:1px solid var(--line2);border-radius:5px;padding:1px 7px}
.surfaces{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.surf{border:1px solid var(--line);background:var(--surface);padding:14px 16px}
.surf--dead{opacity:.66}
.surf__head{display:flex;align-items:baseline;gap:10px}
.surf__head h4{font-family:var(--mono);font-size:14px}
.applink{margin-left:auto;font-family:var(--mono);font-size:11.5px;text-decoration:none}
.surf__nav{font-size:12px;color:var(--ink3);margin:2px 0 10px}
.surf__strip{display:flex;flex-wrap:wrap;gap:5px}
.surf__strip .g{width:26px;height:26px}.surf__strip .g svg{width:15px;height:15px}
.surf__meta{margin-top:10px;font-family:var(--mono);font-size:11px;color:var(--ink3)}
.tg{display:inline-flex;align-items:center;gap:6px;margin:0 12px 8px 0}
.lc-ic{display:inline-flex;align-items:center;gap:5px;margin-right:12px}
.notes{border:1px solid var(--line);background:var(--surface);padding:6px 22px 18px;max-width:100ch}
.notes li{margin-top:11px;color:var(--ink2)}
.tablebox{border:1px solid var(--line);background:var(--surface);padding:0 14px 8px;overflow-x:auto}
.hidden{display:none!important}
footer{margin-top:80px;border-top:1px solid var(--line);padding-top:16px;font-family:var(--mono);font-size:11.5px;color:var(--ink3);display:flex;gap:20px;flex-wrap:wrap}
@media (max-width:760px){.irow__cat,.irow__views{display:none}.issue__refs ul{columns:1}.bar{grid-template-columns:1fr;gap:2px}.bar__n{text-align:left}}
@media print{.toolbar{display:none}.irow{break-inside:avoid}}
</style>
</head>
<body>
<div class="wrap">

<header class="masthead">
  <div class="kicker"><span>${esc(PROJECT.name || 'project')}</span><span class="rule"></span><span>UI-${esc(D.generatedAt)}</span></div>
  <h1>Icon <em>Audit</em> — every glyph, every surface, every inconsistency</h1>
  <p class="sub">A full static-analysis inventory of icon usage: what each icon means, where it lives, where the vocabulary contradicts itself, and the concrete path to one coherent icon system. Every location links to source${BASES.length ? ' and to the running app' : ''}.</p>
  <div class="meta-line">
    ${PROJECT.branch ? `<span><b>branch</b> ${esc(PROJECT.branch)}</span>` : ''}
    ${PROJECT.baseCommit ? `<span><b>base</b> ${esc(PROJECT.baseCommit)}</span>` : ''}
    <span><b>generated</b> ${esc(D.generatedAt)}</span>
    <span><b>scan</b> ${D.counts.files} files · ${usages.length + (GLYPH_UI.length || glyphUsageCount)} usage sites</span>
  </div>
</header>

<div class="toolbar">
  <nav class="toc">
    ${hasCuration ? '<a href="#s1">01 Issues</a><a href="#s2">02 Canonical map</a>' : ''}
    <a href="#s3">03 Inventory</a><a href="#s4">04 By surface</a>
    ${libCompRows ? '<a href="#s5">05 Lib internals</a>' : ''}<a href="#s6">06 Method</a>
  </nav>
  <span class="grow"></span>
  ${BASES.length ? `<label for="base-select">App links</label>
  <select id="base-select" class="tbtn">${BASES.map((b) => `<option value="${esc(b.url)}">${esc(b.label)}</option>`).join('')}<option value="custom">custom…</option></select>
  <input id="base-custom" class="tbtn hidden" type="text" size="26" placeholder="https://host/path/">` : ''}
  <button id="theme-toggle" class="tbtn" type="button">◐ theme</button>
</div>

<div class="stats">
  <div class="stat stat--accent"><div class="n">${liveIcons.length}${quarIcons.length ? `<small> +${quarIcons.length} quarantined</small>` : ''}</div><div class="l">library icons in use</div></div>
  <div class="stat"><div class="n">${inlineIcons.length}</div><div class="l">hand-drawn inline SVG icons</div></div>
  ${pubAssets.length ? `<div class="stat"><div class="n">${pubAssets.length}<small> assets</small></div><div class="l">public icons — ${deadPub} dead, ${zombiePub} zombie</div></div>` : ''}
  <div class="stat"><div class="n">${GLYPH_UI.length || glyphUsageCount}</div><div class="l">unicode / entity glyphs ${GLYPH_UI.length ? 'in UI roles' : '(uncurated hits)'}</div></div>
  ${hasCuration ? `<div class="stat stat--issues"><div class="n">${ISSUES.length - issuesResolved}${issuesResolved ? `<small> open · ${issuesResolved} resolved</small>` : ''}</div><div class="l">issues — ${sevCount.high || 0} high · ${sevCount.med || 0} medium · ${sevCount.low || 0} low</div></div>` : `<div class="stat"><div class="n">${unknowns.length}</div><div class="l">unknown icon names (verify!)</div></div>`}
</div>

${hasCuration ? `<div class="progress">
  <div class="progress__head"><span>Cleanup progress</span><b>${issuesResolved} / ${ISSUES.length} issues resolved</b><span class="dim">·</span><span>${sitesDone} / ${sitesTotal} affected sites</span></div>
  <div class="progress__track"><span class="progress__fill" style="width:${Math.round((issuesResolved / Math.max(1, ISSUES.length)) * 100)}%"></span></div>
</div>` : ''}

<div class="bars">
  <h3>Usage sites by mechanism</h3>
  ${mechBars}
  <p class="dim" style="margin-top:10px;font-size:12.5px">Multiple ways of putting an icon on screen coexist. The cleanup goal is the first row absorbing most of the rest.</p>
</div>

${hasCuration ? `
<section id="s1">
  <div class="sec-head"><span class="no">01</span><h2>Issues &amp; recommendations</h2><span class="count">${ISSUES.length} findings</span></div>
  <p class="sec-intro">Ordered by severity. <b>High</b> = broken today or the biggest coherence wins; <b>Medium</b> = real contradictions worth a decision; <b>Low</b> = hygiene to fold into adjacent work. Each finding carries its evidence (rendered from the actual assets), every affected location, and a <b>copy fix prompt</b> button — paste that prompt into your coding agent (Claude Code, Codex, …) in this repo, or run the icon-fix skill, to execute the fix; the audit re-run flips the status here.</p>
  ${['high', 'med', 'low'].map((s) => ISSUES.filter((i) => i.sev === s && !isResolved(i)).map(issueCard).join('')).join('')}
  ${issuesResolved ? `<h3 class="sec-sub" id="resolved">Resolved <span class="dim">(${issuesResolved})</span></h3>
  ${['high', 'med', 'low'].map((s) => ISSUES.filter((i) => i.sev === s && isResolved(i)).map(issueCard).join('')).join('')}` : ''}
</section>

<section id="s2">
  <div class="sec-head"><span class="no">02</span><h2>Canonical vocabulary map</h2><span class="count">${CANON.length} meanings</span></div>
  <p class="sec-intro">The proposed target state: one icon per meaning. “Migrate from” lists everything currently doing that job. Treat this table as the decision sheet — approve a row, then its issue card is the work order.</p>
  <table class="ctable"><thead><tr><th>Meaning</th><th>Canonical icon</th><th>Migrate from</th><th>Issue</th></tr></thead><tbody>${canonRows}</tbody></table>
</section>` : `
<section id="s0">
  <div class="sec-head"><span class="no">—</span><h2>Raw inventory mode</h2></div>
  <p class="sec-intro">No curation file was supplied, so this page shows the mechanical inventory only. Review it, author a curation module (icon meanings, inline-SVG classification, issue catalog, canonical map), and rebuild for the full audit.</p>
</section>`}

<section id="s3">
  <div class="sec-head"><span class="no">03</span><h2>Full inventory</h2><span class="count">${liveIcons.length + quarIcons.length} lib · ${inlineIcons.length} inline · ${pubAssets.length} public</span></div>
  <div class="controls">
    <input id="filter-q" class="tbtn" type="search" placeholder="Filter by name, meaning, glyph…">
    <select id="filter-view" class="tbtn"><option value="">All surfaces</option>${surfaceOrder.filter((v) => surfaceRoll[v]).map((v) => `<option value="${esc(v)}">${esc((VIEWS[v] || { label: v }).label)}</option>`).join('')}</select>
    <button class="tbtn" id="filter-clear" type="button">clear</button>
  </div>

  <h3 class="sec-sub">3a · Library icons <span class="dim">(${liveIcons.length} live${quarIcons.length ? `, ${quarIcons.length} referenced only from dead code — dimmed` : ''})</span></h3>
  <div id="inv-lib">${liveIcons.map(iconRow).join('')}${quarIcons.map(iconRow).join('')}</div>

  ${unknownRows ? `<h3 class="sec-sub">3a′ · Unknown icon names <span class="dim">(string matches the icon pattern but is NOT in the registry — broken ref or false positive)</span></h3>
  <div class="tablebox"><table class="utable"><thead><tr><th>Name</th><th>Location</th><th>Action</th></tr></thead><tbody>${unknownRows}</tbody></table></div>` : ''}

  <h3 class="sec-sub">3b · Hand-drawn inline SVGs <span class="dim">(${inlineIcons.length} icon-shaped${inlineOther.length ? `; ${inlineOther.length} charts/decor listed last` : ''})</span></h3>
  <div id="inv-inline">
    ${Object.entries(inlineGroups).sort((a, b) => b[1].length - a[1].length).map(([g, items]) => inlineGroupCard(g, items)).join('')}
    ${inlineOther.length ? `<details class="irow" data-search="charts decorations gauges sparklines" data-views="${[...new Set(inlineOther.flatMap((s) => s.views))].join(' ')}">
      <summary><span class="g g--chart">▦</span><span class="irow__name">Charts &amp; decor</span><span class="irow__label">data-viz and decorative SVGs — inventoried, excluded from icon issues</span><span class="irow__n">${inlineOther.length}</span></summary>
      <div class="irow__detail"><table class="utable"><thead><tr><th>Source location</th><th>Surface</th><th>What it is</th></tr></thead><tbody>
      ${inlineOther.map((s) => `<tr><td>${ghLink(s.file, s.line)}</td><td>${viewChips(s.views)}</td><td class="dim">${esc(s.meta.label)} — ${esc(s.meta.meaning)}</td></tr>`).join('')}
      </tbody></table></div>
    </details>` : ''}
  </div>

  ${pubAssets.length ? `<h3 class="sec-sub">3c · Public assets <span class="dim">(rendered with their baked fills on a white chip — that is the theming problem)</span></h3>
  <div id="inv-public">${pubAssets.map(pubRow).join('')}</div>` : ''}

  <h3 class="sec-sub">3d · Unicode, entity &amp; emoji glyphs ${GLYPH_UI.length ? 'in UI roles' : '<span class="dim">(raw scanner hits — curate before trusting; prose/debug noise included)</span>'}</h3>
  <div class="tablebox"><table class="utable"><thead><tr><th></th><th>Meaning</th><th>Surface</th><th>Location</th><th>Note</th></tr></thead><tbody>${glyphRows || rawGlyphRows}</tbody></table></div>
  ${vocabBlocks}

  ${cssRows ? `<h3 class="sec-sub">3e · CSS-mechanism icons <span class="dim">(masks, data-URI carets, content glyphs, drawn shapes)</span></h3>
  <div class="tablebox"><table class="utable"><thead><tr><th></th><th>Icon</th><th>Meaning</th><th>Surface</th><th>Location</th></tr></thead><tbody>${cssRows}</tbody></table></div>` : ''}

  ${dynRows ? `<h3 class="sec-sub">3f · Dynamic icon bindings <span class="dim">(icon chosen at runtime from the data maps above)</span></h3>
  <div class="tablebox"><table class="utable"><thead><tr><th>Render site</th><th>Binding</th><th>Surface</th></tr></thead><tbody>${dynRows}</tbody></table></div>` : ''}
</section>

<section id="s4">
  <div class="sec-head"><span class="no">04</span><h2>Icons by surface</h2></div>
  <p class="sec-intro">Where to look in the running app.</p>
  <div class="surfaces">${surfaceOrder.map(surfaceCard).join('')}</div>
</section>

${libCompRows ? `<section id="s5">
  <div class="sec-head"><span class="no">05</span><h2>Icons inside library components</h2><span class="count">${libComp.length} components</span></div>
  <p class="sec-intro">These render on-screen but are owned by the external UI library, not this codebase. In scope for awareness; changes belong upstream.</p>
  <div class="tablebox"><table class="utable"><thead><tr><th>Component</th><th>Internal icons</th><th>lib path</th></tr></thead><tbody>${libCompRows}</tbody></table></div>
</section>` : ''}

<section id="s6">
  <div class="sec-head"><span class="no">06</span><h2>Coverage &amp; method</h2></div>
  <div class="notes"><ul>${COVERAGE_NOTES.map((n) => `<li>${esc(n)}</li>`).join('') || '<li>Static scan via the icon-audit extractor; see the audit config for scanned roots, registry sources and view roots.</li>'}</ul></div>
</section>

<footer>
  <span>Generated ${esc(D.generatedAt)}${PROJECT.branch ? ' · ' + esc(PROJECT.branch) : ''}${PROJECT.baseCommit ? ' @ ' + esc(PROJECT.baseCommit) : ''}</span>
  <span>icon-audit skill · static analysis</span>
</footer>
</div>

<div class="fixdrawer hidden" id="fixdrawer" role="log" aria-live="polite">
  <div class="fixdrawer__head">
    <span class="fixdrawer__dot" aria-hidden="true"></span>
    <span class="fixdrawer__title">Fixing <b id="fixdrawer-issue">—</b> with <span id="fixdrawer-engine">Claude</span></span>
    <span class="dim" id="fixdrawer-state"></span>
    <button type="button" class="tbtn fixdrawer__close" id="fixdrawer-close">close</button>
  </div>
  <pre class="fixdrawer__log" id="fixdrawer-log"></pre>
</div>

<script>
(function () {
  var root = document.documentElement;
  var THEME_KEY = 'icon-audit-theme', BASE_KEY = 'icon-audit-base';
  function applyTheme(t) { root.setAttribute('data-theme', t); try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
  var saved = null; try { saved = localStorage.getItem(THEME_KEY); } catch (e) {}
  applyTheme(saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  document.getElementById('theme-toggle').addEventListener('click', function () {
    applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  var baseSel = document.getElementById('base-select');
  var baseCustom = document.getElementById('base-custom');
  if (baseSel) {
    var currentBase = function () {
      var v = baseSel.value === 'custom' ? baseCustom.value : baseSel.value;
      if (v && v.charAt(v.length - 1) !== '/') v += '/';
      return v || baseSel.options[0].value;
    };
    var applyBase = function () {
      var b = currentBase();
      try { localStorage.setItem(BASE_KEY, baseSel.value === 'custom' ? 'custom:' + baseCustom.value : baseSel.value); } catch (e) {}
      var links = document.querySelectorAll('[data-hash]');
      for (var i = 0; i < links.length; i++) {
        links[i].setAttribute('href', b + links[i].getAttribute('data-hash'));
        links[i].setAttribute('target', '_blank'); links[i].setAttribute('rel', 'noopener');
      }
    };
    baseSel.addEventListener('change', function () {
      baseCustom.classList.toggle('hidden', baseSel.value !== 'custom'); applyBase();
    });
    baseCustom.addEventListener('input', applyBase);
    var savedBase = null; try { savedBase = localStorage.getItem(BASE_KEY); } catch (e) {}
    if (savedBase) {
      if (savedBase.indexOf('custom:') === 0) { baseSel.value = 'custom'; baseCustom.value = savedBase.slice(7); baseCustom.classList.remove('hidden'); }
      else { baseSel.value = savedBase; }
    }
    applyBase();
  }

  var q = document.getElementById('filter-q');
  var vsel = document.getElementById('filter-view');
  function applyFilter() {
    var needle = (q.value || '').toLowerCase().trim();
    var view = vsel.value;
    var rows = document.querySelectorAll('#s3 .irow');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var okQ = !needle || (r.getAttribute('data-search') || '').indexOf(needle) !== -1;
      var okV = !view || (' ' + (r.getAttribute('data-views') || '') + ' ').indexOf(' ' + view + ' ') !== -1;
      r.classList.toggle('hidden', !(okQ && okV));
    }
  }
  q.addEventListener('input', applyFilter);
  vsel.addEventListener('change', applyFilter);
  document.getElementById('filter-clear').addEventListener('click', function () { q.value = ''; vsel.value = ''; applyFilter(); });

  // copy-fix-prompt buttons
  var copies = document.querySelectorAll('[data-copy]');
  for (var c = 0; c < copies.length; c++) {
    copies[c].addEventListener('click', function () {
      var id = this.getAttribute('data-copy');
      var ta = document.getElementById('prompt-' + id);
      if (!ta) return;
      var btn = this, done = function (ok) {
        var t = btn.textContent;
        btn.textContent = ok ? 'copied ✓' : 'copy failed — prompt shown below';
        if (!ok) { ta.classList.remove('sr-copy'); ta.style.width = '100%'; ta.style.height = '220px'; ta.style.marginTop = '10px'; }
        setTimeout(function () { btn.textContent = t; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(function () { done(true); }, function () {
          try { ta.focus(); ta.select(); done(document.execCommand('copy')); } catch (e) { done(false); }
        });
      } else {
        try { ta.focus(); ta.select(); done(document.execCommand('copy')); } catch (e) { done(false); }
      }
    });
  }

  // ---- fix dispatcher integration (buttons appear only when the local server is up) ----
  var FIX = null;
  try { FIX = localStorage.getItem('icon-audit-fixserver') || 'http://127.0.0.1:4820'; } catch (e) { FIX = 'http://127.0.0.1:4820'; }
  var drawer = document.getElementById('fixdrawer');
  var dLog = document.getElementById('fixdrawer-log');
  var dIssue = document.getElementById('fixdrawer-issue');
  var dState = document.getElementById('fixdrawer-state');
  var es = null;
  function drawerShow(id, state) {
    drawer.classList.remove('hidden', 'fixdrawer--done', 'fixdrawer--error');
    if (state === 'done') drawer.classList.add('fixdrawer--done');
    if (state === 'error') drawer.classList.add('fixdrawer--error');
    if (id) dIssue.textContent = id;
    dState.textContent = state || 'running';
  }
  function logLine(s) { dLog.textContent += s + '\\n'; dLog.scrollTop = dLog.scrollHeight; }
  function subscribe() {
    if (es) es.close();
    es = new EventSource(FIX + '/events');
    es.onmessage = function (m) {
      var ev; try { ev = JSON.parse(m.data); } catch (e) { return; }
      if (ev.line) logLine(ev.line);
      if (ev.type === 'state') drawerShow(ev.id || dIssue.textContent, ev.state);
      if (ev.type === 'rebuilt') {
        drawerShow(dIssue.textContent, ev.state === 'error' ? 'error' : 'done');
        if (ev.state !== 'error') setTimeout(function () { location.reload(); }, 1600);
      }
    };
  }
  document.getElementById('fixdrawer-close').addEventListener('click', function () {
    drawer.classList.add('hidden'); if (es) { es.close(); es = null; }
  });
  fetch(FIX + '/status', { mode: 'cors' }).then(function (r) { return r.json(); }).then(function (s) {
    if (!s || s.service !== 'icon-audit-fix') return;
    var engine = s.engine || 'Claude';
    var engEl = document.getElementById('fixdrawer-engine');
    if (engEl) engEl.textContent = engine;
    var runs = document.querySelectorAll('.issue__run');
    for (var i = 0; i < runs.length; i++) {
      runs[i].classList.remove('hidden');
      runs[i].textContent = '▶ fix with ' + engine;
    }
    if (s.job && (s.job.state === 'running' || s.job.state === 'rebuilding')) {
      drawerShow(s.job.id, s.job.state);
      (s.job.log || []).forEach(logLine);
      subscribe();
    }
    for (var j = 0; j < runs.length; j++) {
      runs[j].addEventListener('click', function () {
        var id = this.getAttribute('data-run');
        dLog.textContent = '';
        drawerShow(id, 'starting…');
        subscribe();
        fetch(FIX + '/fix', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: id }) })
          .then(function (r) { return r.json().then(function (b) { return { ok: r.ok, b: b }; }); })
          .then(function (r) { if (!r.ok) { drawerShow(id, 'error'); logLine('✕ ' + (r.b.error || 'dispatch failed')); } })
          .catch(function (e) { drawerShow(id, 'error'); logLine('✕ ' + e); });
      });
    }
  }).catch(function () { /* no dispatcher running — copy-prompt remains the path */ });
})();
</script>
</body>
</html>`

// Build-time self-check: the page's inline script must parse. A stray escape
// sequence in the html template literal (e.g. '\n' instead of '\\n') emits a
// raw newline into a JS string and silently kills ALL page interactivity.
{
  const m = html.match(/<script>([\s\S]*)<\/script>/)
  if (!m) throw new Error('self-check: no <script> block found in built page')
  try { new Function(m[1]) } catch (e) {
    throw new Error('self-check: built page script does not parse — ' + e.message +
      '\nLook for un-doubled escape sequences in the html template literal.')
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, html)
console.log('wrote', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB')
console.log('lib icons live/quarantined:', liveIcons.length, '/', quarIcons.length,
  '| inline icons:', inlineIcons.length, '| pub assets:', pubAssets.length,
  '| issues:', ISSUES.length, hasCuration ? '' : '(RAW INVENTORY MODE — no curation)')
