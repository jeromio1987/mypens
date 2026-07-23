// Shared HTML report chrome for engine outputs (stress / garmin / period).

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function reportCss() {
  return `
:root {
  --bg: #0c1222;
  --panel: #141c2e;
  --panel2: #1a2438;
  --text: #eef3ff;
  --muted: #9aa8c7;
  --line: #2a3650;
  --ok: #34d399;
  --warn: #fbbf24;
  --bad: #f87171;
  --accent: #7dd3fc;
  --good-bg: #064e3b;
  --mixed-bg: #78350f;
  --bad-bg: #7f1d1d;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  color: var(--text);
  font: 16px/1.55 "Segoe UI", system-ui, sans-serif;
  background:
    radial-gradient(900px 420px at 10% -10%, #1e3a5f55, transparent),
    radial-gradient(700px 360px at 90% 0%, #14532d33, transparent),
    var(--bg);
}
main { max-width: 980px; margin: 0 auto; padding: 28px 18px 72px; }
h1 { font-size: clamp(1.6rem, 3vw, 2rem); margin: 0 0 6px; letter-spacing: -0.03em; }
h2 { font-size: 1.15rem; margin: 32px 0 12px; }
h3 { font-size: 0.95rem; margin: 0 0 10px; color: var(--accent); font-weight: 650; }
.sub { color: var(--muted); margin: 0 0 18px; }
.hero {
  background: linear-gradient(145deg, var(--panel), var(--panel2));
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 20px 22px;
}
.kicker { font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.score { font-size: 1.45rem; font-weight: 750; }
.score.pass { color: var(--ok); }
.score.fail { color: var(--bad); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.chip {
  border: 1px solid var(--line);
  background: #0f172a;
  color: var(--text);
  border-radius: 999px;
  padding: 5px 11px;
  font-size: 0.82rem;
}
.chip strong { color: var(--accent); font-weight: 650; }
.grid { display: grid; gap: 12px; }
.grid.metrics { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
.grid.two { grid-template-columns: 1fr; }
@media (min-width: 820px) { .grid.two { grid-template-columns: 1fr 1fr; } }
.metric, .card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 15px;
}
.metric .label { color: var(--muted); font-size: 0.78rem; margin-bottom: 4px; }
.metric .value { font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; }
.metric .hint { color: var(--muted); font-size: 0.78rem; margin-top: 2px; }
.list { margin: 0; padding: 0; list-style: none; }
.list li {
  position: relative;
  padding: 10px 10px 10px 14px;
  border-bottom: 1px solid var(--line);
  margin: 0;
}
.list li:last-child { border-bottom: 0; }
.list.wins li { border-left: 3px solid var(--ok); }
.list.risks li { border-left: 3px solid var(--warn); }
.list.findings li { border-left: 3px solid var(--accent); }
.verdict {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 650;
  background: #1e293b;
  text-transform: lowercase;
}
.verdict.good { background: var(--good-bg); color: #a7f3d0; }
.verdict.mixed { background: var(--mixed-bg); color: #fde68a; }
.verdict.bad { background: var(--bad-bg); color: #fecaca; }
.callout {
  border-radius: 16px;
  border: 1px solid #7f1d1d88;
  background: linear-gradient(135deg, #3f1d1d, #1a1220);
  padding: 16px 18px;
}
.callout .title { font-weight: 750; font-size: 1.05rem; margin-bottom: 6px; }
.prose { white-space: pre-wrap; color: #dbe4f5; }
.horizon {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 10px;
}
.horizon-top { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
.horizon .meta { color: var(--muted); font-size: 0.86rem; }
details {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 10px 14px;
  margin-top: 10px;
}
summary { cursor: pointer; color: var(--muted); font-weight: 600; }
details[open] summary { margin-bottom: 8px; color: var(--text); }
.check-row { display: flex; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 0.92rem; }
.check-row:last-child { border-bottom: 0; }
.badge-ok { color: var(--ok); font-weight: 700; min-width: 3.2rem; }
.badge-bad { color: var(--bad); font-weight: 700; min-width: 3.2rem; }
code { font-family: ui-monospace, Consolas, monospace; font-size: 0.84em; color: #cbd5e1; }
.note { color: var(--muted); font-size: 0.86rem; margin-top: 8px; }
`
}

export function metricTile(label, value, hint = '') {
  return `<div class="metric"><div class="label">${esc(label)}</div><div class="value">${esc(value)}</div>${
    hint ? `<div class="hint">${esc(hint)}</div>` : ''
  }</div>`
}

export function bulletList(items, cls = '') {
  if (!items?.length) return `<p class="note">Nothing in this section.</p>`
  return `<ul class="list ${cls}">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
}

export function friendlySource(id) {
  const map = {
    garmin_sleep: 'Garmin sleep',
    garmin_activity: 'Garmin activities',
    garmin_wellness: 'Garmin wellness',
    strava_training: 'Strava training',
    tanita_weight: 'Tanita body comp',
    anchor_recovery: 'Anchor recovery',
  }
  return map[id] || id
}

export function friendlyCausal(id) {
  if (!id) return '—'
  const map = {
    alcohol_binge_stack: 'Heavy / binge drinking',
    idle_underload: 'Idle under-load',
    idle_low_rhr: 'Idle under-load',
    rhr_heavy_stack: 'High RHR heavy stack',
    rhr_likely_drinking: 'Elevated RHR — likely drinking',
    sleep_debt: 'Sleep debt',
    stress_stack: 'Stress stack',
  }
  return map[id] || String(id).replace(/_/g, ' ')
}

export function inventoryTiles(inv = {}) {
  const span =
    inv.dateSpan?.from && inv.dateSpan?.to
      ? `${inv.dateSpan.from} → ${inv.dateSpan.to}`
      : '—'
  return [
    metricTile('Sleep nights', inv.sleepNights ?? 0),
    metricTile('Garmin sessions', inv.garminActivities ?? 0),
    metricTile('Training rows', inv.trainingEntries ?? 0, 'Strava / manual ledger'),
    metricTile('Weigh-ins', inv.weightEntries ?? 0, 'Tanita / scale'),
    metricTile('Wellness points', inv.wellnessPoints ?? 0, (inv.wellnessKinds || []).join(' · ') || '—'),
    metricTile('Date span', span),
  ].join('')
}

export function domainTiles(domains = {}) {
  const tiles = []
  if (domains.sleep) {
    tiles.push(
      metricTile(
        'Sleep avg',
        `${domains.sleep.avgHours ?? '—'} h`,
        `trend ${domains.sleep.trend || '—'} · ${domains.sleep.shortNights ?? 0} short nights`,
      ),
    )
  }
  if (domains.stress) {
    tiles.push(
      metricTile('Stress avg', domains.stress.avg ?? '—', `${domains.stress.highDays ?? 0} high days · ${domains.stress.trend || '—'}`),
    )
  }
  if (domains.hrv) {
    tiles.push(metricTile('HRV avg', `${domains.hrv.avg ?? '—'} ms`, `trend ${domains.hrv.trend || '—'}`))
  }
  if (domains.restingHr) {
    tiles.push(
      metricTile('Resting HR', `${domains.restingHr.avg ?? '—'} bpm`, `trend ${domains.restingHr.trend || '—'}`),
    )
  }
  if (domains.activities) {
    tiles.push(
      metricTile(
        'Garmin load',
        `${domains.activities.count} sessions`,
        `${domains.activities.totalHours} h · ${domains.activities.totalKm} km`,
      ),
    )
  }
  if (domains.training) {
    tiles.push(
      metricTile(
        'Strava / ledger',
        `${domains.training.stravaSessions ?? 0} Strava`,
        `${domains.training.sessions} total · vol ~${domains.training.totalVolume}`,
      ),
    )
  }
  if (domains.weight) {
    tiles.push(
      metricTile(
        'Weight / BF%',
        domains.weight.latestBodyFatPct != null
          ? `${domains.weight.latestKg ?? '—'} kg · ${domains.weight.latestBodyFatPct}%`
          : `${domains.weight.latestKg ?? '—'} kg`,
        `BF trend ${domains.weight.bodyFatTrend || '—'}`,
      ),
    )
  }
  return tiles.join('') || metricTile('Domains', 'No domain data')
}
