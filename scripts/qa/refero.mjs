#!/usr/bin/env node
/**
 * Refero MCP research helper (Campaign 023).
 *
 * Reads the bearer token from REFERO_MCP_TOKEN, or falls back to the
 * gitignored `.kimi-code/local.toml`. Credentials are never hardcoded here
 * and never committed.
 *
 * Usage:
 *   node scripts/qa/refero.mjs list
 *   node scripts/qa/refero.mjs screens "<query>" [ios|web] [page]
 *   node scripts/qa/refero.mjs styles "<query>" [page]
 *   node scripts/qa/refero.mjs style <style_id> [style_id ...]
 *   node scripts/qa/refero.mjs flows "<query>" [platform] [page]
 *   node scripts/qa/refero.mjs flow <flow_id>
 *   node scripts/qa/refero.mjs similar <screen_id> [limit]
 *   node scripts/qa/refero.mjs image <screen_id> [full]
 */
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_URL = 'https://api.refero.design/mcp';

function readToken() {
  if (process.env.REFERO_MCP_TOKEN) return process.env.REFERO_MCP_TOKEN;
  const localToml = path.join(process.cwd(), '.kimi-code', 'local.toml');
  if (fs.existsSync(localToml)) {
    const m = fs.readFileSync(localToml, 'utf8').match(/Authorization\s*=\s*"Bearer ([^"]+)"/);
    if (m) return m[1];
  }
  throw new Error('Refero token not found: set REFERO_MCP_TOKEN or provide .kimi-code/local.toml');
}

async function rpc(method, params) {
  const res = await fetch(process.env.REFERO_MCP_URL ?? DEFAULT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${readToken()}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  const parsed = JSON.parse(body);
  if (parsed.error) throw new Error(`MCP error: ${parsed.error.message}`);
  return parsed.result;
}

async function callTool(name, args) {
  const result = await rpc('tools/call', { name, arguments: args });
  if (result?.isError) {
    throw new Error(`Tool ${name} failed: ${JSON.stringify(result.content).slice(0, 300)}`);
  }
  const text = (result?.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  if (text) return text;
  if (result?.structuredContent) return JSON.stringify(result.structuredContent, null, 2);
  return JSON.stringify(result, null, 2);
}

const [command, ...rest] = process.argv.slice(2);

const commands = {
  async list() {
    const result = await rpc('tools/list', {});
    for (const tool of result.tools ?? []) console.log(`- ${tool.name}`);
  },
  async screens() {
    console.log(await callTool('refero_search_screens', {
      query: rest[0],
      platform: rest[1] ?? 'ios',
      page: rest[2] ? Number(rest[2]) : undefined,
    }));
  },
  async styles() {
    console.log(await callTool('refero_search_styles', {
      query: rest[0],
      page: rest[1] ? Number(rest[1]) : undefined,
    }));
  },
  async style() {
    console.log(await callTool('refero_get_style', { style_ids: rest }));
  },
  async flows() {
    console.log(await callTool('refero_search_flows', {
      query: rest[0],
      platform: rest[1] ?? 'ios',
      page: rest[2] ? Number(rest[2]) : undefined,
    }));
  },
  async flow() {
    console.log(await callTool('refero_get_flow', { flow_id: rest[0] }));
  },
  async similar() {
    console.log(await callTool('refero_get_similar_screens', {
      screen_id: rest[0],
      limit: rest[1] ? Number(rest[1]) : undefined,
    }));
  },
  async image() {
    console.log(await callTool('refero_get_screen_image', {
      screen_id: rest[0],
      full: rest[1] === 'full',
    }));
  },
};

if (!command || !commands[command]) {
  console.error('Usage: node scripts/qa/refero.mjs <list|screens|styles|style|flows|flow|similar|image> [args]');
  process.exit(1);
}

try {
  await commands[command]();
} catch (error) {
  console.error(`refero helper error: ${error.message}`);
  process.exit(1);
}
