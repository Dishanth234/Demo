> **Current bottom line (v1.1 research-calibrated — read this first):** Top risk **R3** (leaked CI/CD & cloud secrets → Azure subscription compromise); biggest single lever **R1** (phishing-resistant MFA). Probability of ≥1 material breach in 12 months: **56.7% → 20.5%** after all five mitigations (−36.2 pp). Expected annual loss: **$2.30M → $1.01M**; portfolio **ROSI ≈ 258%** on ~$362k year-1 spend. Even at residual, there is a **~21% annual chance of a loss exceeding $2M** vs a 10% illustrative board appetite — so pair the program with cyber-insurance risk transfer. Fund **R1 and R3 now.**
>
> **Editorial note:** the numbered figures in the body below are the pipeline's **as-run v1.0** estimates, preserved unmodified as the audit artifact. A research pass then recalibrated the parameters against current primary sources (aggregate baseline 65.7% → 56.7%, residual 25.5% → 20.5%) — see `SOURCES.md`, `ROADMAP.md`, and `outputs/08_advanced_analytics.json`. The ranking and every qualitative conclusion are unchanged; v1.1 strengthens them (R1's lever grows from ~2× to ~4× R3's).

## Executive summary

Meridian Desk's top-ranked risk is R3 — leaked CI/CD and cloud secrets leading to Azure production subscription compromise (composite 17.6, Critical) — driven by long-lived service-principal secrets with Contributor rights sitting in GitHub Actions, though one of two adversarial reviewers dissented on that top ranking. Four further High-tier risks follow closely: AiTM credential phishing (15.3), public web app exploitation (15.2), ransomware via unmanaged endpoints (12.6), and dormant access from offboarding gaps (11.9). Our quantitative model puts the probability of at least one material breach in the next 12 months at 65.7% today; executing all five approved mitigations reduces that to 25.5% — an absolute reduction of 40.2 percentage points (61.2% relative). All five mitigation packages were approved with changes; each is an L-size effort (9–18 person-weeks), with realistic calendar timelines of roughly 4–5 months given a 3-person IT team and no dedicated security engineer. The single highest-leverage move is not the top-ranked risk: phishing-resistant MFA against R1 cuts aggregate breach likelihood by 11.7 points on its own, nearly double R3's 6 points. Leadership should fund R1 and R3 immediately and sequence the rest as capacity allows.

## Priority ranking

| Rank | Risk | Title | Likelihood | Impact | Composite | Tier |
|------|------|-------|------------|--------|-----------|------|
| 1 | R3 | Leaked CI/CD and cloud secrets leading to Azure production subscription compromise | 4 | 4.4 | 17.6 | Critical |
| 2 | R1 | AiTM credential phishing leading to M365/Entra account takeover | 4.5 | 3.4 | 15.3 | High |
| 3 | R2 | Public web app exploitation (SQLi/IDOR/CVE) leading to PostgreSQL customer-data exfiltration | 4 | 3.8 | 15.2 | High |
| 4 | R4 | Ransomware/extortion via unmanaged remote endpoints | 3.5 | 3.6 | 12.6 | High |
| 5 | R5 | Offboarding gaps: dormant employee/contractor access to production data | 3.5 | 3.4 | 11.9 | High |

## What to do first

Ordered by marginal risk reduction per unit of effort (delta to aggregate breach probability vs adjusted person-weeks), not by composite rank:

1. **R1 — Phishing-resistant MFA (passkeys/FIDO2) via Entra Conditional Access authentication strengths.** Best return in the portfolio: 11.7 pp aggregate reduction for 12 person-weeks (~0.98 pp/week). Owner: IT Manager. $40k–58k year 1; expect ~4 months calendar time, not 6 weeks.
2. **R3 — GitHub Actions OIDC federation; delete long-lived secrets, replace subscription-level Contributor with resource-group-scoped RBAC.** 6 pp reduction for 13 person-weeks (~0.46 pp/week), and it addresses the top-ranked Critical risk — the single credential that turns a laptop infection into full production compromise. Owner: Head of Engineering with IT Manager. $15k–32k/yr recurring.
3. **R4 — Conditional Access requiring Intune-compliant devices.** 3.9 pp for 12 person-weeks (~0.33 pp/week), and it is the delivery vehicle for local-admin removal, ASR, and EDR — plus it carries the Intune 60%→95% enrollment work that R1 depends on. Owner: IT Manager, CTO signing enforcement dates. $12k–22k/yr.
4. **R2 — Azure WAF with origin locked to Front Door, plus code security and role hardening.** 5.5 pp but the heaviest lift at 18 person-weeks (~0.31 pp/week), 13–14 of them engineering — the real constraint is engineering capacity, not cash. Owner: Head of Engineering. $45k–75k year 1.
5. **R5 — Entra ID as single revocation point with Lifecycle Workflows leaver automation.** 2.1 pp for 9 person-weeks (~0.23 pp/week) — lowest marginal return, but Phase 1 quick wins are ~1 week and near-zero dollars, so start those immediately. Owner: IT Manager with Head of Engineering. $10k–30k/yr on the phased plan.

## How much safer this makes us

- **Baseline:** 65.7% probability of at least one material breach in 12 months (bounds: 35.8%–91.2%).
- **Residual after all five mitigations:** 25.5% (bounds: 6.3%–65.6%).
- **Net change:** −40.2 percentage points absolute; 61.2% relative reduction.

Per-risk residuals (mode): R3 20%→6%, R1 30%→6%, R2 20%→7%, R4 15%→5.25%, R5 10%→4.3%.

One caveat in plain words: the model treats the five risks as independent, and in reality they are not — a phished account can be the entry point for a secrets leak, and an unmanaged laptop feeds both ransomware and credential theft. The red-team pass documents where this assumption breaks. Because attacks share pathways, the true baseline and the true benefit of overlapping controls both differ from the arithmetic here; treat the mode figures as a planning estimate and the bounds as the honest range.

## Where not to trust this report

This report raised 23 human-review flags (plus 9 cross-estimate red-team issues); after the research pass, **2 remain genuinely open** (the breach-notification materiality assumption, which needs legal counsel, and the structural risk that one 3-person team under-delivers all five packages at once). The rest were worked — see `HUMAN_REVIEW_FLAGS.md`. They clustered around a few themes: a split verdict on whether R3 truly outranks R1 (one of two adversarial reviewers dissented); cost and effort estimates that were revised upward from vendor or proposer claims (e.g., 13 person-weeks vs a claimed 9 on R3, GitHub Enterprise at ~$15k/yr not $12k on R5) and remain uncertain pending licensing decisions; calendar timelines stretched to 4–5 months across several workstreams because of the 3-person IT team and concurrent SOC 2 load; unpriced dependencies such as SaaS SCIM/SSO tier uplifts; and the independence assumption in the quantitative model noted above. Every mitigation was approved only "with changes," so the dollar figures here are ranges, not commitments — leadership should treat the sequencing as robust but the budget numbers as estimates awaiting procurement validation.