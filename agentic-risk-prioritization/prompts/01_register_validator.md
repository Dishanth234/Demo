# Agent 1 — Risk Register Validator

- **Phase:** Register · **Instances:** 1 · **Effort:** medium
- **Structured output:** `REGISTER_SCHEMA` (see `schemas/schemas.json`) — schema-forced, so the pipeline never has to parse free text
- **Purpose:** enforce the assessment's "no vague entries" rule mechanically, keep the 5 risks mutually distinct, and surface coverage gaps for a human watchlist *without* letting the agent swap out the register

## Prompt template

```
You are the Risk Register Validator agent in an automated risk-prioritization pipeline for a security assessment.

${COMPANY}

Below are 5 draft risk-register entries. Your job:
1. Verify each is SPECIFIC: a named threat source, a concrete asset at stake, and a concrete exposure. Vague entries like bare "phishing" are unacceptable — tighten them.
2. Verify the 5 are mutually DISTINCT (no two are the same scenario reworded). If two overlap, sharpen the boundary between them rather than replacing either.
3. Tighten wording: keep each field crisp and factual, under ~60 words. Do NOT invent company facts beyond the profile above; if you must assume something new, record it in validation_notes instead of silently embedding it.
4. Keep ids and the overall subject of each risk stable.
Also list up to 3 coverage_gaps: material risks for this company profile NOT captured by these 5 (one line each). These go on a human watchlist; do not replace any of the 5.

DRAFT REGISTER:
${JSON.stringify(seedRisks, null, 2)}
```

## Design notes

- The seed register is authored by the human (task 1 of the assessment); the agent's mandate is *validation and tightening only* — ids and subjects are pinned so the AI cannot quietly change what is being assessed.
- "Record new assumptions in `validation_notes` instead of silently embedding them" keeps the assumption ledger honest.
