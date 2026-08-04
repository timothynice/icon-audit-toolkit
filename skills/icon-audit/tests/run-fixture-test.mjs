#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(testsDir, '../../..')
const fixtureRoot = path.join(testsDir, 'fixture-app')
const scriptsDir = path.join(repoRoot, 'skills/icon-audit/scripts')
const config = path.join(testsDir, 'fixture-audit.config.mjs')
const curation = path.join(repoRoot, 'skills/icon-audit/templates/curation.template.mjs')
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-audit-fixture-'))

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join('\n'))
  }
  return result.stdout.trim()
}

try {
  const dataPath = path.join(tempDir, 'audit-data.json')
  const digestDir = path.join(tempDir, 'digests')
  const pagePath = path.join(tempDir, 'icon-audit.html')

  run(path.join(scriptsDir, 'extract-icons.mjs'), [
    '--config', config,
    '--root', fixtureRoot,
    '--out', dataPath,
  ])

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
  assert.equal(data.counts.registrySize, 6, 'registry icon count')
  assert.equal(data.inlineSvgs.length, 8, 'inline SVG count')
  assert.equal(Object.keys(data.publicAssets).length, 3, 'public asset count')
  assert.deepEqual(data.unknownIconStrings, [
    { icon: 'IconGhost', file: 'src/components/FileRow.vue', line: 9 },
  ])

  const usageNames = data.usages.map((usage) => usage.icon).filter(Boolean)
  assert.equal(usageNames.includes('IconExample'), false, 'doc-comment example is ignored')
  assert.equal(usageNames.includes('IconKind'), false, 'TypeScript generic is ignored')

  run(path.join(scriptsDir, 'digest.mjs'), [dataPath, digestDir])
  for (const name of ['digest-icons.txt', 'digest-inline.txt', 'digest-public.txt']) {
    assert.equal(fs.existsSync(path.join(digestDir, name)), true, `${name} was generated`)
  }

  run(path.join(scriptsDir, 'build-audit.mjs'), [
    '--config', config,
    '--data', dataPath,
    '--curation', curation,
    '--root', fixtureRoot,
    '--out', pagePath,
  ])
  assert.ok(fs.statSync(pagePath).size > 50_000, 'standalone audit page was generated')

  console.log('fixture regression passed: 6 registry icons, 8 inline SVGs, 3 assets, 1 expected unknown')
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}
