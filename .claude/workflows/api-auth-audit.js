export const meta = {
  name: 'api-auth-audit',
  description:
    'Audit myPENS app/api routes for auth/session gaps; independent verifier per finding',
  phases: [
    { title: 'Discover', detail: 'List route handlers under app/api' },
    { title: 'Audit', detail: 'One agent per file checks frozen auth rules' },
    { title: 'Verify', detail: 'Fresh-context verifier confirms each finding' },
    { title: 'Synthesize', detail: 'One ranked report' },
  ],
}

/**
 * Optional args:
 *   /api-auth-audit with maxFiles 20 under app/api/integrations
 *   args.maxFiles -- default 20
 *   args.under    -- subdirectory (default app/api)
 */
const maxFiles =
  typeof args !== 'undefined' && args && Number(args.maxFiles) > 0
    ? Math.min(80, Math.floor(Number(args.maxFiles)))
    : 20
const under =
  typeof args !== 'undefined' && args && typeof args.under === 'string' && args.under.trim()
    ? args.under.trim().replace(/^\/+/, '').replace(/\\/g, '/')
    : 'app/api'

const RULES = `
myPENS frozen rules for API route auth (read-only -- do not edit files, do not invent secrets):

Flag when the file:
1. Exports a route handler (GET/POST/PUT/PATCH/DELETE) with no session/auth check and mutates data or returns PII
2. Trusts client-supplied user id / org id without verifying against the session
3. Exposes service-role or secret keys to the client, or logs tokens
4. Skips CSRF / origin checks on cookie-authenticated state-changing POST where the app normally requires them
5. Has TODO/FIXME auth bypass left in production path

Do NOT flag:
- Explicitly public webhooks with verified signatures
- Read-only health/version endpoints that return no user data
- Routes that correctly call getServerSession / Supabase auth helpers before DB access
`

phase('Discover')
const discovered = await agent(
  `List TypeScript/JavaScript route files under ${under}/ (recursive). ` +
    `Prefer route.ts / route.js handlers. Cap at ${maxFiles}. Do not read contents yet.`,
  {
    label: 'discover-api',
    phase: 'Discover',
    schema: {
      type: 'object',
      required: ['files'],
      properties: {
        files: { type: 'array', items: { type: 'string' } },
        truncated: { type: 'boolean' },
      },
    },
  },
)

const files = (discovered.files || []).slice(0, maxFiles)
log(`Auditing ${files.length} API files under ${under}`)

phase('Audit')
const audits = await pipeline(files, (file) =>
  agent(
    `Read ${file}.\n${RULES}\n` +
      `Return findings only for real rule breaks. Empty findings if clean.`,
    {
      label: `audit:${file}`,
      phase: 'Audit',
      schema: {
        type: 'object',
        required: ['file', 'findings'],
        properties: {
          file: { type: 'string' },
          findings: {
            type: 'array',
            items: {
              type: 'object',
              required: ['rule', 'severity', 'reason', 'evidence'],
              properties: {
                rule: { type: 'string' },
                severity: { type: 'string', enum: ['high', 'medium', 'low'] },
                reason: { type: 'string' },
                evidence: { type: 'string' },
              },
            },
          },
        },
      },
    },
  ),
)

const candidates = (audits || [])
  .filter(Boolean)
  .flatMap((a) =>
    (a.findings || []).map((f) => ({
      file: a.file,
      rule: f.rule,
      severity: f.severity,
      reason: f.reason,
      evidence: f.evidence,
    })),
  )

log(`Audit produced ${candidates.length} candidate findings`)

phase('Verify')
const verified = await pipeline(candidates, (finding) =>
  agent(
    `Independent verifier -- no prior audit context.\n` +
      `Re-read ${finding.file}. Claim:\n${JSON.stringify(finding, null, 2)}\n\n${RULES}\n` +
      `Confirm only on clear evidence. Reject vibes.`,
    {
      label: `verify:${finding.file}:${finding.rule}`,
      phase: 'Verify',
      schema: {
        type: 'object',
        required: ['confirmed', 'file', 'rule', 'severity', 'rationale'],
        properties: {
          confirmed: { type: 'boolean' },
          file: { type: 'string' },
          rule: { type: 'string' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          rationale: { type: 'string' },
        },
      },
    },
  ),
)

const confirmed = (verified || []).filter(Boolean).filter((v) => v.confirmed === true)
log(`${confirmed.length} findings confirmed`)

phase('Synthesize')
const report = await agent(
  `Write a short myPENS API auth audit report.\n` +
    `Scope: ${files.length} files under ${under}.\n` +
    `Confirmed:\n${JSON.stringify(confirmed, null, 2)}\n` +
    `Only confirmed items. Group by severity.`,
  { label: 'synthesize-report', phase: 'Synthesize' },
)

return {
  scope: { under, maxFiles, filesAudited: files.length },
  candidates: candidates.length,
  confirmedCount: confirmed.length,
  confirmed,
  report,
}
