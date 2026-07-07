# Implementation Roadmap, KRIs & Framework Mappings

Operational layer on top of the assessment: what to do in what order (consolidated from the five IT-feasibility reviews), how to *measure* that risk is actually falling (KRIs with native Azure/M365 data sources), and how the work maps to MITRE ATT&CK and SOC 2 evidence.

## Sequencing — one plan from five feasibility reviews

The feasibility agents each produced a `sequencing_note`; consolidated, they agree on three waves. Effort assumes the 3-person IT team plus borrowed engineering, with SOC 2 prep already consuming ~20% of IT capacity — which is why calendar time ≫ person-weeks.

```mermaid
gantt
    dateFormat  YYYY-MM-DD
    axisFormat  %b
    title Waves (calendar-realistic, not person-week-optimistic)
    section Wave 0 — quick wins (all risks)
    28 quick wins: revoke historical secrets, push protection, contractor DB cleanup, break-glass accounts, CA report-only :w0, 2026-07-13, 21d
    section Wave 1 — identity & secrets
    R1 passkeys/FIDO2 rollout + CA auth strengths (IT Manager)      :w1a, 2026-07-27, 120d
    R3 OIDC federation + secret triage + scoped RBAC (Head of Eng)  :w1b, 2026-07-27, 100d
    section Wave 2 — endpoints & app (shared CA change window with R1)
    R4 Intune to ~100% + compliant-device CA + EDR + local-admin removal :w2a, 2026-09-14, 135d
    R2 WAF detection→prevention + CodeQL/Dependabot gates + RLS phase 1  :w2b, 2026-09-28, 130d
    section Wave 3 — lifecycle
    R5 Entra auth on Postgres + SCIM priority apps + leaver automation + access reviews :w3, 2026-11-02, 120d
    section Milestones
    SOC 2 Type I audit window :milestone, 2027-01-04, 0d
```

**30 / 60 / 90-day cut:**

- **Day 0–30:** all Wave-0 quick wins (each is < 1 week, most are < 1 day); R1 passkey pilot (IT + finance + admins); R3 OIDC on one deployment pipeline as proof; buy FIDO2 keys; CA policies in report-only.
- **Day 30–60:** R1 passkey waves for all staff; R3 secret-history triage + push protection org-wide; R4 Intune enrollment push begins; R2 WAF deployed in Detection mode.
- **Day 60–90:** R1 CA auth-strength enforcement for admins → all users; R3 delete last long-lived SP secret, scope RBAC; R2 WAF to Prevention on tuned rules; R4 EDR onboarding; R5 Phase-1 (contractor Postgres cleanup done in Wave 0, Entra-auth migration design starts).

Two constraints the feasibility reviewers insisted on: **R1 and R4 share one Conditional Access change window** (both touch every user's sign-in; two separate disruption events would double helpdesk surge), and **R5's contractor-Postgres cleanup does not wait for its wave** — it is days of work closing a live hole, so it runs in Wave 0.

## Key Risk Indicators — measuring that risk is actually falling

Each KRI is measurable from tooling the company will own after the mitigations land (no SIEM required). Review monthly at the IT/Eng sync; each KRI names the accountable owner.

| Risk | KRI | Source | Target | Owner |
|------|-----|--------|--------|-------|
| R1 | % staff with a phishing-resistant method registered | Entra authentication-methods activity report | ≥ 95% by day 90 | IT Manager |
| R1 | Risky sign-ins (AiTM-pattern / anomalous token) per month | Entra ID Protection risk detections | Investigated ≤ 48h, trend ↓ | IT Manager |
| R2 | WAF: % traffic on Prevention mode; critical rule hits | Front Door / App Gateway WAF logs → Log Analytics | 100% Prevention by day 90 | Head of Eng |
| R2 | Critical/high code+dependency alerts open > 14 days | GitHub code scanning / Dependabot dashboards | 0 past SLA | Head of Eng |
| R3 | Long-lived service-principal client secrets in tenant | Entra app-registration credentials report | **0** (all OIDC/managed identity) | Head of Eng |
| R3 | Secret-scanning alerts open > 7 days; push-protection bypasses | GitHub Secret Protection dashboard | 0 past SLA; bypasses reviewed weekly | Head of Eng |
| R4 | Intune enrollment %; devices with EDR onboarded % | Intune + Defender for Business portals | ≥ 95% / ≥ 95% by day 120 | IT Manager |
| R4 | Users with standing local-admin rights | Intune / EPM report | ≤ 10 exception-listed | IT Manager |
| R5 | Accounts disabled within 24h of termination (leaver SLA) | Entra sign-in logs + HR leaver list reconciliation | 100% | IT Manager |
| R5 | Non-Entra PostgreSQL roles; accounts with no sign-in > 30 days | `pg_roles` audit + Entra inactive-user report | 0 standing local DB roles; dormant reviewed monthly | Head of Eng / IT |

## MITRE ATT&CK mapping

Technique IDs verified against live attack.mitre.org pages (Enterprise **v19.1**, pages last modified 2026-05-12; none deprecated) — raw findings in [outputs/09_research_validation.json](outputs/09_research_validation.json). The database-collection step in R2/R5 maps to **[T1213.006](https://attack.mitre.org/techniques/T1213/006/) (Data from Information Repositories: Databases)** — a sub-technique created 2025-05-22 whose description explicitly names PostgreSQL and Azure SQL Database (a prior pass had wrongly dropped it claiming "no precise technique exists"; verified live and corrected here). R3's **[T1213.003](https://attack.mitre.org/techniques/T1213/003/) (Code Repositories)** is the right fit for repo-resident secrets and stays. Each KRI above watches a stage of one of these chains.

| Risk | Kill chain (ATT&CK Enterprise v19.1) |
|------|--------------------------------------|
| R1 | [T1566.002](https://attack.mitre.org/techniques/T1566/002/) Spearphishing Link → [T1557](https://attack.mitre.org/techniques/T1557/) Adversary-in-the-Middle → [T1539](https://attack.mitre.org/techniques/T1539/) Steal Web Session Cookie → [T1550.004](https://attack.mitre.org/techniques/T1550/004/) Use Alternate Auth Material: Web Session Cookie → [T1078.004](https://attack.mitre.org/techniques/T1078/004/) Valid Accounts: Cloud |
| R2 | [T1190](https://attack.mitre.org/techniques/T1190/) Exploit Public-Facing Application → [T1505.003](https://attack.mitre.org/techniques/T1505/003/) Web Shell → [T1213.006](https://attack.mitre.org/techniques/T1213/006/) Data from Information Repositories: Databases → [T1048.002](https://attack.mitre.org/techniques/T1048/002/) Exfiltration Over Asymmetric Encrypted Non-C2 Protocol |
| R3 | [T1552.001](https://attack.mitre.org/techniques/T1552/001/) Credentials In Files + [T1213.003](https://attack.mitre.org/techniques/T1213/003/) Code Repositories → [T1078.004](https://attack.mitre.org/techniques/T1078/004/) Valid Accounts: Cloud → [T1098.001](https://attack.mitre.org/techniques/T1098/001/) Additional Cloud Credentials (persistence) → [T1530](https://attack.mitre.org/techniques/T1530/) Data from Cloud Storage |
| R4 | [T1204.002](https://attack.mitre.org/techniques/T1204/002/) User Execution: Malicious File → [T1548.002](https://attack.mitre.org/techniques/T1548/002/) Bypass UAC → [T1555.003](https://attack.mitre.org/techniques/T1555/003/) Credentials from Web Browsers + [T1528](https://attack.mitre.org/techniques/T1528/) Steal Application Access Token → [T1486](https://attack.mitre.org/techniques/T1486/) Data Encrypted for Impact |
| R5 | [T1078.004](https://attack.mitre.org/techniques/T1078/004/) Valid Accounts: Cloud + [T1133](https://attack.mitre.org/techniques/T1133/) External Remote Services (direct Postgres logins) → [T1213.006](https://attack.mitre.org/techniques/T1213/006/) Data from Information Repositories: Databases → [T1048.002](https://attack.mitre.org/techniques/T1048/002/) Exfiltration Over Asymmetric Encrypted Non-C2 Protocol |

## SOC 2 evidence matrix

The mitigation agents' CC mappings were **audited against the AICPA TSC text** (2017 criteria incl. 2022 points of focus) by the research pass, which found two misfits and three gaps — corrected below. ✔ = verified fit; struck-through = dropped after audit.

| Criterion | R1 MFA | R2 AppSec | R3 Secrets | R4 Endpoints | R5 Offboarding | Evidence the control produces |
|-----------|:------:|:---------:|:----------:|:------------:|:--------------:|-------------------------------|
| CC6.1 logical access architecture | ✔ | ✔ | ✔ | ✔ | ✔ | CA policies, RLS design, Key Vault config, Entra-auth-only Postgres |
| CC6.2 credential issue/removal | | | ✔ | | ✔ **(the leaver criterion)** | OIDC federation config; leaver-workflow logs, disabled-account reports |
| CC6.3 role-based least privilege | | ✔ *(added — RLS is role-based access)* | ✔ | | ✔ | scoped RBAC assignments, access-review sign-offs |
| CC6.6 boundary / external-access protection | ✔ | ✔ | ✔ *(partial — credential-protection PoF)* | ✔ | | WAF policy, CA auth-strength policy, device-compliance policy |
| ~~CC6.7~~ | ~~R1~~ *(dropped — CC6.7 governs data transmission/removal, not authentication)* | | | | | — |
| CC6.8 unauthorized/malicious software | | | | ✔ *(exact anchor)* | | EDR deployment report, local-admin removal evidence |
| CC7.1 vuln detection & config monitoring | | ✔ | ✔ | | | CodeQL/Dependabot gates, secret-scanning alerts, pen-test report |
| CC7.2 security-event monitoring | ✔* | ✔* | ✔* | ✔ | ✔* | *needs the companion monitoring control (Identity Protection alerts, WAF logs, dormant-account alerts) — flagged; KRIs above supply it |
| CC7.4 / CC7.5 incident response & recovery | ✔* | ✔* | ✔* | ✔ *(recovery via R3's immutable backups + OneDrive restore — cross-referenced)* | | *defensible only once the IR runbook exists — added to Wave 1 as an explicit deliverable |
| CC8.1 change management | | ✔ | ✔ | | | branch protection + CI gate configs |
| ~~CC9.2~~ | | | | | ~~R5~~ *(dropped — CC9.2 is vendor/business-partner risk; keep only for vendor-engaged contractors)* | — |
| A1.2 backup & recovery infrastructure | | | ✔ | | | immutable backup configuration |
| A1.3 recovery-plan **testing** | | | ✔ *(added — claiming backups without restore testing is a classic Type I gap)* | | | documented restore-test results |

Net effect of the audit: two criteria dropped, two added, and one honest condition made explicit — the CC7.x rows only hold if the monitoring/IR runbook work (already in the KRI table and Wave 1) actually ships. Auditors respect trimmed claims more than padded ones.

> **Note on source artifacts:** the raw per-mitigation `soc2_criteria` arrays in [outputs/04_mitigations.json](outputs/04_mitigations.json) hold the mitigation agents' **pre-audit** mappings (still listing R1→CC6.7 and R5→CC9.2). This matrix is the authoritative post-audit set; the JSON is preserved unedited as the as-run agent output so the correction is visible rather than silently overwritten.

## Free identity quick wins the research pass flagged (R1)

The R1 mitigation centers on phishing-resistant MFA, but the research pass ([SOURCES.md](SOURCES.md), [outputs/09](outputs/09_research_validation.json)) noted that passkeys are bypassable via two channels that don't touch the authentication method — so both of these **$0, E3-native** Conditional Access changes ship inside the R1 package as day-one quick wins:

1. **Block the OAuth 2.0 device-code authorization-grant flow** via a Conditional Access policy — closes the Storm-2372 device-code phishing path that harvests tokens without ever prompting for the passkey.
2. **Restrict user app-consent** to verified publishers / low-impact permissions with an admin-consent request workflow — closes illicit-consent-grant phishing, where a user is tricked into authorizing a malicious app instead of entering credentials.

Neither costs a license; both are policy toggles in Entra, and both produce CC6.6 / CC7.2 evidence.

## Coverage gap on the watchlist: third-party / vendor breach (R6 candidate)

The validator's coverage-gap list and the dropped **CC9.2** (vendor/business-partner risk) point at the same untracked exposure: Meridian Desk resells through ~15 downstream SSO/SaaS apps, any of which could be breached and expose customer data with no entry in the top-5 register. Rather than dilute the tight 5-risk analysis by force-fitting a 6th, it goes on the watchlist as **R6-candidate (third-party risk management)** with one starter KRI so it is *tracked*, not forgotten:

| KRI | Source | Target | Owner |
|-----|--------|--------|-------|
| % of the ~15 SSO-connected vendors with a current SOC 2 (or ISO 27001) report on file | vendor register / security questionnaire responses | ≥ 90% before Type II window | IT Manager |
