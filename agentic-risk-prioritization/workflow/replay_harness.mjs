#!/usr/bin/env node
/**
 * Replay harness — proves the orchestration logic end-to-end without the agent runtime.
 *
 * The pipeline script (risk_pipeline.workflow.js) normally runs inside the Claude Agent
 * SDK workflow harness, where agent() spawns a live subagent. This shim re-executes the
 * EXACT SAME script with agent() mocked to return the saved outputs/*.json artifacts
 * (resolved by each call's `label`). All deterministic code paths — median aggregation,
 * composite scoring, ranking, tie-breaks, residuals, aggregate, marginal contributions,
 * flag assembly — run for real.
 *
 * It then diffs the replayed ranking and quantification model against the shipped
 * artifacts. PASS means: given the recorded agent outputs, the shipped numbers are
 * exactly reproducible from the orchestration code. Run: node workflow/replay_harness.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const base = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => JSON.parse(readFileSync(join(base, 'outputs', f), 'utf8'));

const register = load('01_risk_register.json');
const scoring = load('02_prioritization_scores.json');
const topRisk = load('03_top_risk_and_challenge.json');
const mitigations = load('04_mitigations.json');
const quant = load('05_quantification.json');
const summary = readFileSync(join(base, 'outputs', '07_executive_summary.md'), 'utf8');

// ---- label -> saved artifact -----------------------------------------------
function resolve(label) {
  if (label === 'register:validate') return register;
  if (label.startsWith('score:')) {
    const sc = scoring.scorecards.find((s) => s.lens === label.slice(6));
    return sc && { risks: sc.risks };
  }
  if (label === 'challenge:likelihood') return topRisk.challenges[0];
  if (label === 'challenge:impact') return topRisk.challenges[1];
  if (label.startsWith('mitigate:')) return mitigations.find((m) => m.risk_id === label.slice(9))?.mitigation;
  if (label.startsWith('feasibility:')) return mitigations.find((m) => m.risk_id === label.slice(12))?.feasibility;
  if (label.startsWith('quant:revise:')) return quant.revised.find((r) => r.risk_id === label.slice(13));
  if (label === 'quant:redteam') return quant.redteam;
  if (label.startsWith('quant:')) return quant.raw_estimates.find((e) => e.risk_id === label.slice(6));
  if (label === 'synthesize:report') return summary;
  throw new Error(`no saved artifact for label ${label}`);
}

// ---- minimal harness shims ---------------------------------------------------
const calls = [];
const agent = async (_prompt, opts = {}) => { calls.push(opts.label); return resolve(opts.label); };
const parallel = (thunks) => Promise.all(thunks.map(async (t) => { try { return await t(); } catch { return null; } }));
const pipeline = async (items, ...stages) =>
  Promise.all(items.map(async (item, i) => {
    let prev = item;
    try { for (const s of stages) prev = await s(prev, item, i); return prev; } catch { return null; }
  }));
const phase = (t) => console.log(`\n-- phase: ${t}`);
const log = (m) => console.log(`   ${m}`);
const args = undefined, budget = { total: null, spent: () => 0, remaining: () => Infinity };

// ---- load the pipeline script, strip `export const meta`, run body ----------
let body = readFileSync(join(base, 'workflow', 'risk_pipeline.workflow.js'), 'utf8');
body = body.replace(/^export const meta[\s\S]*?\n\}\n/, '');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const run = new AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', 'budget', body);
const result = await run(agent, parallel, pipeline, phase, log, args, budget);

// ---- verify against shipped artifacts ---------------------------------------
const diffs = [];
const eq = (name, a, b) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(name);
};
eq('scoring.ranking', result.scoring.ranking, scoring.ranking);
eq('scoring.table', result.scoring.table, scoring.table);
eq('quantification.model', result.quantification.model, quant.model);
eq('quantification.final_estimates', result.quantification.final_estimates, quant.final_estimates);
eq('top_risk.risk_id', result.top_risk.risk_id, topRisk.risk_id);
eq('top_risk.contested', result.top_risk.contested, topRisk.contested);

console.log(`\n${calls.length} agent calls replayed from saved artifacts.`);
if (diffs.length === 0) {
  console.log('PASS — replayed ranking, scoring table, model, final estimates and top-risk verdict are byte-identical to the shipped outputs/.');
} else {
  console.log(`FAIL — mismatches in: ${diffs.join(', ')}`);
  process.exit(1);
}
