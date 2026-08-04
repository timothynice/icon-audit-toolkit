#!/usr/bin/env node
// icon-audit fix dispatcher — a tiny localhost server that lets the audit PAGE
// dispatch real fixes: it spawns a headless agent session (default engine: the
// `claude` CLI; use --runner to swap in any agent CLI, e.g. Codex) with an issue's
// fix prompt, streams progress back to the page (SSE), then re-runs the audit
// generator so the reloaded page shows the flipped status and fresh scan counts.
//
// Usage (from the target repo root):
//   node ~/.claude/skills/icon-audit/scripts/fix-server.mjs \
//     --config docs/audits/generator/audit.config.mjs \
//     --curation docs/audits/generator/curation.mjs \
//     --data docs/audits/generator/audit-data.json \
//     --page docs/audits/<date>-icon-audit.html \
//     [--root "$PWD"] [--port 4820]
//     [--claude-args "--permission-mode acceptEdits --max-turns 80"]
//     [--runner "<cmd>"]   # test override: shell cmd run instead of claude; prompt path in $ICON_FIX_PROMPT_FILE
//
// Security model: binds 127.0.0.1 only; one job at a time; POST /fix only accepts
// issue ids that exist in curation and builds the prompt server-side (the page's
// prompt text is never executed). Starting this server is the opt-in: the spawned
// agent edits THIS repo with auto-accepted edits. Stop it with Ctrl-C.
// Auth: headless runs use the Claude CLI login. If jobs fail with 401 authentication_error,
// run `claude` interactively and type /login (there is no `claude login` subcommand).
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const args = {}
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]
for (const req of ['config', 'curation', 'data', 'page']) {
  if (!args[req]) { console.error(`missing --${req}`); process.exit(1) }
}
const ROOT = path.resolve(args.root || process.cwd())
const PORT = Number(args.port || 4820)
const SKILL_SCRIPTS = path.dirname(new URL(import.meta.url).pathname)
const CLAUDE_ARGS = (args['claude-args'] || '--permission-mode acceptEdits').split(/\s+/).filter(Boolean)
const RUNNER = args.runner || null
// Engine label shown on the page's buttons/drawer ("fix with Claude" by default).
const ENGINE = args['engine-label'] || (RUNNER ? 'agent' : 'Claude')

const abs = (p) => path.resolve(ROOT, p)
const rel = (p) => path.relative(ROOT, abs(p))

// ---------- job state ----------
let job = null // { id, startedAt, state: 'running'|'rebuilding'|'done'|'error', log: [], exitCode }
const clients = new Set() // SSE responses
const LOG_KEEP = 400
function emit(ev) {
  if (job && ev.line) { job.log.push(ev.line); if (job.log.length > LOG_KEEP) job.log.shift() }
  const data = 'data: ' + JSON.stringify(ev) + '\n\n'
  for (const res of clients) { try { res.write(data) } catch { clients.delete(res) } }
}

// ---------- prompt construction (server-side, mirrors the page's copy-prompt) ----------
async function buildPrompt(issueId) {
  const CUR = await import(pathToFileURL(abs(args.curation)).href + '?t=' + Date.now())
  const issue = (CUR.ISSUES || []).find((i) => i.id === issueId)
  if (!issue) return null
  const status = issue.status || 'open'
  if (status === 'fixed' || status === 'wontfix') return { error: `issue ${issueId} is already ${status}` }
  const CFG = (await import(pathToFileURL(abs(args.config)).href + '?t=' + Date.now())).default
  const genDir = rel(path.dirname(abs(args.config)))
  const refs = (issue.refs || []).map(([f, l]) => `- ${f}:${l}`).join('\n')
  const verifyLines = (issue.verify || []).map((v) => `- Scan check: /${v.pattern}/${v.include ? ' in paths containing "' + v.include + '"' : ''} must have ≤${v.expect ?? 0} matches.`).join('\n')
  const prompt = `You are working in a checkout of ${CFG.project?.name || 'this repo'} at ${ROOT}. It has an icon audit; the generator inputs live in ${genDir}/ (audit.config.mjs, curation.mjs) and the re-run commands are in ${genDir}/README.md. If the icon-fix skill is installed, follow it for issue ${issue.id}.

Execute icon-audit issue ${issue.id}: ${issue.title}

Problem: ${issue.body}

Fix: ${issue.rec}

Affected sites (your checklist — migrate every one):
${refs || '- (see the audit page)'}

Definition of done:
- Every site above is migrated; no new inline SVGs, image-asset icons, or unicode glyph buttons are introduced.
- The project's build/tests/gates pass.
${verifyLines ? verifyLines + '\n' : ''}- Commit your code fix first — add ONLY the files you touched (never git add -A / .), then a second commit for the tracking update is fine too.
- In ${genDir}/curation.mjs: set this issue's status to 'fixed' with resolvedIn: '<short commit>'; refresh any file:line keys your edits shifted (INLINE_META, GLYPH_UI, issue refs/evidence); delete INLINE_META entries for SVGs you removed.
- Do NOT re-run the audit generator yourself — the dispatcher re-runs it when you finish. Focus on the code migration and the curation bookkeeping.
- Report at the end: sites migrated, files touched, the commit hash, anything skipped and why.`
  return { issue, prompt }
}

// ---------- rebuild (extract + build) ----------
function run(cmd, argv, opts = {}) {
  return new Promise((resolve) => {
    const c = spawn(cmd, argv, { cwd: ROOT, ...opts })
    let out = ''
    c.stdout.on('data', (d) => { out += d })
    c.stderr.on('data', (d) => { out += d })
    c.on('close', (code) => resolve({ code, out }))
    c.on('error', (e) => resolve({ code: -1, out: String(e) }))
  })
}
async function rebuild() {
  emit({ type: 'state', state: 'rebuilding', line: '— re-running the audit generator —' })
  const ex = await run('node', [path.join(SKILL_SCRIPTS, 'extract-icons.mjs'), '--config', abs(args.config), '--root', ROOT, '--out', abs(args.data)])
  emit({ line: ex.out.trim().split('\n').pop() || 'extracted' })
  const bd = await run('node', [path.join(SKILL_SCRIPTS, 'build-audit.mjs'), '--config', abs(args.config), '--data', abs(args.data), '--curation', abs(args.curation), '--root', ROOT, '--out', abs(args.page)])
  emit({ line: bd.out.trim().split('\n').pop() || 'built' })
  return ex.code === 0 && bd.code === 0
}

// ---------- claude stream-json → human lines ----------
function lineFromEvent(j) {
  try {
    if (j.type === 'assistant' && j.message?.content) {
      const parts = []
      for (const c of j.message.content) {
        if (c.type === 'text' && c.text?.trim()) parts.push(c.text.trim().slice(0, 220))
        if (c.type === 'tool_use') parts.push(`▸ ${c.name}${c.input?.file_path ? ' ' + String(c.input.file_path).replace(ROOT + '/', '') : c.input?.command ? ' $ ' + String(c.input.command).slice(0, 120) : ''}`)
      }
      return parts.join('\n')
    }
    if (j.type === 'result') return `■ finished: ${j.subtype || ''} ${j.total_cost_usd ? '($' + j.total_cost_usd.toFixed(2) + ')' : ''}`.trim()
  } catch { /* fall through */ }
  return null
}

async function startJob(issueId) {
  const built = await buildPrompt(issueId)
  if (!built) return { error: `unknown issue id: ${issueId}` }
  if (built.error) return { error: built.error }
  job = { id: issueId, startedAt: Date.now(), state: 'running', log: [], exitCode: null }
  emit({ type: 'state', state: 'running', id: issueId, line: `— dispatching ${issueId}: ${built.issue.title} —` })

  const promptFile = path.join(os.tmpdir(), `icon-fix-${issueId}-${Date.now()}.txt`)
  fs.writeFileSync(promptFile, built.prompt)

  let child
  if (RUNNER) {
    child = spawn(RUNNER, { shell: true, cwd: ROOT, env: { ...process.env, ICON_FIX_PROMPT_FILE: promptFile, ICON_FIX_ISSUE: issueId } })
  } else {
    child = spawn('claude', ['-p', built.prompt, '--output-format', 'stream-json', '--verbose', ...CLAUDE_ARGS], { cwd: ROOT, env: process.env })
  }
  let buf = ''
  child.stdout.on('data', (d) => {
    buf += d
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const raw = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
      if (!raw) continue
      let line = raw
      if (raw.startsWith('{')) { try { line = lineFromEvent(JSON.parse(raw)) } catch { line = raw.slice(0, 220) } }
      if (line) emit({ line })
    }
  })
  child.stderr.on('data', (d) => emit({ line: String(d).trim().slice(0, 300) }))
  child.on('close', async (code) => {
    job.exitCode = code
    emit({ line: `agent exited (${code})` })
    const ok = await rebuild()
    job.state = code === 0 && ok ? 'done' : 'error'
    emit({ type: job.state === 'done' ? 'rebuilt' : 'state', state: job.state, line: job.state === 'done' ? '✓ audit rebuilt — reloading page' : '⚠ finished with errors — check the log; the audit was rebuilt with whatever state exists' })
    if (job.state === 'error') emit({ type: 'rebuilt', state: 'error' })
    try { fs.unlinkSync(promptFile) } catch { /* ok */ }
  })
  child.on('error', (e) => { emit({ line: 'spawn failed: ' + e.message + (RUNNER ? '' : ' — is the claude CLI on PATH?') }) })
  return { ok: true }
}

// ---------- http ----------
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'content-type')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  const url = new URL(req.url, 'http://127.0.0.1')

  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ service: 'icon-audit-fix', engine: ENGINE, root: ROOT, page: rel(args.page), job: job && { id: job.id, state: job.state, startedAt: job.startedAt, log: job.log.slice(-60) } }))
  }
  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
    res.write('\n')
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }
  if (req.method === 'POST' && url.pathname === '/fix') {
    let body = ''
    req.on('data', (d) => { body += d; if (body.length > 10000) req.destroy() })
    req.on('end', async () => {
      let id = null
      try { id = JSON.parse(body).id } catch { /* ignore */ }
      if (!id || !/^[\w-]{1,32}$/.test(id)) { res.writeHead(400); return res.end('{"error":"bad id"}') }
      if (job && (job.state === 'running' || job.state === 'rebuilding')) { res.writeHead(409); return res.end(JSON.stringify({ error: `job ${job.id} is already ${job.state}` })) }
      const r = await startJob(id)
      res.writeHead(r.error ? 400 : 200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(r))
    })
    return
  }
  res.writeHead(404); res.end()
})
server.listen(PORT, '127.0.0.1', () => {
  console.log(`icon-audit fix dispatcher listening on http://127.0.0.1:${PORT}`)
  console.log(`repo: ${ROOT}`)
  console.log(`page: ${abs(args.page)}`)
  console.log(RUNNER ? `runner override: ${RUNNER}` : `runner: claude ${CLAUDE_ARGS.join(' ')}`)
  console.log(`Open the audit page — "fix with ${ENGINE}" buttons appear when it detects this server. Ctrl-C to stop.`)
})
