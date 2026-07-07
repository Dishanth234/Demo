#!/usr/bin/env node
// Local preview server for the Meridian Desk risk tool.
//   node serve.mjs   →   open http://localhost:8900
//
// tool.html and dashboard.html are HTML *fragments* (so they can also be published as
// Claude Artifacts, which supply the document skeleton). This server wraps them in a
// minimal skeleton for standalone local viewing, and serves the rest of the repo statically.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8900;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.css': 'text/css' };
const skel = (frag) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meridian Desk — Agentic Risk Prioritization</title></head><body style="margin:0">${frag}</body></html>`;

createServer((req, res) => {
  try {
    const p = decodeURIComponent((req.url || '/').split('?')[0]);
    if (p === '/' || p === '/tool') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(skel(readFileSync(join(DIR, 'tool.html'), 'utf8'))); return; }
    if (p === '/dashboard') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(skel(readFileSync(join(DIR, 'dashboard.html'), 'utf8'))); return; }
    const safe = normalize(p).replace(/^(\.\.[/\\])+/, '');
    const file = join(DIR, safe);
    if (!file.startsWith(DIR)) { res.writeHead(403); res.end('forbidden'); return; }
    const body = readFileSync(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end('not found: ' + e.message); }
}).listen(PORT, () => console.log(`Meridian Desk risk tool live at http://localhost:${PORT}  (tool: /, dashboard: /dashboard)`));
