#!/usr/bin/env node
/**
 * 076-f helper — stop a running ARTEMIS daemon task by session id.
 *
 * Killing the `artemis run` client does NOT stop the daemon's task: the daemon
 * keeps executing and keeps writing to the session's notes, which both wastes
 * the device and can produce notes long after the sweep moved on. Measured in
 * this campaign: a task killed at 13:50 was still writing its review note at
 * 13:48+ and holding the device, so the next queued game could not start.
 *
 * Usage: node scripts/qa/artemis-stop.mjs <sessionId> [moreIds...]
 */
const BASE = process.env.ARTEMIS_BASE_URL || 'http://127.0.0.1:8000';

async function stop(sessionId) {
  try {
    const res = await fetch(`${BASE}/api/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const body = await res.text();
    let stopped = false;
    try {
      stopped = JSON.parse(body).status === 'stopped';
    } catch {
      stopped = res.status === 200;
    }
    console.log(`${stopped ? 'stopped' : 'not-stopped'} ${sessionId} (HTTP ${res.status}) ${body.slice(0, 120)}`);
    return stopped;
  } catch (e) {
    console.log(`error ${sessionId}: ${e.message}`);
    return false;
  }
}

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('usage: node scripts/qa/artemis-stop.mjs <sessionId> [moreIds...]');
  process.exit(2);
}
const results = await Promise.all(ids.map(stop));
process.exit(results.every(Boolean) ? 0 : 1);
