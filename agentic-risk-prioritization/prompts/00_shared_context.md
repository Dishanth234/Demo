# Shared context blocks

These two blocks are injected verbatim into every agent prompt that needs them (`${COMPANY}` and `${SCALES}` in the templates). Centralizing them guarantees all agents reason about the *same* company and the *same* scales — the panel's scores are only comparable because of this.

## `${COMPANY}`

```
FIXED SCENARIO + STATED ASSUMPTIONS ("Meridian Desk", fictional):
- 200-employee B2B SaaS, ~$20M ARR, one multi-tenant product storing business records + PII of ~500,000 end users across ~1,200 customer orgs.
- Cloud: single Azure production subscription — App Service, Azure Database for PostgreSQL Flexible Server, Blob Storage (incl. backups). Code on GitHub, CI/CD via GitHub Actions.
- Identity: M365 E3 + Entra ID. MFA = Microsoft Authenticator push (phishable). No Conditional Access device-compliance or authentication-strength policies. ~15 downstream SaaS apps behind Entra SSO.
- Endpoints: remote-first workforce. Intune licensed but only ~60% of laptops enrolled; users are commonly local admins; Microsoft Defender AV on defaults; no EDR monitoring; no SIEM.
- People/process: IT team of 3 (IT Manager + 2 sysadmins), no dedicated security engineer; ~60 engineers. Offboarding is manual/ticket-driven. Contractors hold direct PostgreSQL accounts. Historical .env files/connection strings exist in private repos. Long-lived service-principal secrets with Contributor rights in GitHub Actions. No WAF. SOC 2 Type II program in progress (Type I audit targeted in ~6 months).
```

## `${SCALES}`

```
ORDINAL SCALES (FAIR-lite; use these EXACTLY):
- TEF (Threat Event Frequency: how often attempts/threat events occur against THIS company): 1 = <0.1/yr, 2 = 0.1-1/yr, 3 = 1-10/yr, 4 = 10-100/yr, 5 = >100/yr (near-continuous).
- VULN (Susceptibility: probability an attempt becomes a material incident given CURRENT controls): 1 = <5%, 2 = 5-20%, 3 = 20-45%, 4 = 45-70%, 5 = >70%.
- PRIMARY IMPACT (direct loss: incident response, downtime, recovery, ransom): 1 = <$25k, 2 = $25-100k, 3 = $100-500k, 4 = $500k-2M, 5 = >$2M.
- SECONDARY IMPACT (breach notification, fines, churn, lost deals, SOC 2 setback, reputation): same dollar bands.
Composite (computed downstream by deterministic code, NOT by you): Likelihood L = (TEF+VULN)/2; Impact I = 0.6*PRIMARY + 0.4*SECONDARY; Priority = L x I (range 1-25).
```
