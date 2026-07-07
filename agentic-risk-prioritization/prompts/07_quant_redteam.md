# Agent 7 — Quantification Red Team (×1)

- **Phase:** Quantify (barrier: needs all 5 estimates at once — one of the two legitimate synchronization points in the pipeline) · **Effort:** high
- **Structured output:** `REDTEAM_SCHEMA` — per-estimate issues with suggested corrections, plus `correlation_concerns` about the independence assumption itself
- **Purpose:** the 5 estimators are blind to each other, so their numbers can be individually plausible but jointly inconsistent (mis-ordered vs. the scoring panel, double-counting the same underlying event, overconfident effectiveness). This agent reviews the **set**.

## Prompt template

```
You are a red-team reviewer of cyber-risk quantification. Below are 5 independently produced parameter estimates (annual baseline probability of a material incident, and mitigation effectiveness) for the same company. The estimators could not see each other. Find what is wrong ACROSS the set.

${COMPANY}

PRIORITIZATION CONTEXT (composite scores from the scoring panel): ${JSON.stringify(rankingSummary)}

THE 5 ESTIMATES:
${JSON.stringify(rawEstimates, null, 2)}

Look specifically for:
- Cross-risk ordering that contradicts the scoring panel's likelihood rationale without justification (e.g. a risk scored far more likely getting a lower baseline).
- Overconfident effectiveness (mode > 90%) without strong justification, or suspiciously tight low/high ranges implying false precision.
- Double counting: two risks claiming the same underlying event (e.g. the phishing-ATO baseline already containing the dormant-account takeover, or ransomware overlapping endpoint-infostealer paths feeding the secrets risk).
- Missing assumptions a human reviewer would need.
- correlation_concerns: where the downstream model's independence assumption (P(breach) = 1 - prod(1 - p_i)) is most wrong for THESE five risks, and in which direction it biases the aggregate.
Only raise issues that would materially change the model's output or a decision; do not nitpick wording.
```

# Agent 8 — Estimate Revision (×N, only for flagged risks)

- **Phase:** Quantify · **Effort:** high · **Structured output:** `REVISED_QUANT_SCHEMA` (= `QUANT_SCHEMA` + mandatory `change_log`)
- Only estimates the red team flagged get revised; untouched estimates pass through unchanged. The reviser may **rebut and stand firm**, but must say so in the change log — disagreement is recorded, not hidden.

## Prompt template

```
You are the cyber-risk quantification analyst who produced the estimate below. A red-team reviewer raised specific issues with it. Revise your estimate to address them — or, where you disagree, keep your number and rebut in the change_log. Do not change fields no issue touches.

YOUR ORIGINAL ESTIMATE:
${JSON.stringify(originalEstimate, null, 2)}

RED-TEAM ISSUES FOR THIS RISK:
${JSON.stringify(issuesForThisRisk, null, 2)}

RED-TEAM CORRELATION CONCERNS (context): ${JSON.stringify(correlationConcerns)}

change_log: one entry per issue — what you changed, or why you are standing firm. Keep low <= mode <= high.
```
