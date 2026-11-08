/**
 * scripts/olympia/build-validator-stake-activity.mjs
 *
 * Builds the index the archive lacks for a validator's staking activity: XRD
 * staked to and unstaked from each Olympia validator, per UTC day. The archive
 * keeps these movements in `index/operations_by_version` (7.7 M rows), sorted
 * by transaction, so a validator's own can't be read without scanning it all;
 * this script does that scan once, dates each movement by its transaction
 * (`index/user_tx_by_version`), and writes the per-validator, per-day totals to
 * services/olympia/data/validator-stake-activity.json. Olympia is over, so this
 * runs once.
 *
 *   node scripts/olympia/build-validator-stake-activity.mjs
 */
import { writeFileSync } from 'node:fs';
import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const BASE = (process.env.OLYMPIA_DATA_BASE_URL || 'https://huggingface.co/datasets/Genkipool/radix-olympia-gateway-export/resolve/main').replace(/\/+$/, '');
const open = async (path) => {
  const file = await asyncBufferFromUrl({ url: `${BASE}/${path}` });
  return { file, metadata: await parquetMetadataAsync(file) };
};
const text = (v) => (v instanceof Uint8Array ? Buffer.from(v).toString('utf8') : v == null ? null : String(v));
const ATTO = 10n ** 18n;
const xrd = (v) => {
  const s = text(v);
  if (!s) return 0;
  const n = BigInt(s.split('.')[0]);
  return Number(n / ATTO) + Number(n % ATTO) / 1e18;
};

/** Reads a file one row group at a time, a few in parallel. */
async function scan(path, columns, onRows) {
  const src = await open(path);
  const groups = src.metadata.row_groups;
  let start = 0;
  const ranges = groups.map((g) => { const r = [start, start + Number(g.num_rows)]; start = r[1]; return r; });
  const PARALLEL = 8;
  for (let i = 0; i < ranges.length; i += PARALLEL) {
    const batch = ranges.slice(i, i + PARALLEL);
    const parts = await Promise.all(batch.map(([s, e]) => parquetReadObjects({ ...src, rowStart: s, rowEnd: e, columns, compressors, utf8: false })));
    parts.forEach(onRows);
    process.stdout.write(`\r${path}: ${Math.min(i + PARALLEL, ranges.length)}/${ranges.length} groups`);
  }
  process.stdout.write('\n');
}

// 1. Every stake and unstake: state version, validator, kind, amount.
const moves = [];
await scan('index/operations_by_version.parquet', ['state_version', 'action_type', 'validator_address', 'amount'], (rows) => {
  for (const r of rows) {
    const type = text(r.action_type);
    if (type !== 'STAKE_TOKENS' && type !== 'UNSTAKE_TOKENS') continue;
    const validator = text(r.validator_address);
    if (!validator) continue;
    moves.push({ sv: Number(r.state_version), validator, stake: type === 'STAKE_TOKENS', amount: xrd(r.amount) });
  }
});
console.log(`${moves.length} stake movements`);

// 2. The day of each of their transactions.
const wanted = new Set(moves.map((m) => m.sv));
const dayOf = new Map();
await scan('index/user_tx_by_version.parquet', ['state_version', 'round_timestamp'], (rows) => {
  for (const r of rows) {
    const sv = Number(r.state_version);
    if (!wanted.has(sv)) continue;
    const at = r.round_timestamp instanceof Date ? r.round_timestamp : new Date(Number(r.round_timestamp) / 1000);
    dayOf.set(sv, at.toISOString().slice(0, 10));
  }
});

// 3. Per validator and day: [day, staked, unstaked], oldest first.
const byValidator = new Map();
let undated = 0;
for (const m of moves) {
  const day = dayOf.get(m.sv);
  if (!day) { undated += 1; continue; }
  const days = byValidator.get(m.validator) ?? new Map();
  const d = days.get(day) ?? [0, 0];
  d[m.stake ? 0 : 1] += m.amount;
  days.set(day, d);
  byValidator.set(m.validator, days);
}
const round = (n) => Math.round(n * 1e4) / 1e4;
const out = {};
for (const [validator, days] of [...byValidator].sort(([a], [b]) => a.localeCompare(b))) {
  out[validator] = [...days].sort(([a], [b]) => a.localeCompare(b)).map(([day, [s, u]]) => [day, round(s), round(u)]);
}
writeFileSync('services/olympia/data/validator-stake-activity.json', `${JSON.stringify(out)}\n`);
console.log(`${Object.keys(out).length} validators, ${undated} movements without a date`);
