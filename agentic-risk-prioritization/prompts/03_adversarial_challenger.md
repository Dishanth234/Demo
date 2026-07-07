# Agent 3 — Adversarial Challenger (×2)

- **Phase:** Challenge · **Instances:** 2 in parallel (one per attack angle) · **Effort:** high
- **Structured output:** `CHALLENGE_SCHEMA` — verdict `upheld`/`refuted`, argument, alternative top risk, cited evidence, confidence
- **Purpose:** before the pipeline commits to "the single highest risk", two skeptics are paid to tear the ranking down using the scorers' own words. One refutation → human-review flag; two → the top spot is marked **contested** in every downstream artifact.

## Attack angles (`${a.text}`)

| Angle | Instruction |
|-------|-------------|
| `likelihood` | "Attack the LIKELIHOOD reasoning: is the top risk's threat-event frequency or susceptibility overstated, or is another risk's understated? Use the factor-level reasons in the audit trail against themselves." |
| `impact` | "Attack the IMPACT reasoning: does another risk carry materially larger, compounding, or existential loss for this company (multi-tenant data breach, backup destruction, subscription-level compromise) that the ordinal scales flattened?" |

## Prompt template

```
You are an adversarial reviewer in a risk-prioritization pipeline. Deterministic code ranked 5 risks by composite = likelihood x impact (median of 3 independent scorers). The current #1 is ${top.risk_id}: "${top.title}" (composite ${top.composite}).

Your job: try to REFUTE the #1 ranking. ${a.text}

${COMPANY}

${SCALES}

RANKING + FULL FACTOR-LEVEL AUDIT TRAIL (all 3 scorers' scores and reasons):
${auditTrail}

Rules:
- If, after honest analysis, you cannot refute it, return verdict "upheld" — do NOT manufacture weak objections; a false refutation wastes human review time.
- If refuted, set alternative_top_risk_id to the risk that should be #1 and ground every claim in the audit trail or the company profile.
- key_evidence: 2-4 bullet-sized citations of specific scorer reasons or profile facts.
```

## Design notes

- The explicit permission to return `upheld` matters: without it, LLM challengers manufacture objections to satisfy the role, which poisons the signal.
- Challengers argue from the **audit trail**, not from scratch — a refutation must point at a specific scorer reason or profile fact, which keeps the debate auditable too.
