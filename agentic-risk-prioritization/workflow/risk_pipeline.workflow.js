export const meta = {
  name: 'risk-prioritization-pipeline',
  description: 'Agentic risk pipeline: validate 5-risk register, 3-lens FAIR-lite scoring panel, adversarial challenge of top rank, per-risk mitigation + feasibility review, quantitative breach-likelihood model with red-team pass',
  whenToUse: 'Quarterly risk re-assessment for the fixed SaaS scenario; pass an updated register via args.risks',
  phases: [
    { title: 'Register', detail: 'validate & tighten the 5-risk register' },
    { title: 'Score', detail: '3 independent scoring lenses x 5 risks, factor-level audit trail' },
    { title: 'Challenge', detail: 'adversarial refutation attempts on the #1 ranking' },
    { title: 'Mitigate', detail: 'per-risk mitigation package + IT feasibility review' },
    { title: 'Quantify', detail: 'baseline & effectiveness estimation, red-team, revision' },
    { title: 'Synthesize', detail: 'executive summary from code-computed numbers only' },
  ],
}

// ---------------------------------------------------------------------------
// Shared context blocks (embedded verbatim in every relevant agent prompt)
// ---------------------------------------------------------------------------
const COMPANY = `
FIXED SCENARIO + STATED ASSUMPTIONS ("Meridian Desk", fictional):
- 200-employee B2B SaaS, ~$20M ARR, one multi-tenant product storing business records + PII of ~500,000 end users across ~1,200 customer orgs.
- Cloud: single Azure production subscription — App Service, Azure Database for PostgreSQL Flexible Server, Blob Storage (incl. backups). Code on GitHub, CI/CD via GitHub Actions.
- Identity: M365 E3 + Entra ID. MFA = Microsoft Authenticator push (phishable). No Conditional Access device-compliance or authentication-strength policies. ~15 downstream SaaS apps behind Entra SSO.
- Endpoints: remote-first workforce. Intune licensed but only ~60% of laptops enrolled; users are commonly local admins; Microsoft Defender AV on defaults; no EDR monitoring; no SIEM.
- People/process: IT team of 3 (IT Manager + 2 sysadmins), no dedicated security engineer; ~60 engineers. Offboarding is manual/ticket-driven. Contractors hold direct PostgreSQL accounts. Historical .env files/connection strings exist in private repos. Long-lived service-principal secrets with Contributor rights in GitHub Actions. No WAF. SOC 2 Type II program in progress (Type I audit targeted in ~6 months).
`.trim()

const SCALES = `
ORDINAL SCALES (FAIR-lite; use these EXACTLY):
- TEF (Threat Event Frequency: how often attempts/threat events occur against THIS company): 1 = <0.1/yr, 2 = 0.1-1/yr, 3 = 1-10/yr, 4 = 10-100/yr, 5 = >100/yr (near-continuous).
- VULN (Susceptibility: probability an attempt becomes a material incident given CURRENT controls): 1 = <5%, 2 = 5-20%, 3 = 20-45%, 4 = 45-70%, 5 = >70%.
- PRIMARY IMPACT (direct loss: incident response, downtime, recovery, ransom): 1 = <$25k, 2 = $25-100k, 3 = $100-500k, 4 = $500k-2M, 5 = >$2M.
- SECONDARY IMPACT (breach notification, fines, churn, lost deals, SOC 2 setback, reputation): same dollar bands.
Composite (computed downstream by deterministic code, NOT by you): Likelihood L = (TEF+VULN)/2; Impact I = 0.6*PRIMARY + 0.4*SECONDARY; Priority = L x I (range 1-25).
`.trim()

const SEED_RISKS = [
  {
    id: 'R1',
    title: 'AiTM credential phishing -> M365/Entra account takeover',
    threat_source: 'External financially motivated phishing crews operating adversary-in-the-middle (AiTM) kits (Evilginx-class, Storm-1167-style) that proxy the real Entra login page and capture session cookies, defeating push-based MFA.',
    asset: 'Employee Entra ID identities and everything behind them: Exchange Online mailboxes, SharePoint/OneDrive tenant data, and ~15 downstream SSO SaaS apps including admin portals.',
    exposure: '200 remote employees sign in from unmanaged networks; MFA is phishable Authenticator push; no Conditional Access device-compliance or phishing-resistant authentication-strength policy; 2 admins cannot triage sign-in anomalies at scale.',
    scenario: 'An employee enters credentials and approves a push on a proxied login page; the attacker replays the stolen session cookie, sets inbox rules, pivots to vendor-payment fraud and bulk-downloads customer data from SharePoint.',
  },
  {
    id: 'R2',
    title: 'Public web app exploitation (SQLi/IDOR/CVE) -> PostgreSQL customer-data exfiltration',
    threat_source: 'External opportunistic mass scanners and targeted attackers exploiting OWASP-class flaws (SQL injection, IDOR, SSRF) or unpatched framework/library CVEs in the public-facing app.',
    asset: 'Multi-tenant customer business records and PII of ~500k end users in Azure Database for PostgreSQL; the app-layer trust boundary between tenants.',
    exposure: 'Internet-facing app with no WAF; the app connects with a single high-privilege DB role; no mandatory security code review or DAST gate; small team means framework patch latency of weeks.',
    scenario: 'A scanner finds an injectable endpoint or a known CVE; the attacker dumps tenant tables via the over-privileged app DB role and posts a sample for extortion; breach notification is owed to 1,200 customer orgs.',
  },
  {
    id: 'R3',
    title: 'Leaked CI/CD & cloud secrets -> Azure production subscription compromise',
    threat_source: 'External attackers harvesting secrets from leaked repos, infostealer-compromised developer laptops, or malicious/compromised GitHub Actions dependencies.',
    asset: 'Production Azure subscription: App Service, PostgreSQL admin credentials, Blob Storage with backups; the CI/CD pipeline that deploys to production.',
    exposure: 'Historical .env files and connection strings committed to repos; long-lived service-principal secrets with Contributor rights in GitHub Actions; no secret scanning or rotation; ~60 engineers with broad repo access; Key Vault used inconsistently.',
    scenario: 'An infostealer on a dev laptop lifts a GitHub PAT and .env; the attacker authenticates as the CI service principal, reads the Postgres admin connection string, exfiltrates the database and plants persistence in the subscription.',
  },
  {
    id: 'R4',
    title: 'Ransomware/extortion via unmanaged remote endpoints',
    threat_source: 'Ransomware affiliates and initial-access brokers delivering infostealers/loaders via malvertising, trojanized installers, and consumer-grade phishing on remote laptops.',
    asset: 'Employee laptops, cached corporate credentials/tokens, synced OneDrive/SharePoint corpora; business operations continuity (support, billing, engineering).',
    exposure: '~40% of laptops not enrolled in Intune; users routinely local admins; Defender AV on defaults with no EDR/alert monitoring or SIEM; remote workforce mixes personal browsing with work devices.',
    scenario: 'A trojanized installer on an unenrolled laptop escalates via local admin, steals Entra tokens, encrypts synced SharePoint libraries through the OneDrive client, and demands ransom; a 3-person IT team faces multi-day recovery.',
  },
  {
    id: 'R5',
    title: 'Offboarding gaps: dormant employee/contractor access to production data',
    threat_source: 'Internal: departed or departing employees and contractors retaining valid access (malicious or negligent); external attackers reusing dormant accounts and shared service-account passwords.',
    asset: 'Production PostgreSQL (direct contractor accounts), GitHub source code and infrastructure-as-code, customer data in M365; audit integrity of the SOC 2 program.',
    exposure: 'Offboarding is manual and ticket-driven across ~15 SaaS apps plus Azure and Postgres; contractors hold direct DB accounts; shared service accounts have non-rotated passwords; no periodic access recertification.',
    scenario: 'A contractor whose engagement ended keeps a working Postgres login for months; after a payment dispute they export customer tables — or an attacker credential-stuffs the dormant account — with no alerting either way.',
  },
]

// ---------------------------------------------------------------------------
// Schemas (force structured, auditable output from every agent)
// ---------------------------------------------------------------------------
const REGISTER_SCHEMA = {
  type: 'object',
  required: ['risks', 'validation_notes', 'coverage_gaps'],
  properties: {
    risks: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object',
        required: ['id', 'title', 'threat_source', 'asset', 'exposure', 'scenario'],
        properties: {
          id: { type: 'string' }, title: { type: 'string' },
          threat_source: { type: 'string' }, asset: { type: 'string' },
          exposure: { type: 'string' }, scenario: { type: 'string' },
        },
      },
    },
    validation_notes: { type: 'array', items: { type: 'string' } },
    coverage_gaps: { type: 'array', maxItems: 3, items: { type: 'string' } },
  },
}

const SCORE_SCHEMA = {
  type: 'object',
  required: ['risks'],
  properties: {
    risks: {
      type: 'array', minItems: 5, maxItems: 5,
      items: {
        type: 'object',
        required: ['risk_id', 'tef', 'tef_reason', 'vuln', 'vuln_reason', 'primary_impact', 'primary_impact_reason', 'secondary_impact', 'secondary_impact_reason'],
        properties: {
          risk_id: { type: 'string' },
          tef: { type: 'integer', minimum: 1, maximum: 5 }, tef_reason: { type: 'string' },
          vuln: { type: 'integer', minimum: 1, maximum: 5 }, vuln_reason: { type: 'string' },
          primary_impact: { type: 'integer', minimum: 1, maximum: 5 }, primary_impact_reason: { type: 'string' },
          secondary_impact: { type: 'integer', minimum: 1, maximum: 5 }, secondary_impact_reason: { type: 'string' },
        },
      },
    },
  },
}

const CHALLENGE_SCHEMA = {
  type: 'object',
  required: ['verdict', 'argument', 'alternative_top_risk_id', 'key_evidence', 'confidence'],
  properties: {
    verdict: { type: 'string', enum: ['upheld', 'refuted'] },
    argument: { type: 'string' },
    alternative_top_risk_id: { type: 'string', description: 'empty string if verdict is upheld' },
    key_evidence: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
}

const MITIGATION_SCHEMA = {
  type: 'object',
  required: ['risk_id', 'strategy_summary', 'primary_control', 'controls', 'owner', 'effort', 'quick_wins', 'soc2_criteria', 'residual_gaps', 'human_review_notes'],
  properties: {
    risk_id: { type: 'string' },
    strategy_summary: { type: 'string' },
    primary_control: { type: 'string', description: 'the single named control that does most of the work' },
    controls: {
      type: 'array', minItems: 1, maxItems: 5,
      items: {
        type: 'object',
        required: ['name', 'type', 'description', 'azure_m365_feature'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['preventive', 'detective', 'corrective', 'administrative'] },
          description: { type: 'string' },
          azure_m365_feature: { type: 'string', description: 'the concrete Azure/M365/GitHub feature or product that implements it; "third-party" + name if none' },
        },
      },
    },
    owner: { type: 'string', description: 'specific role at a 200-person company' },
    effort: {
      type: 'object',
      required: ['tshirt', 'person_weeks', 'cost_estimate_usd'],
      properties: {
        tshirt: { type: 'string', enum: ['S', 'M', 'L'] },
        person_weeks: { type: 'number' },
        cost_estimate_usd: { type: 'string', description: 'rough annual range incl. licensing, e.g. "$5k-15k/yr"' },
      },
    },
    quick_wins: { type: 'array', items: { type: 'string' }, description: 'things doable in <1 week each' },
    soc2_criteria: { type: 'array', items: { type: 'string' }, description: 'SOC 2 Trust Services Criteria this satisfies, e.g. CC6.1' },
    residual_gaps: { type: 'array', items: { type: 'string' } },
    human_review_notes: { type: 'string' },
  },
}

const FEASIBILITY_SCHEMA = {
  type: 'object',
  required: ['risk_id', 'verdict', 'concerns', 'required_changes', 'adjusted_effort', 'sequencing_note'],
  properties: {
    risk_id: { type: 'string' },
    verdict: { type: 'string', enum: ['approve', 'approve_with_changes', 'rework'] },
    concerns: { type: 'array', items: { type: 'string' } },
    required_changes: { type: 'array', items: { type: 'string' } },
    adjusted_effort: {
      type: 'object',
      required: ['tshirt', 'person_weeks', 'cost_estimate_usd'],
      properties: {
        tshirt: { type: 'string', enum: ['S', 'M', 'L'] },
        person_weeks: { type: 'number' },
        cost_estimate_usd: { type: 'string' },
      },
    },
    sequencing_note: { type: 'string', description: 'where this lands relative to the other four mitigations and SOC 2 work' },
  },
}

const QUANT_SCHEMA = {
  type: 'object',
  required: ['risk_id', 'baseline', 'effectiveness', 'key_assumptions', 'confidence', 'human_review_required', 'human_review_reason'],
  properties: {
    risk_id: { type: 'string' },
    baseline: {
      type: 'object',
      required: ['low_pct', 'mode_pct', 'high_pct', 'basis'],
      properties: {
        low_pct: { type: 'number', minimum: 0, maximum: 100 },
        mode_pct: { type: 'number', minimum: 0, maximum: 100 },
        high_pct: { type: 'number', minimum: 0, maximum: 100 },
        basis: { type: 'string' },
      },
    },
    effectiveness: {
      type: 'object',
      required: ['low_pct', 'mode_pct', 'high_pct', 'basis'],
      properties: {
        low_pct: { type: 'number', minimum: 0, maximum: 100 },
        mode_pct: { type: 'number', minimum: 0, maximum: 100 },
        high_pct: { type: 'number', minimum: 0, maximum: 100 },
        basis: { type: 'string' },
      },
    },
    key_assumptions: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    human_review_required: { type: 'boolean' },
    human_review_reason: { type: 'string' },
  },
}

const REVISED_QUANT_SCHEMA = {
  type: 'object',
  required: ['risk_id', 'baseline', 'effectiveness', 'key_assumptions', 'confidence', 'human_review_required', 'human_review_reason', 'change_log'],
  properties: Object.assign({}, QUANT_SCHEMA.properties, {
    change_log: { type: 'array', items: { type: 'string' } },
  }),
}

const REDTEAM_SCHEMA = {
  type: 'object',
  required: ['issues', 'correlation_concerns', 'overall_assessment'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['risk_id', 'target', 'problem', 'suggested_correction'],
        properties: {
          risk_id: { type: 'string' },
          target: { type: 'string', enum: ['baseline', 'effectiveness', 'assumptions'] },
          problem: { type: 'string' },
          suggested_correction: { type: 'string' },
        },
      },
    },
    correlation_concerns: { type: 'array', items: { type: 'string' }, description: 'where the independence assumption between the 5 risks is most wrong' },
    overall_assessment: { type: 'string' },
  },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function median(nums) {
  const a = nums.slice().sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}
function round(x, d) { const f = Math.pow(10, d); return Math.round(x * f) / f }

// retry wrapper: schema-forced agents rarely fail, but a lost item breaks the deliverable
async function ask(prompt, opts) {
  const r = await agent(prompt, opts)
  if (r !== null && r !== undefined) return r
  return agent(prompt + '\n\n(Retry: the previous attempt returned nothing. Follow the schema exactly.)', opts)
}

// ---------------------------------------------------------------------------
// Phase 1 — Register: validate & tighten the 5 seeded risks
// ---------------------------------------------------------------------------
phase('Register')
const seed = (args && args.risks) ? args.risks : SEED_RISKS

const validated = await ask(`You are the Risk Register Validator agent in an automated risk-prioritization pipeline for a security assessment.

${COMPANY}

Below are 5 draft risk-register entries. Your job:
1. Verify each is SPECIFIC: a named threat source, a concrete asset at stake, and a concrete exposure. Vague entries like bare "phishing" are unacceptable — tighten them.
2. Verify the 5 are mutually DISTINCT (no two are the same scenario reworded). If two overlap, sharpen the boundary between them rather than replacing either.
3. Tighten wording: keep each field crisp and factual, under ~60 words. Do NOT invent company facts beyond the profile above; if you must assume something new, record it in validation_notes instead of silently embedding it.
4. Keep ids and the overall subject of each risk stable.
Also list up to 3 coverage_gaps: material risks for this company profile NOT captured by these 5 (one line each). These go on a human watchlist; do not replace any of the 5.

DRAFT REGISTER:
${JSON.stringify(seed, null, 2)}`, { label: 'register:validate', phase: 'Register', schema: REGISTER_SCHEMA, effort: 'medium' })

const register = validated.risks
const byId = {}
for (const r of register) byId[r.id] = r
log(`Register validated: ${register.map(r => r.id).join(', ')}; ${validated.coverage_gaps.length} coverage gaps noted for the human watchlist`)

// ---------------------------------------------------------------------------
// Phase 2 — Score: 3 independent lenses, factor-level audit trail, code aggregation
// ---------------------------------------------------------------------------
phase('Score')
const LENSES = [
  {
    key: 'threat-intel',
    persona: 'an offensive-security / threat-intelligence analyst. Judge attacker economics: how prevalent is each technique in current real-world incident data, how cheap and automatable is it against this exact stack, and how attractive is this target profile (200-person SaaS, weak identity controls, no EDR/WAF/SIEM).',
  },
  {
    key: 'business-impact',
    persona: 'a business-risk analyst reporting to the CFO. Judge loss magnitude: incident-response and recovery cost, downtime and SLA penalties, breach-notification duty to ~1,200 customer orgs / ~500k end users, customer churn and stalled enterprise deals, and damage to the in-flight SOC 2 program.',
  },
  {
    key: 'control-environment',
    persona: 'a security auditor. Judge susceptibility from the control environment: which compensating controls exist or are absent for each risk, expected detection latency (no SIEM, no EDR, 2 sysadmins), and blast radius given current configurations (single subscription, over-privileged roles, phishable MFA).',
  },
]

function scorerPrompt(lens) {
  return `You are one of three INDEPENDENT risk-scoring agents in an automated prioritization pipeline. You cannot see the other scorers. Your lens: you are ${lens.persona}

${COMPANY}

${SCALES}

RISK REGISTER (score ALL 5):
${JSON.stringify(register, null, 2)}

Rules:
- Score each risk on all four factors (tef, vuln, primary_impact, secondary_impact) using ONLY the ordinal scales above, relative to THIS company's CURRENT control environment (no mitigations applied yet).
- Every factor score requires a 1-2 sentence reason making a concrete, falsifiable claim tied to the company profile or a named, well-known threat pattern (e.g. "AiTM kits defeat push-based MFA"). Your reasons are the audit trail; they will be compared factor-by-factor against two other scorers, and large disagreements get flagged for human review.
- Do NOT compute composite scores and do NOT rank the risks — deterministic code does that downstream.
- Stay in your lens for emphasis, but score all four factors honestly; do not inflate the factors your lens cares about.`
}

const scorecards = (await parallel(LENSES.map(l => () =>
  ask(scorerPrompt(l), { label: `score:${l.key}`, phase: 'Score', schema: SCORE_SCHEMA, effort: 'high' })
    .then(s => ({ lens: l.key, risks: s.risks }))
))).filter(Boolean)
log(`Scoring panel complete: ${scorecards.length}/3 lenses returned scorecards`)

// Deterministic aggregation — the "not a black box" part
const FACTORS = ['tef', 'vuln', 'primary_impact', 'secondary_impact']
const scoreTable = register.map(r => {
  const perLens = scorecards.map(sc => {
    const row = sc.risks.find(x => x.risk_id === r.id)
    return row ? Object.assign({ lens: sc.lens }, row) : null
  }).filter(Boolean)
  const med = {}
  const spread = {}
  for (const f of FACTORS) {
    const vals = perLens.map(p => p[f])
    med[f] = median(vals)
    spread[f] = Math.max.apply(null, vals) - Math.min.apply(null, vals)
  }
  const likelihood = round((med.tef + med.vuln) / 2, 2)
  const impact = round(0.6 * med.primary_impact + 0.4 * med.secondary_impact, 2)
  const composite = round(likelihood * impact, 2)
  const disagreementFlags = FACTORS.filter(f => spread[f] >= 2)
  return {
    risk_id: r.id, title: r.title,
    medians: med, factor_spread: spread,
    likelihood, impact, composite,
    tier: composite >= 16 ? 'Critical' : composite >= 10 ? 'High' : composite >= 5 ? 'Medium' : 'Low',
    disagreement_flags: disagreementFlags,
    per_lens: perLens,
  }
})
const ranking = scoreTable.slice().sort((a, b) =>
  b.composite - a.composite || b.impact - a.impact || b.likelihood - a.likelihood)
ranking.forEach((row, i) => { row.rank = i + 1 })
log(`Ranking (composite = L x I): ${ranking.map(r => `${r.rank}. ${r.risk_id} (${r.composite})`).join('  ')}`)

// ---------------------------------------------------------------------------
// Phase 3 — Challenge: two skeptics try to refute the #1 ranking
// ---------------------------------------------------------------------------
phase('Challenge')
const top = ranking[0]
const auditTrail = JSON.stringify(ranking, null, 2)
const ANGLES = [
  { key: 'likelihood', text: 'Attack the LIKELIHOOD reasoning: is the top risk\'s threat-event frequency or susceptibility overstated, or is another risk\'s understated? Use the factor-level reasons in the audit trail against themselves.' },
  { key: 'impact', text: 'Attack the IMPACT reasoning: does another risk carry materially larger, compounding, or existential loss for this company (multi-tenant data breach, backup destruction, subscription-level compromise) that the ordinal scales flattened?' },
]

const challenges = (await parallel(ANGLES.map(a => () =>
  ask(`You are an adversarial reviewer in a risk-prioritization pipeline. Deterministic code ranked 5 risks by composite = likelihood x impact (median of 3 independent scorers). The current #1 is ${top.risk_id}: "${top.title}" (composite ${top.composite}).

Your job: try to REFUTE the #1 ranking. ${a.text}

${COMPANY}

${SCALES}

RANKING + FULL FACTOR-LEVEL AUDIT TRAIL (all 3 scorers' scores and reasons):
${auditTrail}

Rules:
- If, after honest analysis, you cannot refute it, return verdict "upheld" — do NOT manufacture weak objections; a false refutation wastes human review time.
- If refuted, set alternative_top_risk_id to the risk that should be #1 and ground every claim in the audit trail or the company profile.
- key_evidence: 2-4 bullet-sized citations of specific scorer reasons or profile facts.`,
    { label: `challenge:${a.key}`, phase: 'Challenge', schema: CHALLENGE_SCHEMA, effort: 'high' })
))).filter(Boolean)

const refutations = challenges.filter(c => c.verdict === 'refuted')
const contested = refutations.length >= 2
log(`Challenge: ${challenges.length - refutations.length} upheld, ${refutations.length} refuted -> top risk ${contested ? 'CONTESTED (flagged for human review)' : 'stands'}: ${top.risk_id}`)

// ---------------------------------------------------------------------------
// Phase 4 — Mitigate: per-risk mitigation package, then IT feasibility review
// ---------------------------------------------------------------------------
phase('Mitigate')
const mitigations = (await pipeline(
  ranking,
  (row) => ask(`You are a senior security architect who specializes in right-sized controls for SMB SaaS companies on Azure/M365. Design the mitigation package for ONE risk.

${COMPANY}

RISK (priority rank ${row.rank} of 5, composite score ${row.composite} of 25, tier ${row.tier}):
${JSON.stringify(byId[row.risk_id], null, 2)}

Scoring rationale you should design against (median factor scores + per-lens reasons):
${JSON.stringify({ medians: row.medians, per_lens: row.per_lens.map(p => ({ lens: p.lens, tef: p.tef_reason, vuln: p.vuln_reason, primary: p.primary_impact_reason, secondary: p.secondary_impact_reason })) }, null, 2)}

Rules:
- Name CONCRETE controls, Azure/M365/GitHub-native first (they own E3 + Azure; note required license upgrades like Entra ID P2 or Defender plans in the cost estimate). Third-party only where the native option is genuinely inadequate — and say why.
- primary_control = the single control that removes most of the risk. controls = the full package (max 5, typed preventive/detective/corrective/administrative).
- owner: a specific role that exists at a 200-person company (e.g. "IT Manager", "Head of Engineering", "CTO") — not "the security team"; there is no security team.
- effort: honest t-shirt size + person-weeks + rough annual cost range including licensing.
- quick_wins: sub-1-week actions that cut this risk immediately.
- soc2_criteria: map to SOC 2 Trust Services Criteria (CC-series) — the company is mid-audit-prep and every control should double as audit evidence.
- residual_gaps: what this package does NOT cover.
- Do NOT propose a 24/7 SOC, a dedicated security hire as a prerequisite, or enterprise tooling disproportionate to a 3-person IT team.
- human_review_notes: what a human must sanity-check before funding this (pricing, license tier, org fit).`,
    { label: `mitigate:${row.risk_id}`, phase: 'Mitigate', schema: MITIGATION_SCHEMA }),
  (mit, row) => {
    if (!mit) throw new Error('mitigation missing')
    return ask(`You are the IT Manager of this company: a team of 3 (you + 2 sysadmins), ~60 engineers you can borrow sparingly, a limited budget, and a SOC 2 Type I audit in ~6 months that already consumes ~20% of your team's time. Review this proposed mitigation package for realism.

${COMPANY}

RISK: ${JSON.stringify(byId[row.risk_id], null, 2)}

PROPOSED MITIGATION PACKAGE:
${JSON.stringify(mit, null, 2)}

Assess honestly:
- Is the effort/cost estimate realistic for THIS team? Adjust adjusted_effort to what you actually believe (it may be higher OR lower).
- Concerns: operational risks (user revolt over FIDO2 keys, deployment breakage, on-call load), hidden costs, licensing traps.
- required_changes: concrete edits that would make you approve it (phasing, pilot groups, scope cuts).
- sequencing_note: where this lands relative to the other four mitigations and the SOC 2 evidence-collection work.
- verdict: approve / approve_with_changes / rework. Be a tough but fair reviewer — rubber-stamping costs you your weekends later.`,
      { label: `feasibility:${row.risk_id}`, phase: 'Mitigate', schema: FEASIBILITY_SCHEMA, effort: 'high' })
      .then(f => ({ risk_id: row.risk_id, rank: row.rank, mitigation: mit, feasibility: f }))
  }
)).filter(Boolean)
log(`Mitigation packages complete: ${mitigations.length}/5 (verdicts: ${mitigations.map(m => `${m.risk_id}=${m.feasibility.verdict}`).join(', ')})`)

// ---------------------------------------------------------------------------
// Phase 5 — Quantify: parameter estimation -> red-team -> targeted revision -> deterministic model
// ---------------------------------------------------------------------------
phase('Quantify')
function quantPrompt(m) {
  const risk = byId[m.risk_id]
  const row = ranking.find(r => r.risk_id === m.risk_id)
  return `You are a cyber-risk quantification analyst. Produce PARAMETER ESTIMATES ONLY for one risk — a deterministic model downstream computes residual likelihoods and aggregates; do NOT do that math yourself.

${COMPANY}

RISK (${m.risk_id}, prioritization composite ${row ? row.composite : '?'}/25):
${JSON.stringify(risk, null, 2)}

MITIGATION as adjusted by the IT feasibility review (assume fully implemented AND operated for a full year):
${JSON.stringify({ mitigation: m.mitigation, feasibility_adjustments: m.feasibility }, null, 2)}

Estimate:
1. baseline: probability (%) that THIS risk materializes into a material breach/incident for THIS company within 12 months, given CURRENT controls (no mitigation). Provide low/mode/high. In "basis", name the industry patterns you are drawing on (e.g. DBIR-style action-vector prevalence, SMB ransomware incident rates, IBM Cost-of-a-Breach patterns) — and note that these figures come from model memory and MUST be verified by a human against the current editions of those reports.
2. effectiveness: the % reduction in that baseline if the adjusted mitigation is fully implemented and operated. Provide low/mode/high. Account for partial coverage (e.g. FIDO2 rollout that reaches 90% of staff, Intune at ~95% not 100%), operational drift, and the feasibility reviewer's scope cuts. Effectiveness above 90% requires explicit justification in "basis".
3. key_assumptions: every assumption a reviewer would need to accept your numbers.
4. confidence + human_review_required + human_review_reason: quantitative estimates from an LLM are the least trustworthy artifact in this pipeline — say precisely what a human must verify.

Consistency anchors so the 5 estimates are comparable: low/mode/high must be ordered; keep percentages as annual probabilities of a MATERIAL incident (not any attempt); a "material incident" means one triggering IR cost >$25k or a notification duty.`
}

const rawEstimates = (await parallel(mitigations.map(m => () =>
  ask(quantPrompt(m), { label: `quant:${m.risk_id}`, phase: 'Quantify', schema: QUANT_SCHEMA, effort: 'high' })
))).filter(Boolean)
log(`Raw estimates in for ${rawEstimates.length}/5 risks; running red-team consistency pass`)

const redteam = await ask(`You are a red-team reviewer of cyber-risk quantification. Below are 5 independently produced parameter estimates (annual baseline probability of a material incident, and mitigation effectiveness) for the same company. The estimators could not see each other. Find what is wrong ACROSS the set.

${COMPANY}

PRIORITIZATION CONTEXT (composite scores from the scoring panel): ${JSON.stringify(ranking.map(r => ({ risk_id: r.risk_id, composite: r.composite, likelihood: r.likelihood, impact: r.impact })))}

THE 5 ESTIMATES:
${JSON.stringify(rawEstimates, null, 2)}

Look specifically for:
- Cross-risk ordering that contradicts the scoring panel's likelihood rationale without justification (e.g. a risk scored far more likely getting a lower baseline).
- Overconfident effectiveness (mode > 90%) without strong justification, or suspiciously tight low/high ranges implying false precision.
- Double counting: two risks claiming the same underlying event (e.g. the phishing-ATO baseline already containing the dormant-account takeover, or ransomware overlapping endpoint-infostealer paths feeding the secrets risk).
- Missing assumptions a human reviewer would need.
- correlation_concerns: where the downstream model's independence assumption (P(breach) = 1 - prod(1 - p_i)) is most wrong for THESE five risks, and in which direction it biases the aggregate.
Only raise issues that would materially change the model's output or a decision; do not nitpick wording.`,
  { label: 'quant:redteam', phase: 'Quantify', schema: REDTEAM_SCHEMA, effort: 'high' })

const issuesByRisk = {}
for (const iss of (redteam.issues || [])) {
  if (!issuesByRisk[iss.risk_id]) issuesByRisk[iss.risk_id] = []
  issuesByRisk[iss.risk_id].push(iss)
}
const flaggedIds = Object.keys(issuesByRisk)
log(`Red team raised ${(redteam.issues || []).length} issues across ${flaggedIds.length} risks; revising flagged estimates`)

const revised = (await parallel(rawEstimates.filter(e => issuesByRisk[e.risk_id]).map(e => () =>
  ask(`You are the cyber-risk quantification analyst who produced the estimate below. A red-team reviewer raised specific issues with it. Revise your estimate to address them — or, where you disagree, keep your number and rebut in the change_log. Do not change fields no issue touches.

YOUR ORIGINAL ESTIMATE:
${JSON.stringify(e, null, 2)}

RED-TEAM ISSUES FOR THIS RISK:
${JSON.stringify(issuesByRisk[e.risk_id], null, 2)}

RED-TEAM CORRELATION CONCERNS (context): ${JSON.stringify(redteam.correlation_concerns || [])}

change_log: one entry per issue — what you changed, or why you are standing firm. Keep low <= mode <= high.`,
    { label: `quant:revise:${e.risk_id}`, phase: 'Quantify', schema: REVISED_QUANT_SCHEMA, effort: 'high' })
))).filter(Boolean)

const revisedById = {}
for (const r of revised) revisedById[r.risk_id] = r
const finalEstimates = rawEstimates.map(e => revisedById[e.risk_id] || Object.assign({ change_log: [] }, e))

// ---- Deterministic model (all arithmetic happens HERE, in code) ----
function aggregate(ps) { return 1 - ps.reduce((acc, p) => acc * (1 - p / 100), 1) }
const modelRows = finalEstimates.map(e => {
  const b = e.baseline, ef = e.effectiveness
  return {
    risk_id: e.risk_id,
    baseline_pct: { low: b.low_pct, mode: b.mode_pct, high: b.high_pct },
    effectiveness_pct: { low: ef.low_pct, mode: ef.mode_pct, high: ef.high_pct },
    residual_pct: {
      low: round(b.low_pct * (1 - ef.high_pct / 100), 2),   // best case: low baseline, high effectiveness
      mode: round(b.mode_pct * (1 - ef.mode_pct / 100), 2),
      high: round(b.high_pct * (1 - ef.low_pct / 100), 2),  // worst case: high baseline, low effectiveness
    },
    reduction_pp: round(b.mode_pct - b.mode_pct * (1 - ef.mode_pct / 100), 2),
  }
})
const baselineAggMode = round(aggregate(modelRows.map(r => r.baseline_pct.mode)) * 100, 1)
const residualAggMode = round(aggregate(modelRows.map(r => r.residual_pct.mode)) * 100, 1)
const model = {
  formula: 'P(>=1 material breach in 12mo) = 1 - PRODUCT(1 - p_i); residual p_i = baseline_i x (1 - effectiveness_i); computed on mode values, bounds shown separately. CAVEAT: assumes the 5 risks are independent — the red-team pass documents where that is wrong.',
  per_risk: modelRows,
  aggregate: {
    baseline_mode_pct: baselineAggMode,
    residual_mode_pct: residualAggMode,
    absolute_reduction_pp: round(baselineAggMode - residualAggMode, 1),
    relative_reduction_pct: round((baselineAggMode - residualAggMode) / baselineAggMode * 100, 1),
    bounds: {
      baseline: { low_pct: round(aggregate(modelRows.map(r => r.baseline_pct.low)) * 100, 1), high_pct: round(aggregate(modelRows.map(r => r.baseline_pct.high)) * 100, 1) },
      residual: { low_pct: round(aggregate(modelRows.map(r => r.residual_pct.low)) * 100, 1), high_pct: round(aggregate(modelRows.map(r => r.residual_pct.high)) * 100, 1) },
    },
  },
  marginal_contribution: modelRows.map((r, i) => {
    const ps = modelRows.map((x, j) => j === i ? x.residual_pct.mode : x.baseline_pct.mode)
    const withOnlyThis = round(aggregate(ps) * 100, 1)
    return { risk_id: r.risk_id, aggregate_if_only_this_mitigation_pct: withOnlyThis, delta_pp_vs_baseline: round(baselineAggMode - withOnlyThis, 1) }
  }),
}
log(`Model: baseline P(breach) ${baselineAggMode}% -> residual ${residualAggMode}% (mode values; -${model.aggregate.absolute_reduction_pp}pp)`)

// ---------------------------------------------------------------------------
// Phase 6 — Synthesize: executive summary from computed numbers only
// ---------------------------------------------------------------------------
phase('Synthesize')
const humanReviewFlags = []
for (const row of ranking) {
  for (const f of row.disagreement_flags) {
    humanReviewFlags.push({ source: 'scoring-panel', risk_id: row.risk_id, flag: `Scorer disagreement on factor "${f}" (spread ${row.factor_spread[f]}) — a human should adjudicate between the lens rationales before trusting the composite.` })
  }
}
for (const c of refutations) {
  humanReviewFlags.push({ source: 'adversarial-challenge', risk_id: top.risk_id, flag: `A challenger refuted the #1 ranking (alternative: ${c.alternative_top_risk_id}, confidence ${c.confidence}): ${c.argument.slice(0, 300)}` })
}
for (const m of mitigations) {
  if (m.feasibility.verdict !== 'approve') {
    humanReviewFlags.push({ source: 'feasibility-review', risk_id: m.risk_id, flag: `IT feasibility verdict "${m.feasibility.verdict}": ${(m.feasibility.required_changes || []).join('; ').slice(0, 300)}` })
  }
  if (m.mitigation.human_review_notes) {
    humanReviewFlags.push({ source: 'mitigation-agent', risk_id: m.risk_id, flag: m.mitigation.human_review_notes })
  }
}
for (const e of finalEstimates) {
  if (e.human_review_required) {
    humanReviewFlags.push({ source: 'quant-estimator', risk_id: e.risk_id, flag: e.human_review_reason })
  }
}
for (const cc of (redteam.correlation_concerns || [])) {
  humanReviewFlags.push({ source: 'quant-redteam', risk_id: 'ALL', flag: `Independence-assumption concern: ${cc}` })
}
humanReviewFlags.push({ source: 'pipeline', risk_id: 'ALL', flag: 'STANDING FLAG: every numeric parameter (baselines, effectiveness, costs) is an LLM estimate from model memory. Validate against current DBIR/industry reports, actual Azure/M365 pricing, and the company\'s own telemetry before using in budget or board material.' })

const summary = await ask(`You are the report-writing agent at the end of a risk-prioritization pipeline. Write a crisp executive summary in Markdown (no top-level H1; start at H2) for the leadership of this company.

${COMPANY}

Use ONLY the data below. Do not invent, recompute, or round any numbers — quote them exactly as given. Do not add risks, controls, or costs not present in the data.

RANKING (deterministic, composite = likelihood x impact, median of 3 scoring lenses): ${JSON.stringify(ranking.map(r => ({ rank: r.rank, risk_id: r.risk_id, title: r.title, likelihood: r.likelihood, impact: r.impact, composite: r.composite, tier: r.tier })))}

TOP RISK: ${top.risk_id} — challenge outcome: ${contested ? 'CONTESTED by both adversarial reviewers' : refutations.length === 1 ? 'one of two adversarial reviewers dissented (see flags)' : 'upheld by both adversarial reviewers'}.

MITIGATIONS (post-feasibility): ${JSON.stringify(mitigations.map(m => ({ risk_id: m.risk_id, primary_control: m.mitigation.primary_control, owner: m.mitigation.owner, effort: m.feasibility.adjusted_effort, verdict: m.feasibility.verdict })))}

QUANT MODEL (computed deterministically): ${JSON.stringify(model)}

HUMAN-REVIEW FLAG COUNT: ${humanReviewFlags.length} (summarize the themes in one short paragraph; do not list all).

Structure: ## Executive summary (5-6 sentences, lead with the top risk and the aggregate breach-likelihood change) / ## Priority ranking (table) / ## What to do first (ordered by marginal risk reduction per unit effort — reason from delta_pp_vs_baseline and adjusted effort) / ## How much safer this makes us (baseline vs residual, bounds, the independence caveat in plain words) / ## Where not to trust this report (one tight paragraph).`,
  { label: 'synthesize:report', phase: 'Synthesize', effort: 'medium' })

return {
  register: { risks: register, validation_notes: validated.validation_notes, coverage_gaps: validated.coverage_gaps },
  scoring: { lenses: LENSES.map(l => l.key), scorecards, table: scoreTable, ranking: ranking.map(r => ({ rank: r.rank, risk_id: r.risk_id, title: r.title, likelihood: r.likelihood, impact: r.impact, composite: r.composite, tier: r.tier, disagreement_flags: r.disagreement_flags })) },
  top_risk: { risk_id: top.risk_id, title: top.title, composite: top.composite, contested, challenges },
  mitigations,
  quantification: { raw_estimates: rawEstimates, redteam, revised, final_estimates: finalEstimates, model },
  human_review_flags: humanReviewFlags,
  executive_summary: summary,
}