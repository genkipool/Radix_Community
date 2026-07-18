/**
 * Minimal MCP stdio driver for the local radix-connector-mcp.
 *
 * Usage: node scripts/connector.mjs <tool> '<json-args>' [timeoutSeconds]
 *   node scripts/connector.mjs list_wallets '{}'
 *   node scripts/connector.mjs request_account_proof '{"network":"stokenet"}' 180
 *
 * Does the JSON-RPC handshake, calls one tool, prints its result, exits.
 */
import { spawn } from 'node:child_process';

const BIN = '/home/lrb85/.local/bin/radix-connector-mcp';
import { readFileSync } from 'node:fs';
const tool = process.argv[2];
const rawArgs = process.argv[3] ?? '{}';
const args = JSON.parse(rawArgs.startsWith('@') ? readFileSync(rawArgs.slice(1), 'utf8') : rawArgs);
const timeoutMs = (Number(process.argv[4]) || 60) * 1000;

if (!tool) {
  console.error("Usage: node scripts/connector.mjs <tool> '<json-args>' [timeoutSeconds]");
  process.exit(1);
}

const child = spawn(BIN, [], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = '';
const pending = new Map();

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + '\n');
}

child.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id != null && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function rpc(id, method, params) {
  return new Promise((resolve) => {
    pending.set(id, resolve);
    send({ jsonrpc: '2.0', id, method, params });
  });
}

const timer = setTimeout(() => {
  console.error(`TIMEOUT after ${timeoutMs / 1000}s`);
  child.kill();
  process.exit(2);
}, timeoutMs);

(async () => {
  await rpc(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'driver', version: '1' },
  });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const res = await rpc(2, 'tools/call', { name: tool, arguments: args });
  clearTimeout(timer);
  console.log(JSON.stringify(res.result ?? res.error, null, 2));
  child.kill();
  process.exit(0);
})();
