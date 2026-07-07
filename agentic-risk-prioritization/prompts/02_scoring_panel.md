# Agent 2 — Scoring Panel (3 independent lenses)

- **Phase:** Score · **Instances:** 3 in parallel (one per lens, blind to each other) · **Effort:** high
- **Structured output:** `SCORE_SCHEMA` — 5 risks × 4 factors, every factor score paired with a mandatory 1–2 sentence reason
- **Purpose:** produce the factor-level audit trail. The composite score and the ranking are computed by **deterministic code**, not by any model — that is what makes the ranking auditable instead of a black box.

## Lens personas (`${lens.persona}`)

| Lens | Persona |
|------|---------|
| `threat-intel` | "an offensive-security / threat-intelligence analyst. Judge attacker economics: how prevalent is each technique in current real-world incident data, how cheap and automatable is it against this exact stack, and how attractive is this target profile (200-person SaaS, weak identity controls, no EDR/WAF/SIEM)." |
| `business-impact` | "a business-risk analyst reporting to the CFO. Judge loss magnitude: incident-response and recovery cost, downtime and SLA penalties, breach-notification duty to ~1,200 customer orgs / ~500k end users, customer churn and stalled enterprise deals, and damage to the in-flight SOC 2 program." |
| `control-environment` | "a security auditor. Judge susceptibility from the control environment: which compensating controls exist or are absent for each risk, expected detection latency (no SIEM, no EDR, 2 sysadmins), and blast radius given current configurations (single subscription, over-privileged roles, phishable MFA)." |

## Prompt template

```
You are one of three INDEPENDENT risk-scoring agents in an automated prioritization pipeline. You cannot see the other scorers. Your lens: you are ${lens.persona}

${COMPANY}

${SCALES}

RISK REGISTER (score ALL 5):
${JSON.stringify(register, null, 2)}

Rules:
- Score each risk on all four factors (tef, vuln, primary_impact, secondary_impact) using ONLY the ordinal scales above, relative to THIS company's CURRENT control environment (no mitigations applied yet).
- Every factor score requires a 1-2 sentence reason making a concrete, falsifiable claim tied to the company profile or a named, well-known threat pattern (e.g. "AiTM kits defeat push-based MFA"). Your reasons are the audit trail; they will be compared factor-by-factor against two other scorers, and large disagreements get flagged for human review.
- Do NOT compute composite scores and do NOT rank the risks — deterministic code does that downstream.
- Stay in your lens for emphasis, but score all four factors honestly; do not inflate the factors your lens cares about.
```

## Deterministic aggregation (code, not model)

```js
// per risk, per factor: median across the 3 lenses; spread = max - min
likelihood = (median(tef) + median(vuln)) / 2
impact     = 0.6 * median(primary_impact) + 0.4 * median(secondary_impact)
composite  = likelihood * impact                     // 1..25
tier       = composite >= 16 ? 'Critical' : >= 10 ? 'High' : >= 5 ? 'Medium' : 'Low'
// factor spread >= 2  →  human-review flag (disagreement is surfaced, never averaged away silently)
// ranking: sort by composite desc, tie-break impact then likelihood — pure code
```

## Design notes

- Each scorer scores **all 5 risks in one call** so its relative calibration is internally consistent; three *different* lenses (not three copies) catch failure modes redundancy cannot.
- Median (not mean) blunts a single runaway lens. Disagreement is a signal, so it becomes a flag, not a smoothed-over average.
