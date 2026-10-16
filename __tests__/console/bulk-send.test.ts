import { describe, expect, it } from 'vitest';
import { RadixEngineToolkit } from '@radixdlt/radix-engine-toolkit';
import {
  bulkSendManifest,
  fungibleTotals,
  parseBulkCsv,
  validateBulkRows,
} from '@/features/console/lib/bulk-send';

/* Real Stokenet entities, so the toolkit checks addresses as well as syntax. */
const SENDER = 'account_tdx_2_12yg4284tjs26tdf57wvfjmqara4fjgnrxk34dg59kk4xtkh66xq74l';
const BOB = 'account_tdx_2_129grv2vv4q3w7aqzzwesc5k0xp4lg5dj4p78q80ca79rj5rct8mujk';
const XRD = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc';
const CLAIM = 'resource_tdx_2_1ng3g2nj5pfpmdphgz0nrh8z0gtqcxx5z5dn48t85ar0z0zjhefufaw';

describe('parseBulkCsv', () => {
  it('reads the three shapes, skips the header and blank lines', () => {
    const { rows, issues } = parseBulkCsv(
      `account,resource,amount\n${BOB},${XRD},10\n\n${SENDER};${CLAIM};#3#\n${BOB}\t2,5`,
      XRD,
    );
    expect(issues).toEqual([]);
    expect(rows).toEqual([
      { line: 2, row: 1, account: BOB, resource: XRD, amount: '10' },
      { line: 4, row: 2, account: SENDER, resource: CLAIM, amount: '', nftId: '#3#' },
      { line: 5, row: 3, account: BOB, resource: XRD, amount: '2.5' },
    ]);
  });

  it('flags a line with a single column', () => {
    expect(parseBulkCsv(`${BOB}`).issues).toEqual([{ line: 1, row: 1, code: 'columns' }]);
  });

  it('numbers recipients as the rows on screen do, not by file line', () => {
    const { rows } = parseBulkCsv(`account,resource,amount\n// a note\n${BOB},${XRD},1\n\n${SENDER},2`, XRD);
    expect(rows.map((r) => [r.line, r.row])).toEqual([
      [3, 1],
      [5, 2],
    ]);
  });
});

describe('validateBulkRows', () => {
  const rows = parseBulkCsv(`${BOB},${XRD},10\n${BOB},${XRD},5`).rows;

  it('accepts well-formed rows on the right network', () => {
    expect(validateBulkRows(rows, 'stokenet')).toEqual([]);
  });

  it('refuses addresses of another network', () => {
    expect(validateBulkRows(rows, 'mainnet').map((i) => i.code)).toContain('network');
  });

  it('checks the total per resource against the balance', () => {
    const issues = validateBulkRows(rows, 'stokenet', { fungibles: { [XRD]: '14.99' }, nonFungibles: {} });
    expect(issues.map((i) => i.code)).toEqual(['balance']);
    expect(validateBulkRows(rows, 'stokenet', { fungibles: { [XRD]: '15' }, nonFungibles: {} })).toEqual([]);
  });

  it('says the resource is missing for a two-column line with no default, and nothing else about it', () => {
    const { rows } = parseBulkCsv(`${BOB},${XRD},1\n${SENDER},2`);
    const issues = validateBulkRows(rows, 'stokenet', { fungibles: { [XRD]: '5' }, nonFungibles: {} });
    expect(issues).toEqual([{ line: 2, row: 2, code: 'noResource' }]);
  });

  it('names the resource and the total when the balance falls short', () => {
    const issues = validateBulkRows(rows, 'stokenet', { fungibles: { [XRD]: '1' }, nonFungibles: {} });
    expect(issues).toEqual([{ line: 1, row: 1, code: 'balance', detail: '15', resource: XRD }]);
  });

  it('refuses bad amounts, NFTs not held and repeated NFTs', () => {
    const bad = parseBulkCsv(`${BOB},${XRD},-1\n${BOB},${CLAIM},#1#\n${SENDER},${CLAIM},#1#`).rows;
    const codes = validateBulkRows(bad, 'stokenet', { fungibles: {}, nonFungibles: { [CLAIM]: ['#2#'] } }).map((i) => i.code);
    expect(codes).toContain('amount');
    expect(codes).toContain('duplicateNft');
    expect(codes).toContain('nftNotHeld');
  });

  it('asks for an id on an NFT and for an amount on a token', () => {
    const mixed = parseBulkCsv(`${BOB},${CLAIM},1\n${BOB},${XRD},#2#`).rows;
    const issues = validateBulkRows(mixed, 'stokenet');
    expect(issues.map((i) => [i.row, i.code, i.resource])).toEqual([
      [1, 'nftAmount', CLAIM],
      [2, 'fungibleId', XRD],
    ]);
  });

  it('tells a resource of another network from an invalid one', () => {
    const codes = (csv: string) => validateBulkRows(parseBulkCsv(csv).rows, 'stokenet').map((i) => i.code);
    expect(codes(`${BOB},resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd,1`)).toEqual(['resourceNetwork']);
    expect(codes(`${BOB},not-a-resource,1`)).toEqual(['resource']);
  });

  it('stops a resource that can never leave the account, once', () => {
    const two = parseBulkCsv(`${BOB},${CLAIM},#1#\n${SENDER},${CLAIM},#2#`).rows;
    const issues = validateBulkRows(two, 'stokenet', undefined, new Set([CLAIM]));
    expect(issues).toEqual([{ line: 1, row: 1, code: 'locked', resource: CLAIM }]);
  });
});

describe('bulkSendManifest', () => {
  it('withdraws each resource once and builds a valid manifest', async () => {
    const { rows } = parseBulkCsv(`${BOB},${XRD},10\n${SENDER},${XRD},0.5\n${BOB},${CLAIM},#1#`);
    expect(fungibleTotals(rows)).toEqual({ [XRD]: '10.5' });
    const manifest = bulkSendManifest(SENDER, rows);
    expect(manifest.match(/"withdraw"/g)).toHaveLength(1);
    expect(manifest.match(/try_deposit_or_refund/g)).toHaveLength(3);
    const result = await RadixEngineToolkit.Instructions.staticallyValidate({ kind: 'String', value: manifest }, 2);
    expect(result.kind).toBe('Valid');
  });
});
