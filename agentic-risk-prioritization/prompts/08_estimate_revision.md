# Agent 8 — Estimate Revision (×N, only red-team-flagged risks)

- **Phase:** Quantify · **Effort:** high · **Structured output:** `REVISED_QUANT_SCHEMA` (= `QUANT_SCHEMA` + mandatory `change_log`)
- **Purpose:** targeted repair. Only estimates the red team flagged with a single-risk issue get revised; untouched estimates pass through unchanged. The reviser may **rebut and stand firm**, but must say so in the change log — disagreement is recorded, not hidden.
- **Known limitation (by design):** red-team issues tagged to multiple risks (`R3+R5`, `ALL`) don't map to one reviser, so they become human-review flags instead of auto-revisions. Structural problems deserve human eyes, not automated smoothing. In the executed run this meant only R5 was auto-revised (baseline mode 8% → 10%, effectiveness 65% → 57%).

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
