#!/usr/bin/env python3
"""Advanced analytics over the executed pipeline run — v2.

Everything here is deterministic, seeded code operating on the JSON artifacts the
agent pipeline produced — no LLM touches these numbers. Analyses:

1. Deterministic model + Monte Carlo (100k iterations) for TWO parameter sets:
     v1.0 — as produced by the agent pipeline (outputs/05_quantification.json)
     v1.1 — research-calibrated: parameters adjusted per the web-verified findings
            in outputs/09_research_validation.json / SOURCES.md (R2, R3, R5
            baselines lowered; R2 effectiveness trimmed; R4/R5 effectiveness
            high-modes capped). This is the human-review remediation the pipeline's
            own flags demanded.
   Monte Carlo variants:
     - independent draws (matches the deterministic model's assumption)
     - correlated draws: per iteration, ONE Bernoulli(w=0.4) decides whether ALL
       baselines share a single "threat environment" quantile shock (and a second
       Bernoulli whether ALL effectiveness values share an "execution capacity"
       shock). Mixture of comonotonic and independent => pairwise rank corr ~= w.
       (v1 of this script shared shocks per-risk independently, delivering only
       ~w^2 pairwise correlation — bug found by the assessor review and fixed.)
2. One-way sensitivity (tornado) on the aggregate residual, both parameter sets.
3. FAIR-style expected annual loss (EAL) + ROSI per mitigation, both sets.
4. Prioritization-framework sensitivity (assessor-requested):
     - impact-weight sweep: primary weight 0.50 -> 0.70 (policy choice A? in
       ASSUMPTIONS.md) — does the #1 risk survive?
     - mean-vs-median lens aggregation — does the #1 risk survive?
     - near-tie detection: adjacent composite gaps < 0.5 are flagged as noise.

Assumptions (also recorded in output JSON):
- Impact bands -> loss midpoints: band 1 $12.5k, 2 $62.5k, 3 $300k, 4 $1.25M,
  5 $3.0M (open ">$2M" band valued at $3M ~= 15% of ARR — a stated policy choice).
- Loss per event = midpoint(primary median) + midpoint(secondary median).
- Year-1 mitigation cost = cash midpoint of the feasibility-adjusted range
  + person-weeks x $3k fully-loaded internal labor.
- ROSI = (EAL reduction - year-1 cost) / year-1 cost.
"""

import json
import random
import statistics
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SEED = 20260706
N = 100_000
CORR_W = 0.4
LABOR_PER_PW = 3_000
BAND_MID = {1: 12_500, 2: 62_500, 3: 300_000, 4: 1_250_000, 5: 3_000_000}
CASH_MID = {"R3": 23_500, "R1": 49_000, "R2": 60_000, "R4": 17_000, "R5": 20_000}
PERSON_WEEKS = {"R3": 13, "R1": 12, "R2": 18, "R4": 12, "R5": 9}
TIE_EPSILON = 0.5

# v1.1 research-calibrated parameters. Each change cites the verifier finding
# (see SOURCES.md); unchanged values were confirmed by the research pass.
V11 = {
    "R1": {"b": (15, 30, 55), "e": (60, 80, 92),
           "note": "baseline+effectiveness confirmed (Proofpoint ATO 62%/yr; Google security-key study, MSFT)"},
    "R2": {"b": (8, 13, 38), "e": (40, 60, 75),
           "note": "baseline mode 20->13 (DBIR 2026: exploitation surge is edge/VPN-driven, not custom SaaS apps); effectiveness trimmed 45/65/80 -> 40/60/75 (stock CRS ~60% precision; WAF bypass literature)"},
    "R3": {"b": (5, 11, 35), "e": (45, 70, 85),
           "note": "baseline mode 20->11, low 8->5 (GitGuardian 2026: exposure is near-certain but full chain to subscription compromise prices lower); effectiveness confirmed (OIDC eliminates the credential class)"},
    "R4": {"b": (8, 15, 30), "e": (45, 65, 75),
           "note": "baseline confirmed (DBIR 2026 ransomware 48%, 96% of victims SMBs; Coalition claims ~1.5%/yr as floor); effectiveness high capped 80->75 (Picus 2025: only 14% of attacks generate alerts — a 3-person team won't fully operate EDR)"},
    "R5": {"b": (3, 6, 18), "e": (40, 57, 70),
           "note": "baseline mode 10->6, high 22->18 (survey data is lifetime-rate; DBIR privilege-misuse share is single-digit — overrides the internal red team's raise to 10); effectiveness high capped 72->70, labeled expert judgment (no efficacy literature exists)"},
}


def tri_inv(u, a, c, b):
    if b <= a:
        return a
    fc = (c - a) / (b - a)
    if u < fc:
        return a + ((u * (b - a) * (c - a)) ** 0.5)
    return b - (((1 - u) * (b - a) * (b - c)) ** 0.5)


def aggregate(ps):
    prod = 1.0
    for p in ps:
        prod *= 1 - p / 100.0
    return 1 - prod


def pct(xs, q):
    xs = sorted(xs)
    idx = q * (len(xs) - 1)
    lo, hi = int(idx), min(int(idx) + 1, len(xs) - 1)
    frac = idx - lo
    return xs[lo] * (1 - frac) + xs[hi] * frac


def summ(xs):
    return {"mean": round(statistics.fmean(xs), 1), "p5": round(pct(xs, 0.05), 1),
            "p25": round(pct(xs, 0.25), 1), "p50": round(pct(xs, 0.50), 1),
            "p75": round(pct(xs, 0.75), 1), "p95": round(pct(xs, 0.95), 1)}


def deterministic_model(params):
    """Same math as the workflow script: mode-value residuals, bounds, marginals."""
    rows = []
    for rid, p in params.items():
        (bl, bm, bh), (el, em, eh) = p["b"], p["e"]
        rows.append({
            "risk_id": rid,
            "baseline_pct": {"low": bl, "mode": bm, "high": bh},
            "effectiveness_pct": {"low": el, "mode": em, "high": eh},
            "residual_pct": {"low": round(bl * (1 - eh / 100), 2),
                             "mode": round(bm * (1 - em / 100), 2),
                             "high": round(bh * (1 - el / 100), 2)},
        })
    base = aggregate([r["baseline_pct"]["mode"] for r in rows]) * 100
    resid = aggregate([r["residual_pct"]["mode"] for r in rows]) * 100
    marg = []
    for i, r in enumerate(rows):
        ps = [x["residual_pct"]["mode"] if j == i else x["baseline_pct"]["mode"]
              for j, x in enumerate(rows)]
        marg.append({"risk_id": r["risk_id"],
                     "delta_pp_vs_baseline": round(base - aggregate(ps) * 100, 1)})
    return {
        "per_risk": rows,
        "aggregate": {
            "baseline_mode_pct": round(base, 1), "residual_mode_pct": round(resid, 1),
            "absolute_reduction_pp": round(base - resid, 1),
            "relative_reduction_pct": round((base - resid) / base * 100, 1),
            "bounds": {
                "baseline": {"low_pct": round(aggregate([r["baseline_pct"]["low"] for r in rows]) * 100, 1),
                             "high_pct": round(aggregate([r["baseline_pct"]["high"] for r in rows]) * 100, 1)},
                "residual": {"low_pct": round(aggregate([r["residual_pct"]["low"] for r in rows]) * 100, 1),
                             "high_pct": round(aggregate([r["residual_pct"]["high"] for r in rows]) * 100, 1)},
            },
        },
        "marginal_contribution": marg,
    }


def monte_carlo(params, rng):
    out = {}
    items = list(params.values())
    for variant in ("independent", "correlated"):
        base_agg, resid_agg, reduction = [], [], []
        for _ in range(N):
            share_b = variant == "correlated" and rng.random() < CORR_W
            share_e = variant == "correlated" and rng.random() < CORR_W
            u_threat, u_exec = rng.random(), rng.random()
            bs, rs = [], []
            for p in items:
                b = tri_inv(u_threat if share_b else rng.random(), *p["b"])
                e = tri_inv(u_exec if share_e else rng.random(), *p["e"])
                bs.append(b)
                rs.append(b * (1 - e / 100.0))
            ba, ra = aggregate(bs) * 100, aggregate(rs) * 100
            base_agg.append(ba)
            resid_agg.append(ra)
            reduction.append(ba - ra)
        out[variant] = {
            "baseline_agg_pct": summ(base_agg), "residual_agg_pct": summ(resid_agg),
            "reduction_pp": summ(reduction),
            "prob_reduction_ge_30pp": round(sum(1 for x in reduction if x >= 30) / N * 100, 1),
            "prob_residual_le_35pct": round(sum(1 for x in resid_agg if x <= 35) / N * 100, 1),
        }
    return out


def tornado(params):
    def resid_with(overrides):
        ps = []
        for rid, p in params.items():
            b = overrides.get((rid, "b"), p["b"][1])
            e = overrides.get((rid, "e"), p["e"][1])
            ps.append(b * (1 - e / 100.0))
        return aggregate(ps) * 100

    rows = []
    for rid, p in params.items():
        for field, label in (("b", "baseline"), ("e", "effectiveness")):
            lo = resid_with({(rid, field): p[field][0]})
            hi = resid_with({(rid, field): p[field][2]})
            rows.append({"param": f"{rid} {label}", "resid_at_low": round(lo, 1),
                         "resid_at_high": round(hi, 1),
                         "swing_pp": round(abs(hi - lo), 1)})
    rows.sort(key=lambda t: -t["swing_pp"])
    return {"residual_at_all_modes_pct": round(resid_with({}), 1), "params": rows}


def eal_rosi(params, med):
    # Expected annual loss uses the MEAN of each triangular, not the mode (E[X] of a
    # right-skewed triangular exceeds its mode). Baseline probability and effectiveness are
    # INDEPENDENT triangular draws, so E[residual prob] = E[baseline] * E[1 - eff] =
    # mean_b * (1 - mean_e) -- the product of means, NOT a vertex average of the residual's
    # low/mode/high (that pairing overstates the residual by pulling in the high-baseline /
    # low-effectiveness tail; a 1.5M-draw Monte Carlo confirms the product-of-means value).
    rows = []
    for rid, p in params.items():
        loss = BAND_MID[round(med[rid]["primary_impact"])] + BAND_MID[round(med[rid]["secondary_impact"])]
        bl, bm, bh = p["b"]
        el, em, eh = p["e"]
        prob_base_mean = (bl + bm + bh) / 3.0
        eff_mean = (el + em + eh) / 3.0
        resid_mean = prob_base_mean * (1 - eff_mean / 100)
        eal_base = prob_base_mean / 100 * loss
        eal_resid = resid_mean / 100 * loss
        cost = CASH_MID[rid] + PERSON_WEEKS[rid] * LABOR_PER_PW
        avoided = eal_base - eal_resid
        rows.append({"risk_id": rid, "loss_per_event_usd": loss,
                     "eal_baseline_usd": round(eal_base), "eal_residual_usd": round(eal_resid),
                     "eal_avoided_usd": round(avoided), "year1_cost_usd": cost,
                     "rosi_pct": round((avoided - cost) / cost * 100),
                     "payback_ratio": round(avoided / cost, 1)})
    rows.sort(key=lambda x: -x["rosi_pct"])
    port = {"eal_baseline_usd": sum(e["eal_baseline_usd"] for e in rows),
            "eal_residual_usd": sum(e["eal_residual_usd"] for e in rows),
            "eal_avoided_usd": sum(e["eal_avoided_usd"] for e in rows),
            "year1_cost_usd": sum(e["year1_cost_usd"] for e in rows)}
    port["eal_basis"] = "EAL = E[annual prob] x severity. Baseline prob = triangular mean (bl+bm+bh)/3; residual prob = mean_b * (1 - mean_e) (product of independent means, NOT a vertex average); severity = blended impact-band midpoint (point). Portfolio EAL = sum of per-risk EAL (exact for expectations regardless of correlation)."
    port["rosi_pct"] = round((port["eal_avoided_usd"] - port["year1_cost_usd"]) / port["year1_cost_usd"] * 100)
    return {"per_risk": rows, "portfolio": port}


def loss_exceedance(params, med, rng):
    # Board-grade loss-exceedance curve (LEC): a Monte Carlo over WHICH risks materialize in a
    # year and how large each loss is. Occurrence ~ Bernoulli(annual prob, sampled per iteration
    # from the risk's baseline/residual triangular). Severity ~ blended band-midpoint x a stated
    # triangular multiplier (0.5, 1.0, 2.5) capturing the fat right tail the breach-cost research
    # documents (NetDiligence: typical loss modest, tail into the millions). Curve = P(annual
    # loss > threshold), baseline vs residual. This drives the risk-appetite check ONLY; the EAL
    # point estimate above uses expected severity (multiplier mean ~1.33 is NOT applied there, so
    # EAL stays conservative and the two views are labeled distinctly).
    items = [(rid, p, BAND_MID[round(med[rid]["primary_impact"])] + BAND_MID[round(med[rid]["secondary_impact"])])
             for rid, p in params.items()]
    thresholds = [100_000, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000]
    out = {}
    for variant, use_resid in (("baseline", False), ("residual", True)):
        losses = []
        for _ in range(N):
            total = 0.0
            for rid, p, sev_mid in items:
                bl, bm, bh = p["b"]
                el, em, eh = p["e"]
                prob = tri_inv(rng.random(), bl, bm, bh)
                if use_resid:
                    eff = tri_inv(rng.random(), el, em, eh)
                    prob = prob * (1 - eff / 100)
                if rng.random() < prob / 100:
                    total += sev_mid * tri_inv(rng.random(), 0.5, 1.0, 2.5)
            losses.append(total)
        out[variant] = {
            "mean_usd": round(statistics.fmean(losses)),
            "p50_usd": round(pct(losses, 0.50)), "p90_usd": round(pct(losses, 0.90)),
            "p95_usd": round(pct(losses, 0.95)), "p99_usd": round(pct(losses, 0.99)),
            "exceedance": {f"gt_{t}": round(sum(1 for x in losses if x > t) / N * 100, 1) for t in thresholds},
        }
    appetite = {"statement": "Illustrative board risk appetite: <=10% annual probability of a loss event exceeding $2,000,000.",
                "threshold_usd": 2_000_000, "max_tolerated_prob_pct": 10.0,
                "baseline_prob_gt_threshold_pct": out["baseline"]["exceedance"]["gt_2000000"],
                "residual_prob_gt_threshold_pct": out["residual"]["exceedance"]["gt_2000000"]}
    appetite["baseline_within_appetite"] = appetite["baseline_prob_gt_threshold_pct"] <= appetite["max_tolerated_prob_pct"]
    appetite["residual_within_appetite"] = appetite["residual_prob_gt_threshold_pct"] <= appetite["max_tolerated_prob_pct"]
    return {"thresholds_usd": thresholds, "curves": out, "risk_appetite": appetite}


def framework_sensitivity(scoring):
    med = {r["risk_id"]: r["medians"] for r in scoring["table"]}
    like = {rid: (m["tef"] + m["vuln"]) / 2 for rid, m in med.items()}

    def rank_at(w):
        comp = {rid: round(like[rid] * (w * m["primary_impact"] + (1 - w) * m["secondary_impact"]), 2)
                for rid, m in med.items()}
        order = sorted(comp, key=lambda r: -comp[r])
        return order, comp

    sweep = []
    for w in (0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70):
        order, comp = rank_at(w)
        sweep.append({"primary_weight": w, "ranking": order,
                      "composites": {r: comp[r] for r in order}})
    top_stable = len({s["ranking"][0] for s in sweep}) == 1
    top_at_secondary_dominant = sorted(
        {s["ranking"][0] for s in sweep if s["primary_weight"] <= 0.40})

    # mean-vs-median lens aggregation
    per_lens = {}
    for card in scoring["scorecards"]:
        for r in card["risks"]:
            per_lens.setdefault(r["risk_id"], []).append(r)
    mean_comp = {}
    for rid, rows in per_lens.items():
        t = statistics.fmean(x["tef"] for x in rows)
        v = statistics.fmean(x["vuln"] for x in rows)
        p = statistics.fmean(x["primary_impact"] for x in rows)
        s = statistics.fmean(x["secondary_impact"] for x in rows)
        mean_comp[rid] = round(((t + v) / 2) * (0.6 * p + 0.4 * s), 2)
    mean_order = sorted(mean_comp, key=lambda r: -mean_comp[r])

    # near-tie detection on the shipped (median, 60/40) ranking
    shipped = sorted(({"risk_id": r["risk_id"], "composite": r["composite"]}
                      for r in scoring["table"]), key=lambda x: -x["composite"])
    ties = []
    for a, b in zip(shipped, shipped[1:]):
        gap = round(a["composite"] - b["composite"], 2)
        if gap < TIE_EPSILON:
            ties.append({"pair": [a["risk_id"], b["risk_id"]], "gap": gap,
                         "flag": "ordering between these two is noise — treat as tied for decisions"})
    return {
        "impact_weight_sweep": sweep,
        "top_risk_stable_across_sweep": top_stable,
        "sweep_range": "primary impact weight 0.30 (secondary-dominant) to 0.70 (primary-dominant)",
        "top_risk_at_secondary_dominant_weights": top_at_secondary_dominant,
        "mean_aggregation_ranking": mean_order,
        "mean_aggregation_composites": mean_comp,
        "top_risk_stable_mean_vs_median": mean_order[0] == shipped[0]["risk_id"],
        "near_ties_epsilon": TIE_EPSILON,
        "near_ties": ties,
    }


def main():
    q = json.load(open(BASE / "outputs/05_quantification.json"))
    scoring = json.load(open(BASE / "outputs/02_prioritization_scores.json"))
    med = {r["risk_id"]: r["medians"] for r in scoring["table"]}

    v10 = {}
    for r in q["model"]["per_risk"]:
        v10[r["risk_id"]] = {
            "b": (r["baseline_pct"]["low"], r["baseline_pct"]["mode"], r["baseline_pct"]["high"]),
            "e": (r["effectiveness_pct"]["low"], r["effectiveness_pct"]["mode"], r["effectiveness_pct"]["high"]),
            "note": "as produced by the agent pipeline (post internal red-team)",
        }

    versions = {}
    for name, params in (("v1.0_pipeline", v10), ("v1.1_research_calibrated", V11)):
        rng = random.Random(SEED)  # reseed per version so each model's MC is independent & reproducible
        versions[name] = {
            "parameter_notes": {rid: p["note"] for rid, p in params.items()},
            "deterministic": deterministic_model(params),
            "monte_carlo": monte_carlo(params, rng),
            "tornado_on_aggregate_residual": tornado(params),
            "eal_rosi": eal_rosi(params, med),
            "loss_exceedance": loss_exceedance(params, med, rng),
        }

    out = {
        "_provenance": "Deterministic code (workflow/advanced_analytics.py v2, seed 20260706) over outputs/05_quantification.json (v1.0) and the research-calibrated parameters documented in SOURCES.md (v1.1). No LLM produced any number in this file.",
        "assumptions": {
            "distributions": "Triangular(low, mode, high) per parameter; 100k iterations per variant",
            "correlated_variant": f"per-iteration Bernoulli({CORR_W}): with prob {CORR_W} ALL baselines share one 'threat environment' quantile shock (second Bernoulli for ALL effectiveness values sharing an 'execution capacity' shock); mixture of comonotonic and independent gives pairwise rank corr ~= {CORR_W}. v1 of this script shared shocks per-risk independently (~{CORR_W ** 2:.2f} pairwise) — assessor-caught bug, fixed",
            "loss_bands_usd_midpoints": BAND_MID,
            "open_band_5_valued_at": "3,000,000 (~15% of ARR) — stated policy choice for the '>$2M' band",
            "loss_per_event": "midpoint(primary impact median) + midpoint(secondary impact median)",
            "labor_cost_per_person_week_usd": LABOR_PER_PW,
            "year1_cost": "cash midpoint of feasibility-adjusted range + person-weeks x labor rate",
            "rosi": "(EAL avoided - year-1 cost) / year-1 cost; EAL on triangular MEAN probability x expected severity (v1 used mode, understating EAL ~14% -- fixed)",
            "loss_exceedance": "separate MC over risk occurrence x severity; severity = band midpoint x triangular(0.5, 1.0, 2.5) tail multiplier; drives the risk-appetite check only, not the EAL point",
        },
        "versions": versions,
        "framework_sensitivity": framework_sensitivity(scoring),
    }
    dest = BASE / "outputs/08_advanced_analytics.json"
    json.dump(out, open(dest, "w"), indent=2)
    print(f"wrote {dest}")

    for name, v in versions.items():
        a = v["deterministic"]["aggregate"]
        mc = v["monte_carlo"]
        print(f"\n== {name} ==")
        print(f" deterministic: {a['baseline_mode_pct']}% -> {a['residual_mode_pct']}% (-{a['absolute_reduction_pp']}pp, -{a['relative_reduction_pct']}%)")
        print(f" marginals: {[(m['risk_id'], m['delta_pp_vs_baseline']) for m in v['deterministic']['marginal_contribution']]}")
        print(f" MC indep reduction p5/p50/p95: {mc['independent']['reduction_pp']['p5']}/{mc['independent']['reduction_pp']['p50']}/{mc['independent']['reduction_pp']['p95']}pp")
        print(f" MC corr  residual p5/p50/p95: {mc['correlated']['residual_agg_pct']['p5']}/{mc['correlated']['residual_agg_pct']['p50']}/{mc['correlated']['residual_agg_pct']['p95']}%")
        print(f" tornado top3: {[(t['param'], t['swing_pp']) for t in v['tornado_on_aggregate_residual']['params'][:3]]}")
        pf = v['eal_rosi']['portfolio']
        print(f" EAL: ${pf['eal_baseline_usd']:,} -> ${pf['eal_residual_usd']:,} | ROSI {pf['rosi_pct']}% | per-risk {[(e['risk_id'], e['rosi_pct']) for e in v['eal_rosi']['per_risk']]}")
        ap = v['loss_exceedance']['risk_appetite']
        print(f" LEC P(loss>$2M): baseline {ap['baseline_prob_gt_threshold_pct']}% -> residual {ap['residual_prob_gt_threshold_pct']}% (appetite <=10%: base {'OK' if ap['baseline_within_appetite'] else 'BREACH'}, resid {'OK' if ap['residual_within_appetite'] else 'BREACH'})")

    fs = out["framework_sensitivity"]
    print(f"\n framework: top stable across full sweep (0.30-0.70): {fs['top_risk_stable_across_sweep']}; top at secondary-dominant (<=0.40): {fs['top_risk_at_secondary_dominant_weights']}; mean-vs-median stable: {fs['top_risk_stable_mean_vs_median']}; near-ties: {fs['near_ties']}")
    print(f" weight sweep: {[(s['primary_weight'], '>'.join(s['ranking'])) for s in fs['impact_weight_sweep']]}")


if __name__ == "__main__":
    main()
