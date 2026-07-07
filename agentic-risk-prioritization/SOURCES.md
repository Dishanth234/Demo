# Sources & Research Calibration (v1.1)

The pipeline's standing flag said: *every numeric parameter is an LLM estimate from model memory — verify against current sources before use.* This file is that verification, performed by a second agentic pass (6 web-research verifiers, 2026-07-06, raw structured findings in [outputs/09_research_validation.json](outputs/09_research_validation.json)) and then **adjudicated by a human-style calibration step** documented row by row below. Where research contradicted the pipeline, the parameter changed; the result is the **v1.1 research-calibrated model** in [outputs/08_advanced_analytics.json](outputs/08_advanced_analytics.json).

Verdict legend: ✅ confirmed against cited data · 🔧 adjusted (v1.1 differs from v1.0) · ⚠️ expert judgment (no quantitative literature exists — labeled, not hidden).

## Baselines (annual probability of a material incident)

| Risk | v1.0 (low/mode/high %) | Verdict | Key evidence | v1.1 |
|------|------------------------|---------|--------------|------|
| R1 AiTM→ATO | 15/30/55 | ✅ | Proofpoint ATO research: 62% of orgs suffered a *successful* account takeover; 65% of compromised accounts had MFA enabled. Microsoft Digital Defense Report 2025: identity attacks +32% H1 2025, AiTM/token theft = primary MFA bypass. DBIR 2026: credential abuse in 39% of breaches. | 15/30/55 |
| R2 web app→exfil | 8/20/40 | 🔧 | DBIR 2026: vulnerability exploitation is now the **#1** initial-access vector (31%) — but the surge is edge/VPN-device CVEs, not custom SaaS apps; full DB-exfiltration is a subset of successful exploitation. | **8/13/38** |
| R3 leaked secrets | 8/20/40 | 🔧 | GitGuardian State of Secrets Sprawl 2026: 28.65M secrets leaked to public GitHub in 2025 (+34% YoY); 64% of 2022's valid secrets still exploitable in Jan 2026. Exposure ≈ certain, but the *full chain* to subscription compromise prices well below the exposure rate. | **5/11/35** |
| R4 ransomware | 8/15/30 | ✅ | DBIR 2026: ransomware in 48% of breaches; 96% of sized ransomware victims are SMBs. Sophos 2025: avg recovery cost $638k for 100–250-employee victims. Coalition claims frequency ~1.5%/yr is the insured-average floor; this org's posture (40% unmanaged, no EDR) justifies sitting far above it. | 8/15/30 |
| R5 dormant access | 3/10/22 (post internal red team) | 🔧 | Beyond Identity: 83% of ex-employees retained access; ~1 in 3 employers "ever" breached via unrevoked access — but those are **lifetime** rates; DBIR privilege-misuse is a single-digit share of breaches. Research overrides the internal red team's raise (8→10): annualized material-incident mode ≈ 5–7%. | **3/6/18** |

**Worth noting honestly:** on R5 the pipeline's internal red team pushed the baseline *up* for cross-risk consistency, and external data then pushed it back *down*. Both moves are preserved in the artifacts ([05](outputs/05_quantification.json) change log, this table) — that's the audit trail working, not a bug.

## Mitigation effectiveness

| Risk | v1.0 (%) | Verdict | Key evidence | v1.1 |
|------|----------|---------|--------------|------|
| R1 passkeys/FIDO2 | 60/80/92 | ✅ | Google/NYU/UCSD study (350k real hijack attempts): security keys blocked 100% of automated + bulk-phishing + targeted attacks; Microsoft corroborates. Residual = device-code flow & OAuth consent abuse (Storm-2372) — mode could rise to ~85 only if those flows are also blocked. | 60/80/92 |
| R2 WAF+SDLC+RLS | 45/65/80 | 🔧 | Empirical OWASP CRS study (Computers & Security 2025): stock managed rules ≈60% detection precision (97% only after custom tuning); WAFFLED (2025) demonstrates parsing-discrepancy bypasses. High mode requires the CodeQL gate to be *blocking*. | **40/60/75** |
| R3 OIDC+secret hygiene | 45/70/85 | ✅ | GitHub OIDC docs: short-lived, single-job tokens eliminate the standing-credential class entirely; push protection blocks new leaks at commit time. | 45/70/85 |
| R4 device gating+EDR | 45/65/80 | 🔧 | Picus Blue Report 2025 (160M simulations): 62% average prevention — matches the 65 mode — but only **14% of attacks generated an alert**, so the 80 high assumed a triage capacity a 3-person team doesn't have. | **45/65/75** |
| R5 single revocation point | 40/57/72 | ⚠️ | No quantitative efficacy literature exists for offboarding/IGA bundles. Kept as **labeled expert judgment**; high capped at 70 while access reviews are quarterly. | **40/57/70** |

## Impact bands & costs

All ✅ — the dollar-banded scale survived contact with claims data: NetDiligence 2025 (10,402 SME-heavy claims): typical <$50M-revenue claim ≈ **$142k** (band 3), recovery-involved ≈ $961k, BI-involved ransomware ≈ **$2.1M** (band 4–5); IBM CoDB 2025: customer PII ≈ $160/record (with explicit no-extrapolation caveat), making >$2M clearly plausible for a 500k-record multi-tenant breach (R3 impact 4.4 ✅, ordering ✅). Calibration note adopted into ASSUMPTIONS: anchor company-size expectations on NetDiligence, cite IBM's $4.44M average only as macro context. IBM CoDB **2026** not yet published as of 2026-07-06.

## Pricing (fetched from vendor pages, 2026-07-06)

| Item | We assumed | Verified | Action |
|------|-----------|----------|--------|
| M365 "E5 Security" add-on | ~$12/u/mo | **Renamed**: now sold as **Microsoft Defender Suite**, $12.00/u/mo annual | 🔧 rename line item |
| Entra ID P2 | ~$9 | **$10.00**/u/mo annual (P1 = $7) | 🔧 +$200/mo at 200 users |
| Entra ID Governance add-on | ~$7 | $7.00 ✅ (note: Entra Suite $12 beats P2 $10 + Governance $7 if both wanted) | ✅ |
| Defender for Business | ~$3 | $3.00 ✅ | ✅ |
| Intune Endpoint Privilege Mgmt | ~$3.60 | **$3.00** (still add-on on E3) | 🔧 down |
| GitHub Team / Enterprise | $4 / $21 | $4 / $21 ✅ (annual-billing rates) | ✅ |
| GitHub Secret Protection / Code Security | $19 / $30 per active committer | $19 / $30 ✅ — and **available without Enterprise** (works on Team) | ✅ — R3's SSO-upgrade contingency stands, but secret scanning itself needs no Enterprise uplift |
| Front Door Premium / App Gateway WAF_v2 | ~$330/mo / ~$4–6k/yr | $330/mo base ✅ / ~$330–430/mo ✅ (East US examples) | ✅ |
| Defender for App Service / OSS RDBs | $2–5k/yr bundle | $14.60/instance/mo + ~$15/server/mo ≈ **$44/mo** for this footprint | 🔧 cheaper than assumed |
| FIDO2 keys | $25–55 | YubiKey 5: **$58–85**; budget Security Key series: **$29** | 🔧 two-tier buy |
| Entra auth on Azure PostgreSQL | $0 | $0 ✅ — recommend "Entra-only" mode + managed identities as free hardening | ✅ |

## Threat-source claims (risk register)

All five ✅ with primary sources: Microsoft Security Blog on **Tycoon2FA** at scale (Mar 2026); GitGuardian 2026 + infostealer-market reporting (PAT/cookie harvesting); DBIR 2026 + VulnCheck State of Exploitation 2026 (days-to-exploitation of internet-facing CVEs); DBIR 2026 ransomware/SMB concentration (one secondary figure adjusted in wording); Nudge Security / Wing Security (ex-employee access retention).

## What v1.1 changes in the headline numbers

| | v1.0 (pipeline) | v1.1 (research-calibrated) |
|--|-----------------|---------------------------|
| Aggregate baseline P(≥1 material breach, 12 mo) | 65.7% | **56.7%** |
| Aggregate residual | 25.5% | **20.5%** |
| Reduction | −40.2 pp (−61.2%) | **−36.2 pp (−63.9%)** |
| Biggest marginal lever | R1 −11.7 pp | **R1 −14.8 pp** (even more dominant) |
| Portfolio ROSI | 333% | **258%** (still strongly positive; EAL computed on the triangular mean, not the mode) |
| Top-ranked risk | R3 | R3 (ranking inputs unchanged — likelihood *scores* were band-consistent with the research) |

The v1.1 baseline (56.7%) also lands inside the 35–55%+ ceiling the internal red team argued for — the external research and the internal skeptic converged, which is exactly the behavior you want from two independent checks.

**Residual distrust that remains:** these citations were gathered by AI research agents; URLs and figures were spot-checked for coherence but a human should click through the ~30 sources before board use. Survey-based figures (Proofpoint, Beyond Identity) measure "orgs experiencing ≥1 event," not calibrated per-org probabilities. R5 effectiveness remains expert judgment.
