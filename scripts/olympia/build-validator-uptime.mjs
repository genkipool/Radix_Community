/**
 * scripts/olympia/build-validator-uptime.mjs
 *
 * Works out every Olympia validator's uptime (proposals completed out of all
 * it was asked for, over the whole of Olympia) from the archive's
 * `validator_proposal_records` (3.3 M rows) and writes the 254 results to
 * services/olympia/data/validator-uptime.json. Olympia is over, so this runs
 * once; the app reads the small file and never the 5.6 MB table.
 *
 *   node scripts/olympia/build-validator-uptime.mjs
 */
import { writeFileSync } from 'node:fs';
import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';

const BASE = (process.env.OLYMPIA_DATA_BASE_URL || 'https://huggingface.co/datasets/Genkipool/radix-olympia-gateway-export/resolve/main').replace(/\/+$/, '');
const open = async (path) => {
  const file = await asyncBufferFromUrl({ url: `${BASE}/${path}` });
  return { file, metadata: await parquetMetadataAsync(file) };
};
const text = (v) => (v instanceof Uint8Array ? Buffer.from(v).toString('utf8') : String(v));

const validators = await open('index/validators_by_address.parquet');
const ids = new Map();
for (const r of await parquetReadObjects({ ...validators, columns: ['address', 'validator_id'], compressors, utf8: false })) {
  ids.set(Number(r.validator_id), text(r.address));
}

// One row group at a time, so memory stays at one group's rows.
const records = await open('validator_proposal_records.parquet');
const totals = new Map();
let start = 0;
for (const rg of records.metadata.row_groups) {
  const end = start + Number(rg.num_rows);
  const rows = await parquetReadObjects({ ...records, rowStart: start, rowEnd: end, columns: ['validator_id', 'proposals_completed', 'proposals_missed'], compressors });
  for (const r of rows) {
    const t = totals.get(Number(r.validator_id)) ?? { completed: 0, missed: 0 };
    t.completed += Number(r.proposals_completed ?? 0);
    t.missed += Number(r.proposals_missed ?? 0);
    totals.set(Number(r.validator_id), t);
  }
  start = end;
}

const out = {};
for (const [id, t] of totals) {
  const address = ids.get(id);
  if (!address) continue;
  out[address] = { completed: t.completed, missed: t.missed };
}
writeFileSync('services/olympia/data/validator-uptime.json', `${JSON.stringify(out, null, 0)}\n`);
console.log(`${Object.keys(out).length} validators written`);
