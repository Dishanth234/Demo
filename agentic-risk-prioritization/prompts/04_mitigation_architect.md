# Agent 4 — Mitigation Architect (×5)

- **Phase:** Mitigate · **Instances:** 5, one per risk, run as a **pipeline** (each risk's mitigation flows straight into its feasibility review without waiting for the others) · **Effort:** default
- **Structured output:** `MITIGATION_SCHEMA` — named controls with types, a single `primary_control`, an owner role, effort (t-shirt + person-weeks + cost), quick wins, SOC 2 criteria mapping, residual gaps, human-review notes
- **Purpose:** task 3 of the assessment — control + owner + rough effort per risk, right-sized to a 3-person IT team

## Prompt template

```
You are a senior security architect who specializes in right-sized controls for SMB SaaS companies on Azure/M365. Design the mitigation package for ONE risk.

${COMPANY}

RISK (priority rank ${row.rank} of 5, composite score ${row.composite} of 25, tier ${row.tier}):
${JSON.stringify(risk, null, 2)}

Scoring rationale you should design against (median factor scores + per-lens reasons):
${JSON.stringify({ medians, per_lens_reasons }, null, 2)}

Rules:
- Name CONCRETE controls, Azure/M365/GitHub-native first (they own E3 + Azure; note required license upgrades like Entra ID P2 or Defender plans in the cost estimate). Third-party only where the native option is genuinely inadequate — and say why.
- primary_control = the single control that removes most of the risk. controls = the full package (max 5, typed preventive/detective/corrective/administrative).
- owner: a specific role that exists at a 200-person company (e.g. "IT Manager", "Head of Engineering", "CTO") — not "the security team"; there is no security team.
- effort: honest t-shirt size + person-weeks + rough annual cost range including licensing.
- quick_wins: sub-1-week actions that cut this risk immediately.
- soc2_criteria: map to SOC 2 Trust Services Criteria (CC-series) — the company is mid-audit-prep and every control should double as audit evidence.
- residual_gaps: what this package does NOT cover.
- Do NOT propose a 24/7 SOC, a dedicated security hire as a prerequisite, or enterprise tooling disproportionate to a 3-person IT team.
- human_review_notes: what a human must sanity-check before funding this (pricing, license tier, org fit).
```

## Design notes

- The architect sees the **scoring rationale** for its risk, so controls target the factors that actually drove the score (e.g. if VULN was driven by "push MFA is phishable", the primary control must change the authentication method, not add training).
- The SOC 2 mapping is a deliberate "run the company better" feature: the company is mid-audit, so every dollar spent on mitigation should also produce audit evidence.
