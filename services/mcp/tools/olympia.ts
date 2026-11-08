/**
 * services/mcp/tools/olympia.ts
 *
 * Olympia tools: everything the Radix Olympia archive holds (the mainnet before
 * Babylon, July 2021 to 28 September 2023), read from its Parquet files the
 * same way the explorer does. Accounts (final balances and stakes, history,
 * funds flow, staking rewards), transactions (by id or by date), validators
 * (profile, stake, uptime, delegators, rewards, staking activity), tokens
 * (supply, holders) and the links between an Olympia identity and its
 * Babylon successor. Read-only; never touches Redis.
 */

import { z } from 'zod';
import { olympiaKindOf, OLYMPIA_END_ISO, OLYMPIA_FINAL_STATE_VERSION, OLYMPIA_START_ISO } from '@/features/dashboard/lib/olympia';
import {
  findAccountByBabylon,
  findAccountByOlympia,
  findRriByBabylon,
  findValidatorByPublicKey,
  getAccountRewards,
  getAccountStateAt,
  getAccountSummary,
  getAccountTxPage,
  getResource,
  getTransactionById,
  getValidator,
  getValidatorDelegators,
  getValidatorRewards,
  olympiaDayRange,
  readOlympiaFunds,
  versionAtDayEnd,
  type OlympiaAccountRef,
} from '@/services/olympia';
import { getTransactionsByDate } from '@/services/olympia/byDate';
import { validatorCatalog } from '@/services/olympia/catalog';
import { proposalsOf } from '@/services/olympia/validators';
import { getValidatorsCached } from '@/services/gateway/validators';
import type { OlympiaTxDetail, OlympiaTxItem } from '@/types/olympia';
import { defineMcpTool } from '../registry';
import { cliBanner, cliKeyValues, cliNext, cliRender, cliSection, cliTable } from '../cli';

/* ── Inputs ───────────────────────────────────────────────────────────────── */

const accountSchema = z
  .string()
  .min(10)
  .max(120)
  .refine((v) => olympiaKindOf(v) === 'account' || /^account_rdx1[02-9ac-hj-np-z]{40,80}$/.test(v), 'Expected an Olympia account (rdx1…) or the Babylon account it became (account_rdx1…)')
  .describe('Olympia account address (rdx1…) or the Babylon account it became (account_rdx1…)');
const validatorSchema = z
  .string()
  .refine((v) => olympiaKindOf(v) === 'validator', 'Expected an Olympia validator address (rv1…)')
  .describe('Olympia validator address (rv1…)');
const tokenSchema = z
  .string()
  .refine((v) => olympiaKindOf(v) === 'resource' || /^resource_rdx1[02-9ac-hj-np-z]{40,80}$/.test(v), 'Expected an Olympia token rri (<symbol>_rr1…) or its Babylon resource (resource_rdx1…)')
  .describe('Olympia token rri (e.g. xrd_rr1qy5wfsfh) or the Babylon resource it was migrated to (resource_rdx1…)');
const txIdSchema = z.string().regex(/^[0-9a-fA-F]{64}$/, 'Expected a 64-hex Olympia transaction id').describe('Olympia transaction id (64 hex characters)');
const yearSchema = z.number().int().min(2021).max(2023).describe('Calendar year, 2021 to 2023');
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD').describe('UTC day, YYYY-MM-DD');

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const xrd = (n: number, digits = 2) => `${n.toLocaleString('en-US', { maximumFractionDigits: digits })} XRD`;
const pct = (n: number | null | undefined) => (n == null ? '-' : `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}%`);
const page = (url: string, value: string) => `${url}/en/dashboard/olympia/${value}`;
const END_DAY = OLYMPIA_END_ISO.slice(0, 10);

async function accountRef(value: string): Promise<OlympiaAccountRef> {
  const ref = value.startsWith('account_') ? await findAccountByBabylon(value) : await findAccountByOlympia(value);
  if (!ref) throw new Error(`${value} did not exist on Olympia.`);
  return ref;
}

function actionsOf(tx: OlympiaTxItem): string {
  const types = [...new Set(tx.actions.map((a) => a.type).filter((t) => t && t !== 'BURN_XRD'))];
  return types.join(' · ') || 'FEE_ONLY';
}

function txRow(tx: OlympiaTxItem) {
  const out = tx.balanceChanges.filter((c) => c.deltaNum < 0).map((c) => `${c.delta} ${c.symbol}`).join(', ');
  const inn = tx.balanceChanges.filter((c) => c.deltaNum > 0).map((c) => `+${c.delta} ${c.symbol}`).join(', ');
  return [String(tx.timestamp ?? '').slice(0, 19), actionsOf(tx), out || '-', inn || '-', tx.transactionId];
}

function txStructured(tx: OlympiaTxDetail) {
  return {
    transactionId: tx.transactionId,
    stateVersion: tx.stateVersion,
    timestamp: tx.timestamp,
    epoch: tx.epoch,
    round: tx.round,
    status: 'CommittedSuccess',
    feeXrd: tx.feeXrd,
    feePayer: tx.feePayer,
    message: tx.message,
    messageEncrypted: tx.messageEncrypted,
    actions: tx.actions.map((a) => ({ type: a.type, from: a.from, to: a.to, validator: a.validator, validatorName: a.validatorName ?? null, amount: a.amount, rri: a.rri, symbol: a.symbol })),
    balanceChanges: tx.allBalanceChanges.map((c) => ({ address: c.address, rri: c.rri, symbol: c.symbol, delta: c.delta })),
  };
}

/* ── Tools ────────────────────────────────────────────────────────────────── */

export const olympiaLookupTool = defineMcpTool({
  name: 'olympia_lookup',
  title: 'Look up anything on Olympia',
  description:
    'Identifies any Radix Olympia identifier and returns its essentials: an account (rdx1…), a validator (rv1…), a token rri (<symbol>_rr1…), a transaction id (64 hex), or a Babylon account_/resource_/validator_ address (answered for the Olympia account, token or validator it comes from). Olympia was the Radix mainnet from July 2021 to 28 September 2023; data comes from the community archive. Start here, then use the specific olympia_* tool it points to.',
  category: 'ledger',
  inputSchema: z.object({
    value: z.string().min(8).max(130).describe('Any Olympia identifier, or a Babylon account_/resource_/validator_ address'),
  }),
  handler: async ({ value }, ctx) => {
    const v = value.trim();
    if (v.startsWith('validator_rdx1')) {
      const babylon = (await getValidatorsCached('mainnet')).validators.find((b) => b.address === v);
      const olympia = babylon?.publicKey ? await findValidatorByPublicKey(babylon.publicKey) : null;
      if (!olympia) return { text: `${v} has no Olympia validator with the same node key.`, structured: { found: false, value: v } };
      return olympiaGetValidatorTool.handler({ address: olympia.address }, ctx);
    }
    if (v.startsWith('account_')) return olympiaGetAccountTool.handler({ address: v }, ctx);
    if (v.startsWith('resource_')) return olympiaGetTokenTool.handler({ token: v, holders: 10 }, ctx);
    const kind = olympiaKindOf(v);
    if (kind === 'account') return olympiaGetAccountTool.handler({ address: v }, ctx);
    if (kind === 'validator') return olympiaGetValidatorTool.handler({ address: v }, ctx);
    if (kind === 'resource') return olympiaGetTokenTool.handler({ token: v, holders: 10 }, ctx);
    if (kind === 'tx') return olympiaGetTransactionTool.handler({ id: v, raw: false }, ctx);
    throw new Error(`Not an Olympia identifier: ${v}`);
  },
});

export const olympiaGetAccountTool = defineMcpTool({
  name: 'olympia_get_account',
  title: 'Get an Olympia account',
  description:
    'An Olympia account as Olympia ended: its Babylon successor and public key, XRD (liquid, staked, unstaking), every token balance, its stakes per validator, activity (tx count, first and last transaction, fees paid) and lifetime staking rewards. Accepts the rdx1… address or the account_rdx1… it became. Read-only.',
  category: 'ledger',
  inputSchema: z.object({ address: accountSchema }),
  handler: async ({ address }, ctx) => {
    const ref = await accountRef(address);
    const a = await getAccountSummary(ref);
    const tokens = [...(a.xrd ? [a.xrd] : []), ...a.tokens];
    return {
      text: cliRender(
        cliBanner(`Olympia account · ${a.address}`),
        cliKeyValues([
          ['Babylon account', a.babylonAddress],
          ['Public key', a.publicKey],
          ['Total XRD at the end', xrd(a.totals.totalXrd)],
          ['Liquid / staked / unstaking', `${xrd(a.totals.liquidXrd)} / ${xrd(a.totals.stakedXrd)} / ${xrd(a.totals.unstakingXrd + a.totals.pendingStakeXrd)}`],
          ['Transactions', a.activity.txCount.toLocaleString('en-US')],
          ['First / last transaction', `${a.activity.firstTx?.timestamp?.slice(0, 10) ?? '-'} / ${a.activity.lastTx?.timestamp?.slice(0, 10) ?? '-'}`],
          ['Fees paid', xrd(a.activity.feesPaidXrd, 4)],
          ['Staking rewards (delegator / validator fee)', `${xrd(a.rewards.delegatorXrd)} / ${xrd(a.rewards.validatorFeeXrd)}`],
          ['Explorer', page(ctx.origin, a.address)],
        ]),
        tokens.length > 0 && `${cliSection(`Balances (${tokens.length})`)}\n${cliTable(['Symbol', 'Amount', 'rri'], tokens.slice(0, 40).map((t) => [t.symbol, t.amount, t.rri]))}`,
        a.stakes.length > 0 && `${cliSection(`Stakes (${a.stakes.length})`)}\n${cliTable(['Validator', 'Staked', 'Unstaking', 'Address'], a.stakes.map((s) => [s.validatorName ?? '-', xrd(s.stakedXrd), xrd(s.pendingUnstakeXrd + s.exitingXrd), s.validatorAddress]))}`,
        cliNext(['olympia_get_account_transactions → its history.', 'olympia_get_account_funds_flow → who it traded XRD with.', 'olympia_get_account_rewards → daily staking rewards of a year.']),
      ),
      structured: { ...a } as unknown as Record<string, unknown>,
    };
  },
});

export const olympiaGetAccountAtTool = defineMcpTool({
  name: 'olympia_get_account_at',
  title: 'Get an Olympia account at a past date',
  description:
    'What an Olympia account held at one point of Olympia, not only at its end: liquid XRD, every token balance and its stakes per validator (staked, pending stake, unstaking), valued as the official Olympia Gateway values them at that state version. Give a UTC day (read at its last state version) or an exact state version. Accepts the rdx1… address or the account_rdx1… it became. Read-only.',
  category: 'ledger',
  inputSchema: z.object({
    address: accountSchema,
    day: daySchema.optional().describe('UTC day of Olympia, YYYY-MM-DD (2021-07-26 to 2023-09-28); read at its last state version'),
    stateVersion: z.number().int().min(1).max(OLYMPIA_FINAL_STATE_VERSION).optional().describe('Exact Olympia state version, instead of a day'),
  }),
  handler: async ({ address, day, stateVersion }, ctx) => {
    if ((day === undefined) === (stateVersion === undefined)) throw new Error('Give either `day` or `stateVersion`.');
    const sv = stateVersion ?? versionAtDayEnd(day as string);
    if (sv === null) {
      const { first, last } = olympiaDayRange();
      throw new Error(`${day} is not a day of Olympia (${first} to ${last}).`);
    }
    const ref = await accountRef(address);
    const a = await getAccountStateAt(ref, sv, day ?? null);
    const tokens = [...(a.xrd ? [a.xrd] : []), ...a.tokens];
    return {
      text: cliRender(
        cliBanner(`Olympia account · ${a.address} · ${day ? `end of ${day} (UTC)` : `state version ${sv.toLocaleString('en-US')}`}`),
        cliKeyValues([
          ['State version', sv.toLocaleString('en-US')],
          ['Total XRD', xrd(a.totals.totalXrd)],
          ['Liquid / staked / pending stake / unstaking', `${xrd(a.totals.liquidXrd)} / ${xrd(a.totals.stakedXrd)} / ${xrd(a.totals.pendingStakeXrd)} / ${xrd(a.totals.unstakingXrd)}`],
          ['Explorer', page(ctx.origin, a.address)],
        ]),
        tokens.length > 0 ? `${cliSection(`Balances (${tokens.length})`)}\n${cliTable(['Symbol', 'Amount', 'rri'], tokens.slice(0, 40).map((t) => [t.symbol, t.amount, t.rri]))}` : 'No token balances at that point.',
        a.stakes.length > 0 && `${cliSection(`Stakes (${a.stakes.length})`)}\n${cliTable(['Validator', 'Staked', 'Pending stake', 'Unstaking', 'Address'], a.stakes.map((s) => [s.validatorName ?? '-', xrd(s.stakedXrd), xrd(s.pendingStakeXrd), xrd(s.pendingUnstakeXrd + s.exitingXrd), s.validatorAddress]))}`,
        cliNext(['olympia_get_account → the same account when Olympia ended.', 'olympia_get_account_transactions → what changed it.']),
      ),
      structured: { ...a } as unknown as Record<string, unknown>,
    };
  },
});

export const olympiaGetAccountTransactionsTool = defineMcpTool({
  name: 'olympia_get_account_transactions',
  title: 'List an Olympia account’s transactions',
  description:
    'An Olympia account’s transactions, newest first, with its own actions and balance changes in each. Paginated: pass the returned nextCursor as `before` for the next page. Read-only.',
  category: 'ledger',
  inputSchema: z.object({
    address: accountSchema,
    limit: z.number().int().min(1).max(50).default(20).describe('Transactions per page (1-50)'),
    before: z.string().regex(/^\d{1,12}$/).optional().describe('nextCursor of the previous page (a state version)'),
  }),
  handler: async ({ address, limit, before }) => {
    const ref = await accountRef(address);
    const p = await getAccountTxPage(ref, before ? BigInt(before) : null, limit);
    return {
      text: cliRender(
        cliBanner(`Olympia transactions · ${ref.address}`),
        p.items.length === 0 ? 'No transactions.' : cliTable(['Date (UTC)', 'Actions', 'Sent', 'Received', 'Transaction id'], p.items.map(txRow)),
        p.nextCursor && cliNext([`More: call again with before="${p.nextCursor}".`, 'olympia_get_transaction → one of them in full.']),
      ),
      structured: { address: ref.address, items: p.items as unknown as Record<string, unknown>[], nextCursor: p.nextCursor ?? null },
    };
  },
});

export const olympiaGetAccountFundsFlowTool = defineMcpTool({
  name: 'olympia_get_account_funds_flow',
  title: 'Get an Olympia account’s funds flow',
  description:
    'Where an Olympia account’s XRD came from and went: its counterparties over its latest 5,000 movements, with XRD received from and sent to each and the transactions they shared. Read-only.',
  category: 'ledger',
  inputSchema: z.object({
    address: accountSchema,
    limit: z.number().int().min(1).max(100).default(25).describe('Counterparties to list'),
  }),
  handler: async ({ address, limit }) => {
    const ref = await accountRef(address);
    const f = await readOlympiaFunds(ref);
    const rows = f.counterparties.slice(0, limit);
    return {
      text: cliRender(
        cliBanner(`Olympia funds flow · ${ref.address}`),
        cliKeyValues([
          ['Received', xrd(f.received)],
          ['Sent', xrd(f.sent)],
          ['Window', `${f.from?.slice(0, 10) ?? '-'} → ${f.to?.slice(0, 10) ?? '-'} (${f.txs} transactions${f.more ? ', older ones not read' : ''})`],
        ]),
        cliTable(['Counterparty', 'Received from', 'Sent to', 'Txs', 'Last'], rows.map((c) => [c.address, xrd(c.received), xrd(c.sent), c.txs, c.lastAt?.slice(0, 10) ?? '-'])),
      ),
      structured: { address: ref.address, ...f, counterparties: rows } as unknown as Record<string, unknown>,
    };
  },
});

export const olympiaGetAccountRewardsTool = defineMcpTool({
  name: 'olympia_get_account_rewards',
  title: 'Get an Olympia account’s staking rewards',
  description:
    'An Olympia account’s staking rewards in one year, per day and validator: what it earned as a delegator and, if it owned a validator, the fee. Totals included. Read-only.',
  category: 'ledger',
  inputSchema: z.object({ address: accountSchema, year: yearSchema }),
  handler: async ({ address, year }) => {
    const ref = await accountRef(address);
    const days = await getAccountRewards(ref.id, year);
    const delegator = days.reduce((s, d) => s + d.delegatorXrd, 0);
    const fee = days.reduce((s, d) => s + d.feeXrd, 0);
    return {
      text: cliRender(
        cliBanner(`Olympia staking rewards ${year} · ${ref.address}`),
        cliKeyValues([['As delegator', xrd(delegator, 4)], ['Validator fee', xrd(fee, 4)], ['Days with rewards', new Set(days.map((d) => d.day)).size]]),
        days.length > 0 && cliTable(['Day', 'Validator', 'Delegator XRD', 'Fee XRD'], days.slice(-60).map((d) => [d.day, d.validatorName ?? d.validatorAddress, d.delegatorXrd.toFixed(6), d.feeXrd.toFixed(6)])),
        days.length > 60 && `(showing the last 60 of ${days.length} rows; the structured result has them all)`,
      ),
      structured: { address: ref.address, year, totalDelegatorXrd: delegator, totalFeeXrd: fee, days: days as unknown as Record<string, unknown>[] },
    };
  },
});

export const olympiaGetTransactionTool = defineMcpTool({
  name: 'olympia_get_transaction',
  title: 'Get an Olympia transaction',
  description:
    'An Olympia transaction in full: date, epoch and round, fee and fee payer, message, every action (transfers, stakes, unstakes, token creation, mints, burns) and every balance change. Optionally the signed transaction in hex. Every transaction in the archive was committed successfully. Read-only.',
  category: 'ledger',
  inputSchema: z.object({
    id: txIdSchema,
    raw: z.boolean().default(false).describe('Include the signed transaction payload in hex'),
  }),
  handler: async ({ id, raw }, ctx) => {
    const tx = await getTransactionById(id);
    if (!tx) throw new Error(`No Olympia transaction with id ${id}.`);
    return {
      text: cliRender(
        cliBanner(`Olympia transaction · ${tx.transactionId}`),
        cliKeyValues([
          ['Date (UTC)', tx.timestamp],
          ['Status', 'Committed (success)'],
          ['Epoch / round', `${tx.epoch} / ${tx.round}`],
          ['State version', tx.stateVersion],
          ['Fee', xrd(tx.feeXrd, 6)],
          ['Fee payer', tx.feePayer],
          ['Message', tx.messageEncrypted ? '(encrypted)' : tx.message],
          ['Explorer', page(ctx.origin, tx.transactionId)],
        ]),
        `${cliSection(`Actions (${tx.actions.length})`)}\n${cliTable(['Type', 'From', 'To / validator', 'Amount'], tx.actions.map((a) => [a.type ?? '-', a.from ?? '-', a.to ?? a.validatorName ?? a.validator ?? '-', a.amount ? `${a.amount} ${a.symbol}` : '-']))}`,
        `${cliSection(`Balance changes (${tx.allBalanceChanges.length})`)}\n${cliTable(['Address', 'Change'], tx.allBalanceChanges.map((c) => [c.address ?? '-', `${c.deltaNum > 0 ? '+' : ''}${c.delta} ${c.symbol}`]))}`,
        raw && tx.rawHex ? `${cliSection('Signed transaction (hex)')}\n${tx.rawHex}` : undefined,
      ),
      structured: { ...txStructured(tx), ...(raw ? { rawHex: tx.rawHex } : {}) },
    };
  },
});

export const olympiaListTransactionsByDateTool = defineMcpTool({
  name: 'olympia_list_transactions_by_date',
  title: 'List Olympia transactions in a date range',
  description:
    `Every Olympia transaction between two UTC days (inclusive), newest first, with actions and balance changes. Olympia ran from ${OLYMPIA_START_ISO.slice(0, 10)} to ${END_DAY}. Paginated: pass nextCursor as \`before\`. Read-only.`,
  category: 'ledger',
  inputSchema: z.object({
    from: daySchema,
    to: daySchema.optional().describe('Last UTC day, YYYY-MM-DD (default: same as from)'),
    limit: z.number().int().min(1).max(50).default(20).describe('Transactions per page (1-50)'),
    before: z.string().regex(/^\d{1,12}$/).optional().describe('nextCursor of the previous page'),
  }),
  handler: async ({ from, to, limit, before }) => {
    const fromMs = Date.parse(`${from}T00:00:00Z`);
    const toMs = Date.parse(`${to ?? from}T23:59:59.999Z`);
    if (!(fromMs <= toMs)) throw new Error('`from` must not be after `to`.');
    const p = await getTransactionsByDate(fromMs, toMs, before ? BigInt(before) : null, limit);
    return {
      text: cliRender(
        cliBanner(`Olympia transactions · ${from}${to && to !== from ? ` → ${to}` : ''}`),
        p.items.length === 0 ? 'No transactions in that range.' : cliTable(['Date (UTC)', 'Actions', 'Fee', 'Fee payer', 'Transaction id'], p.items.map((tx) => [String(tx.timestamp ?? '').slice(0, 19), actionsOf(tx), tx.feeXrd.toFixed(4), tx.feePayer ?? '-', tx.transactionId])),
        p.nextCursor && cliNext([`More: call again with before="${p.nextCursor}".`]),
      ),
      structured: { from, to: to ?? from, items: p.items.map(txStructured), nextCursor: p.nextCursor ?? null },
    };
  },
});

export const olympiaListValidatorsTool = defineMcpTool({
  name: 'olympia_list_validators',
  title: 'List Olympia validators',
  description:
    'Every Olympia validator (254) as Olympia ended, biggest stake first: name, address, XRD staked, share of all staked XRD and lifetime uptime (proposals completed out of all it was asked for). Read-only.',
  category: 'ledger',
  inputSchema: z.object({
    limit: z.number().int().min(1).max(254).default(50).describe('Validators to list'),
    search: z.string().max(60).optional().describe('Only those whose name contains this text'),
  }),
  handler: async ({ limit, search }) => {
    const all = [...(await validatorCatalog()).values()].sort((a, b) => b.totalXrdStaked - a.totalXrdStaked);
    const network = all.reduce((s, v) => s + v.totalXrdStaked, 0);
    const wanted = search ? all.filter((v) => (v.name ?? '').toLowerCase().includes(search.toLowerCase())) : all;
    const rows = wanted.slice(0, limit).map((v) => {
      const p = proposalsOf(v.address);
      return { address: v.address, name: v.name, stakedXrd: v.totalXrdStaked, sharePercent: network > 0 ? (v.totalXrdStaked / network) * 100 : null, uptimePercent: p?.uptimePercent ?? null };
    });
    return {
      text: cliRender(
        cliBanner(`Olympia validators (${wanted.length}${search ? ` matching "${search}"` : ''})`),
        cliKeyValues([['XRD staked on Olympia at the end', xrd(network, 0)]]),
        cliTable(['#', 'Name', 'Staked', 'Share', 'Uptime', 'Address'], rows.map((r, i) => [i + 1, r.name ?? '-', xrd(r.stakedXrd, 0), pct(r.sharePercent), pct(r.uptimePercent), r.address])),
        cliNext(['olympia_get_validator → one of them in full.']),
      ),
      structured: { totalStakedXrd: network, validators: rows },
    };
  },
});

export const olympiaGetValidatorTool = defineMcpTool({
  name: 'olympia_get_validator',
  title: 'Get an Olympia validator',
  description:
    'An Olympia validator as Olympia ended: name, web, owner, node key, fee, registration and delegation, XRD staked and share of the network, owner stake, stake-unit factor, delegators, lifetime uptime and proposals, rewards paid out, the top delegators, its stake over time and its monthly staking activity (XRD staked and unstaked). Read-only.',
  category: 'ledger',
  inputSchema: z.object({ address: validatorSchema }),
  handler: async ({ address }, ctx) => {
    const v = await getValidator(address, 10);
    if (!v) throw new Error(`${address} was not an Olympia validator.`);
    const months = new Map<string, { stake: number; unstake: number }>();
    for (const a of v.stakeActivity ?? []) {
      const m = months.get(a.day.slice(0, 7)) ?? { stake: 0, unstake: 0 };
      m.stake += a.stake;
      m.unstake += a.unstake;
      months.set(a.day.slice(0, 7), m);
    }
    const monthly = [...months].map(([month, m]) => ({ month, stakedXrd: m.stake, unstakedXrd: m.unstake }));
    const { stakeHistory, stakeActivity: _activity, ...rest } = v;
    return {
      text: cliRender(
        cliBanner(`Olympia validator · ${v.name ?? v.address}`),
        cliKeyValues([
          ['Address', v.address],
          ['Web', v.url],
          ['Owner', v.owner],
          ['Node key', v.publicKey],
          ['Fee', pct(v.feePercent)],
          ['Registered / delegation', `${v.isRegistered ? 'yes' : 'no'} / ${v.allowDelegation ? 'open' : 'closed'}`],
          ['Staked at the end', `${xrd(v.totalStakedXrd, 0)} (${pct(v.networkSharePercent)} of the network)`],
          ['Owner stake', v.ownerStakeXrd == null ? '-' : xrd(v.ownerStakeXrd, 0)],
          ['1 stake unit', v.xrdPerStakeUnit == null ? '-' : xrd(v.xrdPerStakeUnit, 8)],
          ['Delegators', v.delegators.toLocaleString('en-US')],
          ['Uptime (whole of Olympia)', v.proposals ? `${pct(v.proposals.uptimePercent)} (${v.proposals.completed.toLocaleString('en-US')} completed, ${v.proposals.missed.toLocaleString('en-US')} missed)` : 'never proposed'],
          ['Rewards paid (delegators / owner fee)', `${xrd(v.rewards.delegatorsXrd, 0)} / ${xrd(v.rewards.ownerFeeXrd, 0)}`],
          ['Explorer', page(ctx.origin, v.address)],
        ]),
        v.topDelegators.length > 0 && `${cliSection('Top delegators')}\n${cliTable(['Account', 'Staked'], v.topDelegators.map((d) => [d.address, xrd(d.stakedXrd, 0)]))}`,
        monthly.length > 0 && `${cliSection('Staking activity by month')}\n${cliTable(['Month', 'Staked', 'Unstaked'], monthly.map((m) => [m.month, xrd(m.stakedXrd, 0), xrd(m.unstakedXrd, 0)]))}`,
        cliNext(['olympia_get_validator_delegators → all its delegators.', 'olympia_get_validator_rewards → daily rewards of a year.']),
      ),
      structured: {
        ...(rest as unknown as Record<string, unknown>),
        stakeHistory: (stakeHistory ?? []).filter((_, i, all) => i % 7 === 0 || i === all.length - 1),
        monthlyActivity: monthly,
      },
    };
  },
});

export const olympiaGetValidatorDelegatorsTool = defineMcpTool({
  name: 'olympia_get_validator_delegators',
  title: 'List an Olympia validator’s delegators',
  description: 'An Olympia validator’s delegators when Olympia ended, biggest stake first, with their share of its stake. Paginated with offset. Read-only.',
  category: 'ledger',
  inputSchema: z.object({
    address: validatorSchema,
    offset: z.number().int().min(0).default(0).describe('Delegators to skip'),
    limit: z.number().int().min(1).max(100).default(50).describe('Delegators per page (1-100)'),
  }),
  handler: async ({ address, offset, limit }) => {
    const { items, total } = await getValidatorDelegators(address, offset, limit);
    const staked = items.reduce((s, d) => s + d.stakedXrd, 0);
    return {
      text: cliRender(
        cliBanner(`Olympia delegators · ${address}`),
        cliKeyValues([['Delegators in all', total], ['Shown', `${offset + 1}-${offset + items.length}`]]),
        cliTable(['#', 'Account', 'Staked'], items.map((d, i) => [offset + i + 1, d.address, xrd(d.stakedXrd, 0)])),
        offset + items.length < total && cliNext([`More: call again with offset=${offset + items.length}.`]),
      ),
      structured: { address, total, offset, items, shownStakedXrd: staked },
    };
  },
});

export const olympiaGetValidatorRewardsTool = defineMcpTool({
  name: 'olympia_get_validator_rewards',
  title: 'Get an Olympia validator’s rewards',
  description: 'An Olympia validator’s rewards in one year, per day: the owner’s fee, what its delegators earned and its total stake that day. Totals included. Read-only.',
  category: 'ledger',
  inputSchema: z.object({ address: validatorSchema, year: yearSchema }),
  handler: async ({ address, year }) => {
    const days = await getValidatorRewards(address, year);
    const fee = days.reduce((s, d) => s + d.feeXrd, 0);
    const delegators = days.reduce((s, d) => s + d.delegatorsXrd, 0);
    return {
      text: cliRender(
        cliBanner(`Olympia validator rewards ${year} · ${address}`),
        cliKeyValues([['Owner fee', xrd(fee, 4)], ['Earned by delegators', xrd(delegators, 4)], ['Days', days.length]]),
        days.length > 0 && cliTable(['Day', 'Fee XRD', 'Delegators XRD', 'Total stake'], days.slice(-60).map((d) => [d.day, d.feeXrd.toFixed(6), d.delegatorsXrd.toFixed(6), xrd(d.totalStakeXrd, 0)])),
        days.length > 60 && `(showing the last 60 of ${days.length} days; the structured result has them all)`,
      ),
      structured: { address, year, totalFeeXrd: fee, totalDelegatorsXrd: delegators, days: days as unknown as Record<string, unknown>[] },
    };
  },
});

export const olympiaGetTokenTool = defineMcpTool({
  name: 'olympia_get_token',
  title: 'Get an Olympia token',
  description:
    'An Olympia token: name, symbol, description, web, icon, granularity, whether its supply was fixed or owner-controlled, owner, total supply, minted and burnt, holders count and the largest holders when Olympia ended, plus the Babylon resource it was migrated to. Accepts the rri or the Babylon resource_rdx1… address. Read-only.',
  category: 'ledger',
  inputSchema: z.object({
    token: tokenSchema,
    holders: z.number().int().min(0).max(100).default(20).describe('Largest holders to list (0-100)'),
  }),
  handler: async ({ token, holders }, ctx) => {
    const rri = token.startsWith('resource_') ? await findRriByBabylon(token) : token;
    const r = rri ? await getResource(rri, holders) : null;
    if (!r) throw new Error(`${token} was not an Olympia token.`);
    return {
      text: cliRender(
        cliBanner(`Olympia token · ${r.name ?? r.symbol} (${r.symbol})`),
        cliKeyValues([
          ['rri', r.rri],
          ['Babylon resource', r.babylonAddress],
          ['Description', r.description],
          ['Web', r.url],
          ['Supply', r.isMutable == null ? '-' : r.isMutable ? 'owner can mint and burn' : 'fixed'],
          ['Owner', r.owner],
          ['Total supply / minted / burnt', `${r.totalSupply} / ${r.totalMinted} / ${r.totalBurnt}`],
          ['Holders', r.holders],
          ['Created at state version', r.createdStateVersion],
          ['Explorer', page(ctx.origin, r.rri)],
        ]),
        r.topHolders.length > 0 && `${cliSection('Largest holders')}\n${cliTable(['#', 'Account', 'Amount'], r.topHolders.map((h, i) => [i + 1, h.address, h.amount]))}`,
      ),
      structured: { ...r } as unknown as Record<string, unknown>,
    };
  },
});

export const olympiaFromBabylonTool = defineMcpTool({
  name: 'olympia_from_babylon',
  title: 'Find the Olympia past of a Babylon address',
  description:
    'What a Babylon address was on Olympia, from the archive’s own index (works for every migrated account, signed on Babylon or not): an account_rdx1… gives its Olympia account (rdx1…) and public key; a resource_rdx1… gives the Olympia token it was migrated from; a validator_rdx1… gives the Olympia validator that ran with the same node key. "found: false" means it has no Olympia past. Read-only.',
  category: 'ledger',
  inputSchema: z.object({
    babylonAddress: z.string().regex(/^(account|resource|validator)_rdx1[02-9ac-hj-np-z]{40,80}$/, 'Expected a mainnet account_/resource_/validator_ address').describe('Babylon mainnet address: account_rdx1…, resource_rdx1… or validator_rdx1…'),
  }),
  handler: async ({ babylonAddress }) => {
    let found: Record<string, unknown> | null = null;
    if (babylonAddress.startsWith('account_')) {
      const ref = await findAccountByBabylon(babylonAddress);
      if (ref) found = { kind: 'account', olympiaAddress: ref.address, publicKey: ref.publicKey };
    } else if (babylonAddress.startsWith('resource_')) {
      const rri = await findRriByBabylon(babylonAddress);
      if (rri) found = { kind: 'token', rri };
    } else {
      const babylon = (await getValidatorsCached('mainnet')).validators.find((b) => b.address === babylonAddress);
      const v = babylon?.publicKey ? await findValidatorByPublicKey(babylon.publicKey) : null;
      if (v) found = { kind: 'validator', olympiaAddress: v.address, name: v.name, matchedBy: 'node public key' };
    }
    return {
      text: found
        ? cliRender(cliBanner('Babylon → Olympia'), cliKeyValues([['Babylon', babylonAddress], ...Object.entries(found).map(([k, val]) => [k, String(val)] as [string, string])]))
        : `${babylonAddress} has no Olympia past in the archive.`,
      structured: { babylonAddress, found: !!found, ...(found ?? {}) },
    };
  },
});

export const olympiaTools = [
  olympiaLookupTool,
  olympiaGetAccountTool,
  olympiaGetAccountAtTool,
  olympiaGetAccountTransactionsTool,
  olympiaGetAccountFundsFlowTool,
  olympiaGetAccountRewardsTool,
  olympiaGetTransactionTool,
  olympiaListTransactionsByDateTool,
  olympiaListValidatorsTool,
  olympiaGetValidatorTool,
  olympiaGetValidatorDelegatorsTool,
  olympiaGetValidatorRewardsTool,
  olympiaGetTokenTool,
  olympiaFromBabylonTool,
];
