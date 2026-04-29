#!/usr/bin/env node
// Generates project_context.txt — a single concatenated text bundle of every
// source file in this project, for uploading to ChatGPT (or any LLM) so it
// can "see" the whole codebase in one shot.
//
// Usage:  node scripts/bundle-context.mjs
// Output: project_context.txt at repo root.
//
// Skips: dependencies, build output, binaries, secrets, data files.

import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'project_context.txt')

// Directories to skip entirely (matched against any path segment).
const SKIP_DIRS = new Set([
  'node_modules', '.next', '.git', '.local', '.cache', '.config', '.upm',
  '.canvas', '.agents', '.vscode', '.idea',
  'public/uploads', 'attached_assets', 'garmin_activities',
  'mobile-companions', 'my-pens-mobile-test',
  'prisma/backups',
])

// File names to skip explicitly.
const SKIP_FILES = new Set([
  'package-lock.json', 'tsconfig.tsbuildinfo', '.env', '.env.local',
  'project_context.txt', 'dev.db', 'dev.db-journal',
])

// Allowlist by extension (text-only).
const ALLOW_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.css', '.scss', '.html',
  '.json', '.prisma',
  '.md', '.txt', '.toml', '.yaml', '.yml',
])

// Files without an extension that we still want to include.
const ALLOW_NAMED = new Set([
  '.gitignore', '.replit', '.env.example', 'Dockerfile', 'Procfile',
  'README', 'LICENSE',
])

function shouldSkipDir(rel) {
  // Match either exact dir name or a path prefix like "public/uploads".
  if (SKIP_DIRS.has(rel)) return true
  for (const skip of SKIP_DIRS) {
    if (rel === skip || rel.endsWith('/' + skip) || rel.startsWith(skip + '/')) return true
  }
  // Also skip on bare basename (e.g. nested node_modules).
  const base = path.basename(rel)
  if (SKIP_DIRS.has(base)) return true
  return false
}

function shouldIncludeFile(name) {
  if (SKIP_FILES.has(name)) return false
  if (ALLOW_NAMED.has(name)) return true
  const ext = path.extname(name).toLowerCase()
  return ALLOW_EXT.has(ext)
}

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(ROOT, full)
    if (entry.isDirectory()) {
      if (shouldSkipDir(rel)) continue
      yield* walk(full)
    } else if (entry.isFile()) {
      if (!shouldIncludeFile(entry.name)) continue
      yield rel
    }
  }
}

const MAX_FILE_BYTES = 256 * 1024 // 256 KB per file cap

async function main() {
  const files = []
  for await (const rel of walk(ROOT)) files.push(rel)
  files.sort()

  const parts = []
  parts.push('# MY PENS — Project Context Bundle')
  parts.push(`# Generated: ${new Date().toISOString()}`)
  parts.push(`# Files: ${files.length}`)
  parts.push('# Each file below is delimited by:  === path/from/repo/root ===')
  parts.push('')

  let totalBytes = 0
  let truncated = 0
  for (const rel of files) {
    const full = path.join(ROOT, rel)
    const s = await stat(full)
    let body
    if (s.size > MAX_FILE_BYTES) {
      const buf = await readFile(full, 'utf8').catch(() => '')
      body = buf.slice(0, MAX_FILE_BYTES) + `\n\n... [truncated; original size ${s.size} bytes] ...\n`
      truncated++
    } else {
      body = await readFile(full, 'utf8').catch(() => '[unreadable]')
    }
    parts.push(`=== ${rel} ===`)
    parts.push(body)
    parts.push('')
    totalBytes += body.length
  }

  await writeFile(OUT, parts.join('\n'), 'utf8')
  console.log(`Wrote ${OUT}`)
  console.log(`  ${files.length} files, ~${(totalBytes / 1024).toFixed(1)} KB`)
  if (truncated > 0) console.log(`  ${truncated} file(s) truncated at ${MAX_FILE_BYTES} bytes`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
