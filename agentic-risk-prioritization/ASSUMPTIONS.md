# Stated Assumptions

## Company profile ("Meridian Desk", fictional)

| # | Assumption | Why it matters |
|---|------------|----------------|
| A1 | ~$20M ARR B2B SaaS; one multi-tenant product | Sets the dollar bands of the impact scales |
| A2 | Product stores business records + PII of ~500,000 end users across ~1,200 customer orgs | Drives breach-notification scope and secondary impact |
| A3 | Single Azure production subscription: App Service, Azure Database for PostgreSQL Flexible Server, Blob Storage (incl. backups) | Single subscription = large blast radius for R3 |
| A4 | Code on GitHub, CI/CD via GitHub Actions | Attack surface for R3 |
| A5 | M365 E3 + Entra ID; MFA = Microsoft Authenticator push (phishable); no Conditional Access device-compliance or authentication-strength policies; ~15 SaaS apps behind Entra SSO | Makes R1 concrete: push MFA is defeated by AiTM kits |
| A6 | Intune licensed but ~60% laptop enrollment; users commonly local admins; Defender AV defaults; no EDR monitoring; no SIEM | Drives R4 susceptibility and detection latency everywhere |
| A7 | IT team of 3 (IT Manager + 2 sysadmins), no dedicated security engineer; ~60 engineers | Constrains every mitigation's feasibility |
| A8 | Offboarding manual/ticket-driven; contractors hold direct PostgreSQL accounts; shared service accounts, no rotation, no access recertification | Makes R5 concrete |
| A9 | Historical .env files / connection strings in private repos; long-lived service-principal secrets with Contributor rights; no secret scanning; Key Vault inconsistent | Makes R3 concrete |
| A10 | No WAF in front of the public app; app uses a single high-privilege DB role; no security code-review/DAST gate | Makes R2 concrete |
| A11 | SOC 2 Type II program in progress; Type I audit targeted in ~6 months; audit prep already consumes ~20% of IT time | Constrains sequencing; every control doubles as audit evidence |

## Modeling assumptions (quantification)

| # | Assumption | Direction of error if wrong |
|---|------------|------------------------------|
| M1 | "Material incident" = an event triggering IR cost > $25k or a breach-notification duty | Looser definition → higher baselines |
| M2 | The five risks are treated as **independent** in the aggregate formula `P(≥1 breach) = 1 − Π(1 − pᵢ)` | Risks are positively correlated (shared weak identity layer, shared endpoints); the red-team pass documents this. Correlation makes the true baseline aggregate somewhat **lower** than computed and the residual somewhat **higher** (one control failing can re-open multiple paths) |
| M3 | 12-month horizon; mitigations assumed fully implemented **and operated** for the full year | Partial-year rollout → less reduction than modeled |
| M4 | Baseline and effectiveness parameters are LLM estimates anchored to industry patterns from model memory (DBIR-style vector prevalence, SMB incident rates) | **Least trustworthy artifact in the pipeline.** Must be validated by a human against current report editions and the company's own telemetry |
| M5 | Point arithmetic uses mode values; low/high bounds are propagated separately (best case = low baseline × high effectiveness; worst case = high baseline × low effectiveness) | Bounds are scenario bounds, not confidence intervals — no distribution is claimed |
| M6 | Effectiveness includes coverage loss (e.g. FIDO2 reaching ~90% of staff, not 100%) and operational drift | Assuming perfect coverage would overstate reduction |

## Framework assumptions (prioritization)

- FAIR-lite ordinal scales: TEF (threat-event frequency) and VULN (susceptibility) proxy likelihood; PRIMARY/SECONDARY impact proxies loss magnitude in dollar bands calibrated to a ~$20M ARR company.
- Composite = `L × I` where `L = (TEF+VULN)/2` and `I = 0.6·PRIMARY + 0.4·SECONDARY`. The 60/40 weighting expresses that direct loss is more certain than secondary loss; it is a policy choice a human should ratify.
- Median across 3 scorers (not mean) so a single outlier lens cannot drag a score; factor-level spread ≥ 2 is flagged for human adjudication instead of being silently averaged away.
