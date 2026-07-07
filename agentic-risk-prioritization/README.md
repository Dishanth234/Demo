# Risk Prioritization with Agentic AI

**Scenario (fixed):** a 200-employee SaaS company on Azure + M365 — public-facing web app, PostgreSQL backend, remote workforce, one small IT team, SOC 2 in progress. Added assumptions are itemized in [ASSUMPTIONS.md](ASSUMPTIONS.md).

**What this is:** a working multi-agent pipeline (not a single prompt) that takes a 5-risk register through validation → 3-lens scoring → adversarial challenge → mitigation + feasibility review → quantitative breach-likelihood modeling → synthesis. Roughly 25 agents per run; every agent returns schema-validated JSON; **all arithmetic is done by deterministic code, never by a model**. The pipeline was actually executed — the outputs in [outputs/](outputs/) are its real artifacts, and [workflow/risk_pipeline.workflow.js](workflow/risk_pipeline.workflow.js) is the exact script that ran.

```
repo layout
├── README.md                     ← this write-up (results included below)
├── ASSUMPTIONS.md                ← every stated assumption, and why it matters
├── HUMAN_REVIEW_FLAGS.md         ← auto-generated: where NOT to trust the AI
├── workflow/
│   └── risk_pipeline.workflow.js ← the executed orchestration script (the plumbing)
├── prompts/                      ← exact prompt templates for all 9 agent roles
├── schemas/schemas.json          ← JSON Schemas that force structured agent output
└── outputs/                      ← real artifacts from the executed run
```

---

## Task 1 — The five risks

Each entry names a **threat source**, the **asset at stake**, and the **exposure** (why this company, specifically). The seed register was authored by hand; a validator agent then tightened wording and checked distinctness without being allowed to change ids or subjects. Final validated register: [outputs/01_risk_register.json](outputs/01_risk_register.json).

| ID | Risk | Threat source | Asset at stake | Exposure |
|----|------|---------------|----------------|----------|
| **R1** | AiTM credential phishing → M365/Entra account takeover | External phishing crews running adversary-in-the-middle kits (Evilginx-class) that proxy the real Entra login page and steal session cookies, defeating push MFA | Entra ID identities and everything behind them: Exchange Online, SharePoint/OneDrive, ~15 SSO SaaS apps | 200 remote employees on unmanaged networks; MFA is phishable Authenticator push; no Conditional Access device-compliance or authentication-strength policy |
| **R2** | Public web app exploitation (SQLi/IDOR/CVE) → PostgreSQL exfiltration | External mass scanners and targeted attackers exploiting OWASP-class flaws or unpatched framework CVEs | Multi-tenant customer records + PII of ~500k end users in Azure PostgreSQL; the tenant-isolation boundary | Internet-facing app, no WAF, single high-privilege app DB role, no security code-review/DAST gate, weeks of patch latency |
| **R3** | Leaked CI/CD & cloud secrets → Azure subscription compromise | External attackers harvesting secrets from repos, infostealer-hit developer laptops, or compromised GitHub Actions dependencies | The production Azure subscription: App Service, Postgres admin creds, Blob Storage incl. backups; the deploy pipeline | Historical .env/connection strings in repos; long-lived service-principal secrets with Contributor rights; no secret scanning or rotation; ~60 engineers with broad repo access |
| **R4** | Ransomware/extortion via unmanaged remote endpoints | Ransomware affiliates and initial-access brokers delivering infostealers/loaders via malvertising and trojanized installers | Laptops, cached corporate credentials/tokens, synced OneDrive/SharePoint corpora; operational continuity | ~40% of laptops not in Intune; users are local admins; Defender AV defaults, no EDR monitoring, no SIEM |
| **R5** | Offboarding gaps: dormant employee/contractor access to production data | Internal: departed staff/contractors retaining valid access; external attackers reusing dormant accounts and shared service-account passwords | Production PostgreSQL (direct contractor accounts), GitHub source, customer data in M365; SOC 2 audit integrity | Manual ticket-driven offboarding across ~15 SaaS apps + Azure + Postgres; shared non-rotated service accounts; no access recertification |

The five have deliberately distinct threat sources (external-phishing, external-appsec, external-secrets, external-malware, internal) and distinct primary assets, so mitigations don't collapse into one another.

---

## Task 2 — The agentic workflow

### Architecture

```mermaid
flowchart TD
    SEED[Seed register: 5 risks<br/>human-authored] --> V[Agent 1: Register Validator<br/>schema: REGISTER_SCHEMA]
    V --> S1[Agent 2a: Scorer<br/>threat-intel lens]
    V --> S2[Agent 2b: Scorer<br/>business-impact lens]
    V --> S3[Agent 2c: Scorer<br/>control-environment lens]
    S1 & S2 & S3 --> AGG[/DETERMINISTIC CODE:<br/>median per factor, L x I composite,<br/>ranking, disagreement flags/]
    AGG --> C1[Agent 3a: Challenger<br/>attack likelihood] & C2[Agent 3b: Challenger<br/>attack impact]
    C1 & C2 --> TOP{{Top risk: upheld or CONTESTED}}
    AGG --> M1[Agents 4.1-4.5: Mitigation Architect<br/>one per risk, pipelined]
    M1 --> F1[Agents 5.1-5.5: IT Feasibility Reviewer<br/>adjusts effort and cost]
    F1 --> Q1[Agents 6.1-6.5: Quant Estimator<br/>baseline + effectiveness, blind]
    Q1 --> RT[Agent 7: Quant Red Team<br/>cross-estimate consistency]
    RT --> REV[Agent 8: Revision<br/>only flagged estimates]
    REV --> MODEL[/DETERMINISTIC CODE:<br/>residuals, aggregate P breach,<br/>bounds, marginal contributions/]
    MODEL --> SYN[Agent 9: Synthesis<br/>numbers quoted, never recomputed]
    TOP -.flags.-> FLAGS[HUMAN_REVIEW_FLAGS]
    AGG -.disagreement.-> FLAGS
    F1 -.non-approve verdicts.-> FLAGS
    RT -.correlation concerns.-> FLAGS
```

### Why this is agentic rather than one prompt

1. **Separation of estimation and computation.** Models only ever produce *parameters with justifications*; composites, rankings, residuals and aggregates come from ~40 lines of auditable JavaScript in the orchestration script. You can recompute every number in this report by hand from the JSON outputs.
2. **Independence where it buys signal.** The three scorers can't see each other; the five quant estimators can't see each other. Convergence is evidence, divergence becomes a human-review flag instead of being averaged away.
3. **Opposed incentives.** Generator/critic pairs at every consequential step: architect vs. feasibility reviewer, estimators vs. red team, ranking vs. adversarial challengers who are explicitly permitted to return "upheld" so they don't manufacture objections.
4. **Schema-forced output.** Every agent (except the prose synthesizer) returns JSON validated against a schema ([schemas/schemas.json](schemas/schemas.json)), with automatic retry on mismatch. No regex-parsing of model text anywhere.
5. **Auditability as a data structure.** The scoring panel must justify *every factor score* in 1–2 falsifiable sentences. The full trail — 3 lenses × 5 risks × 4 factors, with reasons — is preserved in [outputs/02_prioritization_scores.json](outputs/02_prioritization_scores.json).

### Prioritization framework (FAIR-lite ordinal)

- **Likelihood** decomposed FAIR-style into **TEF** (threat-event frequency, 1–5) and **VULN** (susceptibility given current controls, 1–5) — separating "how often is this tried" from "how often does a try succeed here."
- **Impact** decomposed into **PRIMARY** (direct: IR, downtime, recovery) and **SECONDARY** (notification, churn, fines, SOC 2 setback), both on dollar-banded 1–5 scales calibrated to a ~$20M ARR company.
- **Composite** = `L × I`, with `L = (TEF+VULN)/2`, `I = 0.6·PRIMARY + 0.4·SECONDARY`; medians across the three lenses; tiers Critical ≥16, High ≥10, Medium ≥5.
- Full scale definitions: [prompts/00_shared_context.md](prompts/00_shared_context.md). Design rationale (median vs. mean, the 60/40 weight as a policy choice): [ASSUMPTIONS.md](ASSUMPTIONS.md).

### The run

24 agents, ~706k tokens, ~12 minutes wall clock. The validator tightened all five entries and — usefully — **stripped four "facts" my drafts had invented** that weren't in the scenario (e.g. "no secret scanning", "shared service accounts"), moving them to `validation_notes` as things to confirm in fieldwork. It also flagged 3 coverage gaps for the watchlist (backup immutability/restore testing, third-party SaaS vendor breach, *current*-insider overexposure).

**Priority ranking** (composite = L × I, median of 3 lenses; full factor-level audit trail with every scorer's reasoning in [outputs/02_prioritization_scores.json](outputs/02_prioritization_scores.json)):

| Rank | Risk | Likelihood | Impact | Composite | Tier |
|------|------|-----------|--------|-----------|------|
| **1** | **R3 — Leaked CI/CD & cloud secrets → Azure subscription compromise** | 4.0 | 4.4 | **17.6** | **Critical** |
| 2 | R1 — AiTM phishing → M365 account takeover | 4.5 | 3.4 | 15.3 | High |
| 3 | R2 — Web app exploitation → PostgreSQL exfiltration | 4.0 | 3.8 | 15.2 | High |
| 4 | R4 — Ransomware via unmanaged endpoints | 3.5 | 3.6 | 12.6 | High |
| 5 | R5 — Offboarding gaps / dormant access | 3.5 | 3.4 | 11.9 | High |

No factor had a scorer spread ≥ 2, so no scoring-disagreement flags fired — three genuinely different lenses converged on this ordering.

**The single highest risk: R3.** Why, in one paragraph from the audit trail: it is the only risk where all three lenses scored *both* impact factors at or near the maximum — a Contributor-level service principal in a **single** production subscription reaches the database, the backups, and the deploy pipeline at once (no recovery path), while likelihood is held up by commodity infostealers hitting an unmanaged, local-admin developer fleet whose repos contain historical connection strings.

**Adversarial challenge:** split verdict, so the #1 stands but carries a flag. The *likelihood* challenger **refuted** (medium confidence, alternative: R1), arguing a genuine methodological catch — two scorers' TEF counted raw delivery attempts while their VULN also counted chain-success, double-counting the chain, and one TEF contributor (public-repo scanning) can't apply to private repos. The *impact* challenger **upheld** (high confidence): R3 *is* the existential scenario — multi-tenant breach, backup destruction and subscription persistence are all inside it. Both arguments, with cited evidence, are in [outputs/03_top_risk_and_challenge.json](outputs/03_top_risk_and_challenge.json). A human adjudicating the dissent should note R1 vs R3 are within 2.3 composite points and R1's mitigation turns out to have the *largest marginal effect on breach likelihood* (below) — the correct executive read is "R3 and R1 are the top tier; fund both."

---

## Task 3 — Mitigations (control · owner · effort)

Each package was designed by a mitigation-architect agent against the factor-level scoring rationale, then re-priced by an IT-feasibility agent role-playing the 3-person IT team. **All five came back `approve_with_changes`** — the reviewer consistently found the architects optimistic (effort up ~40–50%, hidden licensing traps like the GitHub Enterprise SSO requirement) — which is exactly why the pipeline has that stage. The table shows the **feasibility-adjusted** numbers; full packages (all controls with types, quick wins, residual gaps, SOC 2 mappings, both effort estimates) are in [outputs/04_mitigations.json](outputs/04_mitigations.json).

| Risk | Primary control (named) | Owner | Adjusted effort | Annual cost (adj.) | SOC 2 |
|------|------------------------|-------|-----------------|--------------------|-------|
| **R3** | GitHub Actions **OIDC workload-identity federation to Entra ID** — delete all long-lived service-principal secrets; + GitHub Secret Protection (push protection, history triage), Key Vault, least-privilege RBAC, immutable backups | Head of Engineering (IT Manager co-owner) | L · ~13 pw | $15k–32k | CC6.1–6.3, 6.6, 7.1–7.2, 7.4, 8.1, A1.2 |
| **R1** | **Phishing-resistant MFA (passkeys/FIDO2)** enforced tenant-wide via Entra Conditional Access **authentication strengths**; FIDO2 hardware keys for admins/finance | IT Manager | L · ~12 pw | $40k–58k yr-1 (E5 Security add-on shared with R4) | CC6.1, 6.6–6.7, 7.2–7.4 |
| **R2** | **Azure WAF** (App Gateway WAF v2 / Front Door Premium, Prevention mode) + CodeQL/Dependabot gates + least-privilege DB role and **PostgreSQL row-level security** retrofit + annual pen test | Head of Engineering (IT executes WAF/logging) | L · ~18 pw | $45k–75k yr-1 | CC6.1, 6.6, 7.1–7.2, 7.4, 8.1 |
| **R4** | Entra **Conditional Access compliant-device gating** (forces Intune to ~100%) + **Defender for Business EDR** with automated investigation + local-admin removal via LAPS/EPM | IT Manager (CTO signs enforcement dates) | L · ~12 pw | $12k–22k | CC6.1, 6.6, 6.8, 7.2, 7.4–7.5 |
| **R5** | **Entra ID as the single revocation point**: Entra auth on PostgreSQL Flexible Server (kill standing local DB logins), SCIM provisioning for priority SaaS, automated leaver workflow, quarterly access reviews | IT Manager (Head of Eng co-owner for Postgres) | L · ~9 pw | $10k–30k | CC6.1–6.3, 7.2, 9.2 |

Two cross-cutting outputs worth more than any single row: every package ships **quick wins executable in under a week** (28 total — e.g. revoke the historical `.env` secrets *today*, reconcile the contractor Postgres roster, enable free GitHub push protection), and the feasibility reviewers produced a coherent **sequencing plan**: R1's identity work and R4's device gating share one Conditional Access change window; R5's Phase-1 contractor cleanup jumps the queue because it's days of work closing a live hole.

---

## Task 4 — Quantified breach-likelihood reduction

**The model** (all arithmetic by code in the workflow script — the LLMs only supplied parameters with written bases):

```
residual_i      = baseline_i × (1 − effectiveness_i)            (mode values)
P(≥1 breach)    = 1 − Π(1 − p_i)                                 (independence assumed — see caveat)
bounds:           best  = low baseline × high effectiveness
                  worst = high baseline × low effectiveness
marginal_i      = P_baseline − P(only mitigation i applied)
```

Five estimator agents (blind to each other) produced baseline and effectiveness estimates with named industry anchors; a red-team agent then reviewed the *set* and forced a revision of R5 (baseline mode raised 8% → 10% for consistency with R4's panel score; effectiveness decomposed and cut 65% → 57% because pre-departure exfiltration is untouched by leaver automation). Raw estimates, red-team issues, and the revision change-log are all preserved in [outputs/05_quantification.json](outputs/05_quantification.json).

**Per-risk parameters and residuals** (annual probability of a *material* incident — IR cost > $25k or a notification duty):

| Risk | Baseline (low/mode/high) | Mitigation effectiveness | Residual (low/mode/high) | Reduction (mode, pp) |
|------|--------------------------|--------------------------|--------------------------|-----------------------|
| R3 | 8% / **20%** / 40% | 45% / **70%** / 85% | 1.2% / **6.0%** / 22% | −14.0 |
| R1 | 15% / **30%** / 55% | 60% / **80%** / 92% | 1.2% / **6.0%** / 22% | −24.0 |
| R2 | 8% / **20%** / 40% | 45% / **65%** / 80% | 1.6% / **7.0%** / 22% | −13.0 |
| R4 | 8% / **15%** / 30% | 45% / **65%** / 80% | 1.6% / **5.25%** / 16.5% | −9.75 |
| R5 | 3% / **10%** / 22% | 40% / **57%** / 72% | 0.84% / **4.3%** / 13.2% | −5.7 |

**Aggregate change** (the headline number, with its warning label attached):

| | Baseline | Residual | Change |
|--|----------|----------|--------|
| P(≥1 material breach in 12 mo), mode | **65.7%** | **25.5%** | **−40.2 pp (−61.2% relative)** |
| Scenario bounds (best/worst) | 35.8% – 91.2% | 6.3% – 65.6% | — |

**Marginal contribution** — what each mitigation buys *alone* against the full baseline (this, not the risk ranking, is what should drive sequencing):

| Mitigation applied alone | Aggregate P(breach) | Δ vs baseline |
|--------------------------|--------------------:|---------------:|
| R1 — phishing-resistant MFA | 54.0% | **−11.7 pp** ← largest single lever |
| R3 — OIDC + secret hygiene | 59.7% | −6.0 pp |
| R2 — WAF + SDLC + RLS | 60.2% | −5.5 pp |
| R4 — device gating + EDR | 61.8% | −3.9 pp |
| R5 — single revocation point | 63.6% | −2.1 pp |

Note the deliberate tension the pipeline surfaced: R3 is the top-*ranked* risk (impact-driven), but R1 is the biggest single *likelihood* lever. Priorities aren't the same question as sequencing — the model makes that explicit instead of hiding it in one number.

**Caveats the pipeline itself raised** (not added by me afterwards): the independence assumption **overstates the baseline aggregate** — the red team identified one infostealer infection on the unmanaged fleet as a shared driver of R3 *and* R4, and phishable MFA as a shared driver of R1, R3 and R5, so the true baseline is somewhat below 65.7% and correlated *mitigation under-delivery* (one overloaded 3-person team implementing all five packages) makes the residual optimistic. It also flagged that all five baselines lean on the same unstated assumption that PII access near-automatically triggers notification duty. Directionally the reduction is robust; the point estimates are not.

---

## Where the AI must not be trusted without human review

Auto-generated from agent flags during the run — see [HUMAN_REVIEW_FLAGS.md](HUMAN_REVIEW_FLAGS.md) for the full list. The standing rule: **every numeric parameter in this repo (baselines, effectiveness, costs) is an LLM estimate from model memory.** It must be validated against current industry reports (DBIR, IBM CoDB), real Azure/M365 pricing, and the company's own telemetry before appearing in budgets or board material.

The run produced **23 auto-collected flags + 9 red-team issues**, grouped by source:

- **Quantitative parameters (highest distrust).** All five estimators self-flagged `human_review_required: true` — baselines and effectiveness numbers are anchored to DBIR/IBM-style patterns *from model memory* and must be checked against current editions. The red team added a joint-calibration concern: the five baselines together imply a ~65% annual incident probability, on the high side of SMB base rates.
- **Ranking dissent.** One of two challengers refuted R3's #1 spot (alternative R1, medium confidence) on a real methodological point (TEF/VULN conditioning). A human should adjudicate — the pipeline surfaced the argument rather than silently resolving it.
- **Cost/licensing.** Every feasibility review found pricing traps (GitHub Enterprise for SSO ≈ +$15k/yr, E5 Security vs. standalone Entra P2 trade-offs). All prices are model-memory estimates; get real quotes.
- **Cross-package dependencies.** The red team caught R3's and R5's estimates assuming *contradictory states of the same control* (Postgres Entra-auth deferred vs. completed) — the single best demonstration in this run of why blind parallel estimates need a set-level review.
- **Known pipeline limitation (honest disclosure).** Red-team issues tagged to a single risk trigger automatic revision (R5's was); issues spanning risks (`R3+R5`, `ALL`) don't map to one reviser and are deliberately left as human flags rather than auto-resolved.

---

## Beyond the brief — features that make this operationally useful

- **Re-runnable by design.** The workflow accepts an updated register via `args.risks` — re-run it quarterly (or after a control lands) and diff the outputs. Prompts, schemas and code are versioned in this repo, so two runs are comparable.
- **SOC 2 dual-use.** Every mitigation is mapped to SOC 2 Trust Services Criteria (CC-series) by the architect agents — the company is mid-audit, so risk spend doubles as audit evidence.
- **Marginal-contribution analysis.** The model computes what each mitigation buys *alone* (`delta_pp_vs_baseline`), which is what actually drives sequencing decisions under a 3-person IT team — not raw risk scores.
- **Coverage-gap watchlist.** The validator agent lists material risks *not* in the top 5, so the register can't silently ossify.
- **Human-review flags as a first-class artifact.** Disagreement between scorers, challenger dissent, feasibility pushback and red-team correlation concerns all land in one machine-generated file instead of being buried in transcripts.
- **Everything is a file.** Registers, scores, mitigations and model parameters are JSON — trivially importable into a GRC tool, a dashboard, or the next run.

## Reproducing / porting

The orchestration runs on the Claude Agent SDK's workflow harness (`agent()` spawns a subagent, `schema:` forces validated JSON, `parallel()`/`pipeline()` control concurrency). The design ports 1:1 to LangGraph (nodes = agents, edges = the phase graph, code nodes = the deterministic aggregation/model steps) or CrewAI; the prompts and schemas in this repo are stack-agnostic.

**Time spent:** within the 3–4h box — ~1h risk register + framework and scale design, ~1.5h pipeline authoring and debugging, ~1h run + write-up.
