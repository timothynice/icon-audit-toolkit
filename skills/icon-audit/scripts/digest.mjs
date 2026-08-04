#!/usr/bin/env node
import fs from 'node:fs'
const D = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const dir = process.argv[3]
fs.mkdirSync(dir, { recursive: true })
const short = f => f.replace(/^.*?src\//, '')
const viewsOf = f => (D.fileViews[f] || ['UNREACHED']).join(',')
const hint = u => {
  const a = u.attrs || {}
  const parts = []
  if (a.ariaLabel) parts.push(`aria:"${a.ariaLabel}"`)
  if (a.title) parts.push(`title:"${a.title}"`)
  if (a.tooltip) parts.push(`tip:"${a.tooltip}"`)
  if (a.click) parts.push(`click:${a.click}`)
  if (a.testid) parts.push(`tid:${a.testid}`)
  let enc = ''
  if (u.enclosing) {
    const ea = {}
    for (const [k, re] of Object.entries({ t: /(?:^|\s)title="([^"]+)"/, a: /aria-label="([^"]+)"/, c: /@click(?:\.\w+)*="([^"]+)"/, id: /data-testid="([^"]+)"/ })) {
      const m = u.enclosing.match(re); if (m) ea[k] = m[1].slice(0, 60)
    }
    enc = Object.entries(ea).map(([k, v]) => `${k}:"${v}"`).join(' ')
    if (!enc) enc = u.enclosing.slice(0, 70)
  }
  const tag = (u.tag || '').slice(0, 90)
  return [parts.join(' '), enc && `[enc ${enc}]`, `{${tag}}`].filter(Boolean).join(' ').slice(0, 260)
}

// 1. per-icon digest
{
  const by = {}
  for (const u of D.usages) {
    if (!u.icon || u.unknown) continue
    ;(by[u.icon] ||= []).push(u)
  }
  let out = ''
  for (const [icon, us] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
    out += `\n## ${icon} (${us.length})\n`
    for (const u of us) out += `  - ${short(u.file)}:${u.line} [${u.kind}] (${viewsOf(u.file)}) ${hint(u)}\n`
  }
  fs.writeFileSync(dir + '/digest-icons.txt', out)
}
// 2. glyphs
{
  const by = {}
  for (const u of D.usages) if (u.kind === 'glyph') (by[u.char] ||= []).push(u)
  let out = ''
  for (const [ch, us] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
    out += `\n## "${ch}" (${us.length})\n`
    for (const u of us.slice(0, 40)) out += `  - ${short(u.file)}:${u.line} (${viewsOf(u.file)}) {${(u.tag || '').slice(0, 130)}}\n`
    if (us.length > 40) out += `  ... +${us.length - 40} more\n`
  }
  fs.writeFileSync(dir + '/digest-glyphs.txt', out)
}
// 3. inline svgs
{
  let out = ''
  for (const s of D.inlineSvgs) {
    const vb = (s.svg.match(/viewBox="([^"]+)"/) || [])[1] || '?'
    const d = ((s.svg.match(/ d="([^"]+)"/) || [])[1] || '').slice(0, 40)
    const strokeOrFill = (s.svg.match(/(?:stroke|fill)="[^"]*"/g) || []).slice(0, 3).join(' ')
    out += `- ${short(s.file)}:${s.line} (${viewsOf(s.file)}) vb:${vb} ${strokeOrFill}\n    enc:${(s.enclosing || '').slice(0, 110)}\n    ctx:${(s.ctx || '').slice(0, 150)}\n    d:${d}\n`
  }
  fs.writeFileSync(dir + '/digest-inline.txt', out)
}
// 4. public assets
{
  let out = '--- referenced ---\n'
  const us = D.usages.filter(u => u.kind === 'publicAsset')
  for (const [p, a] of Object.entries(D.publicAssets)) {
    if (!a.referenced) continue
    out += `\n## ${p} fills:[${a.fills.join(',')}]\n`
    for (const u of us.filter(u => u.asset === p)) out += `  - ${short(u.file)}:${u.line} (${viewsOf(u.file)}) ${hint(u)}\n`
  }
  out += '\n--- UNREFERENCED in src ---\n'
  for (const [p, a] of Object.entries(D.publicAssets)) if (!a.referenced) out += `- ${p} fills:[${a.fills.join(',')}]\n`
  fs.writeFileSync(dir + '/digest-public.txt', out)
}
// 5. dup artwork + unknown + libcomp + dynamic
{
  let out = '=== duplicate artwork groups ===\n'
  for (const g of D.duplicateArtwork) out += `- ${g.join('  ||  ')}\n`
  out += '\n=== unknown icon strings ===\n'
  for (const u of D.unknownIconStrings) out += `- ${u.icon} @ ${short(u.file)}:${u.line}\n`
  out += '\n=== lib components with internal icons ===\n'
  for (const lc of D.libComponentIcons) {
    if ((lc.icons.length || lc.inlineSvgCount) === 0) continue
    out += `- ${lc.component} (${lc.subpath}) icons:[${lc.icons.join(',')}] inlineSvg:${lc.inlineSvgCount} file:${lc.file}\n`
  }
  out += '\n=== lib components with NO icon content ===\n'
  out += D.libComponentIcons.filter(lc => !lc.icons.length && !lc.inlineSvgCount).map(lc => lc.component).join(', ') + '\n'
  out += '\n=== dynamic AnyIcon binds ===\n'
  for (const u of D.usages.filter(u => u.kind === 'dynamic')) out += `- ${short(u.file)}:${u.line} (${viewsOf(u.file)}) :icon="${u.dynamicExpr}" ${hint(u)}\n`
  fs.writeFileSync(dir + '/digest-misc.txt', out)
}
// 6. UNREACHED files that contain icon usages
{
  const files = [...new Set(D.usages.filter(u => u.kind !== 'glyph').map(u => u.file))]
  const un = files.filter(f => !D.fileViews[f])
  fs.writeFileSync(dir + '/digest-unreached.txt', un.map(f => `- ${f} (${D.usages.filter(u => u.file === f && u.kind !== 'glyph').length} usages)`).join('\n'))
}
console.log('digests written')
for (const f of fs.readdirSync(dir).filter(f => f.startsWith('digest-'))) {
  console.log(f, fs.statSync(dir + '/' + f).size, 'bytes')
}
