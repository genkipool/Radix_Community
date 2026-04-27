import { Redis } from '@upstash/redis';
import logger from '@/lib/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ValidatorRewardData {
    lastSyncedEpoch: number;
    daily: Record<string, number>;
    yearly: Record<string, number>;
    dailyDelegants?: Record<string, number>;
    yearlyDelegants?: Record<string, number>;
    dailyStake?: Record<string, number>;
}

interface LsuStakeInfo {
    lsuResource: string;
    lsuBalance: number;
    lsuSupply: number;
    vaultAddress: string;
    validatorName: string;
}

interface LedgerDayState {
    userLsu: number;
    lsuSupply: number;
    stakeVault: number;
}

interface StakingRewardRecord {
    date: string;
    validator: string;
    validatorName: string;
    accountXrd: number;
    totalStake: number;
    proportion: number;
    rewardXrd: number;
}

interface AccountTx {
    date: string;
    timestamp: string;
    hash: string;
    txType: 'stake' | 'unstake' | 'claim' | 'deposit' | 'withdrawal' | 'trade' | 'other';
    balanceChanges: { resource: string; amount: number; direction: 'in' | 'out' }[];
    validatorOps: { validator: string; op: string; xrd: number; lsu: number }[];
    fee: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const GATEWAY_URL = 'https://mainnet.radixdlt.com';
const REDIS_REWARDS_ALL = 'validator_rewards_all';
const XRD_ADDR = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';
const MIN_REQ_INTERVAL_MS = 410; // ~146 req/min, stays under the 150 limit
const MAX_RETRIES = 5;
const PAGE_SIZE = 100;

// ── Rate Limiter ───────────────────────────────────────────────────────────────

let lastRequestTime = 0;

async function rateLimitWait(): Promise<void> {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    const gap = MIN_REQ_INTERVAL_MS - elapsed;
    if (gap > 0) {
        await new Promise((r) => setTimeout(r, gap));
    }
    lastRequestTime = Date.now();
}

// ── Gateway POST Helper ────────────────────────────────────────────────────────

async function gatewayPost(endpoint: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    let backoff = 1000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        await rateLimitWait();

        try {
            const res = await fetch(`${GATEWAY_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(30_000),
            });

            if (res.status === 429) {
                const retryAfter = parseFloat(res.headers.get('Retry-After') || '0') * 1000;
                await new Promise((r) => setTimeout(r, Math.max(retryAfter, backoff)));
                backoff = Math.min(backoff * 2, 64_000);
                continue;
            }

            if (res.status >= 500) {
                logger.warn({ status: res.status, attempt }, '[AccountRewards] Gateway 5xx, retrying');
                await new Promise((r) => setTimeout(r, backoff));
                backoff = Math.min(backoff * 2, 64_000);
                continue;
            }

            if (!res.ok) {
                throw new Error(`Gateway returned ${res.status}: ${res.statusText}`);
            }

            return (await res.json()) as Record<string, unknown>;
        } catch (err) {
            if (attempt === MAX_RETRIES) throw err;
            logger.warn({ err, attempt }, '[AccountRewards] Network error, retrying');
            await new Promise((r) => setTimeout(r, backoff));
            backoff = Math.min(backoff * 2, 64_000);
        }
    }

    throw new Error(`Exhausted ${MAX_RETRIES} retries for ${endpoint}`);
}

// ── Redis Helper ───────────────────────────────────────────────────────────────

function getRedisClient(): Redis | null {
    try {
        if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
            return new Redis({
                url: process.env.KV_REST_API_URL,
                token: process.env.KV_REST_API_TOKEN,
            });
        }
    } catch (e) {
        logger.error({ err: e }, '[AccountRewards] Failed to initialize Redis');
    }
    return null;
}

// ── Fetch all validators (addresses, LSU resource, vault) ──────────────────────

interface ValidatorMapEntry {
    lsuResource: string;
    vaultAddress: string;
    name: string;
}

async function fetchAllValidators(): Promise<Record<string, ValidatorMapEntry>> {
    const result: Record<string, ValidatorMapEntry> = {};
    let cursor: string | null = null;

    do {
        const body: Record<string, unknown> = {
            limit_per_page: 100,
            opt_ins: { validator_active_in_epoch: true, explicit_metadata: true, component_state: true },
        };
        if (cursor) body.cursor = cursor;

        const data = await gatewayPost('/state/validators/list', body);
        const validatorsObj = data.validators as Record<string, unknown> | undefined;
        const items = (
            (validatorsObj?.items as Record<string, unknown>[]) ??
            (data.items as Record<string, unknown>[]) ??
            []
        );

        for (const v of items) {
            const addr = (v.address as string) ?? ((v.state as Record<string, unknown>)?.address as string) ?? '';
            const state = (v.state as Record<string, unknown>) ?? {};
            const lsu = (state.stake_unit_resource_address as string) ?? (v.stake_unit_resource_address as string) ?? '';
            const vault = ((state.stake_xrd_vault as Record<string, unknown>)?.entity_address as string) ?? '';

            // Extract name from metadata
            let name = '';
            const metaItems = ((v.metadata as Record<string, unknown>)?.items as Record<string, unknown>[]) ?? [];
            for (const mi of metaItems) {
                if (mi.key === 'name') {
                    const typed = (mi.value as Record<string, unknown>)?.typed as Record<string, unknown> | undefined;
                    name = (typed?.value as string) ?? '';
                    break;
                }
            }

            if (addr) {
                result[addr] = { lsuResource: lsu, vaultAddress: vault, name: name || `${addr.slice(0, 25)}…` };
            }
        }

        cursor = (validatorsObj?.next_cursor as string) ?? (data.next_cursor as string) ?? null;
    } while (cursor);

    return result;
}

// ── Fetch account LSU balances ─────────────────────────────────────────────────

async function getAccountLsuBalances(
    accountAddress: string,
    validatorMap: Record<string, ValidatorMapEntry>,
): Promise<Record<string, LsuStakeInfo>> {
    const data = await gatewayPost('/state/entity/details', {
        addresses: [accountAddress],
        opt_ins: { fungible_resources: true },
    });

    const lsuBalances: Record<string, number> = {};
    const items = (data.items as Record<string, unknown>[]) ?? [];
    for (const item of items) {
        const fungibles = ((item.fungible_resources as Record<string, unknown>)?.items as Record<string, unknown>[]) ?? [];
        for (const res of fungibles) {
            const addr = (res.resource_address as string) ?? '';
            const rawAmt = (res.amount as string) ??
                ((res.balance as Record<string, unknown>)?.value as string) ?? '0';
            const amt = parseFloat(rawAmt);
            if (amt > 0) lsuBalances[addr] = amt;
        }
    }

    // Fetch LSU supplies for matched validators
    const result: Record<string, LsuStakeInfo> = {};
    const matchedLsuAddrs: string[] = [];
    const matchMap: Record<string, string> = {}; // lsuAddr → validatorAddr

    for (const [valAddr, info] of Object.entries(validatorMap)) {
        if (info.lsuResource && lsuBalances[info.lsuResource]) {
            matchedLsuAddrs.push(info.lsuResource);
            matchMap[info.lsuResource] = valAddr;
        }
    }

    if (matchedLsuAddrs.length === 0) return result;

    // Fetch LSU supplies in batch
    const supplyData = await gatewayPost('/state/entity/details', { addresses: matchedLsuAddrs });
    const supplyItems = (supplyData.items as Record<string, unknown>[]) ?? [];

    for (const item of supplyItems) {
        const addr = item.address as string;
        const details = (item.details as Record<string, unknown>) ?? {};
        const supRaw = (details.total_supply as string) ?? (details.total_minted as string);
        const supply = supRaw ? parseFloat(supRaw) : 0;
        const valAddr = matchMap[addr];
        if (valAddr && supply > 0) {
            result[valAddr] = {
                lsuResource: addr,
                lsuBalance: lsuBalances[addr],
                lsuSupply: supply,
                vaultAddress: validatorMap[valAddr].vaultAddress,
                validatorName: validatorMap[valAddr].name,
            };
        }
    }

    return result;
}

// ── Get ledger state for a specific day ────────────────────────────────────────

async function getLedgerStateForDay(
    accountAddress: string,
    lsuResource: string,
    vaultAddress: string,
    dayStr: string,
): Promise<LedgerDayState> {
    try {
        const data = await gatewayPost('/state/entity/details', {
            addresses: [accountAddress, lsuResource, vaultAddress],
            at_ledger_state: { timestamp: `${dayStr}T23:59:59Z` },
            opt_ins: { fungible_resources: true },
        });

        let userLsu = 0;
        let lsuSupply = 0;
        let stakeVault = 0;

        for (const item of (data.items as Record<string, unknown>[]) ?? []) {
            const addr = item.address as string;

            if (addr === accountAddress) {
                // Get user's LSU balance
                const fungibles = ((item.fungible_resources as Record<string, unknown>)?.items as Record<string, unknown>[]) ?? [];
                for (const res of fungibles) {
                    if ((res.resource_address as string) === lsuResource) {
                        userLsu = parseFloat(
                            (res.amount as string) ??
                            ((res.balance as Record<string, unknown>)?.value as string) ?? '0',
                        );
                    }
                }
            } else if (addr === lsuResource) {
                // Get LSU total supply
                const details = (item.details as Record<string, unknown>) ?? {};
                const supRaw = (details.total_supply as string) ?? (details.total_minted as string);
                if (supRaw) lsuSupply = parseFloat(supRaw);
            } else if (addr === vaultAddress) {
                // Get validator stake vault balance
                const details = (item.details as Record<string, unknown>) ?? {};
                const balance = details.balance ?? details.amount;
                if (balance !== null && balance !== undefined) {
                    if (typeof balance === 'object') {
                        const bObj = balance as Record<string, unknown>;
                        stakeVault = parseFloat((bObj.amount as string) ?? (bObj.value as string) ?? '0');
                    } else {
                        stakeVault = parseFloat(String(balance));
                    }
                }

                // Fallback: check fungible_resources
                if (stakeVault === 0) {
                    const fungibles = ((item.fungible_resources as Record<string, unknown>)?.items as Record<string, unknown>[]) ?? [];
                    for (const f of fungibles) {
                        const resAddr = (f.resource_address as string) ?? '';
                        if (resAddr === XRD_ADDR || !resAddr) {
                            const rawVal = (f.amount as string) ??
                                ((f.balance as Record<string, unknown>)?.amount as string) ??
                                ((f.balance as Record<string, unknown>)?.value as string) ?? '0';
                            stakeVault = parseFloat(rawVal);
                            if (stakeVault > 0) break;
                        }
                    }
                }
            }
        }

        return { userLsu, lsuSupply, stakeVault };
    } catch {
        return { userLsu: 0, lsuSupply: 0, stakeVault: 0 };
    }
}

// ── Fetch account transaction history ──────────────────────────────────────────

function getStateVersionAtDate(data: Record<string, unknown>): number {
    const items = (data.items as Record<string, unknown>[]) ?? [];
    if (items.length > 0) {
        return (items[0].state_version as number) ?? 0;
    }
    return 0;
}

async function fetchAccountTransactions(
    accountAddress: string,
    startDate: string,
    endDate: string,
): Promise<AccountTx[]> {
    const txs: AccountTx[] = [];
    let cursor: string | null = null;
    let fromSv = 0;

    // Get starting state version
    try {
        const svData = await gatewayPost('/stream/transactions', {
            limit_per_page: 1,
            order: 'Asc',
            from_ledger_state: { timestamp: `${startDate}T00:00:00Z` },
        });
        fromSv = getStateVersionAtDate(svData);
    } catch {
        // Start from beginning
    }

    let done = false;

    while (!done) {
        const body: Record<string, unknown> = {
            limit_per_page: PAGE_SIZE,
            affected_global_entities_filter: [accountAddress],
            opt_ins: { receipt_events: true, balance_changes: true },
            kind_filter: 'User',
            order: 'Asc',
        };
        if (cursor) {
            body.cursor = cursor;
        } else if (fromSv) {
            body.from_ledger_state = { state_version: fromSv };
        }

        let data: Record<string, unknown>;
        try {
            data = await gatewayPost('/stream/transactions', body);
        } catch {
            break;
        }

        const items = (data.items as Record<string, unknown>[]) ?? [];
        const nextCursor = data.next_cursor as string | undefined;

        for (const item of items) {
            const ts = (item.confirmed_at as string) ?? '';
            const dayStr = ts ? ts.slice(0, 10) : 'unknown';
            const txHash = (item.intent_hash as string) ?? (item.transaction_hash as string) ?? '';

            if (dayStr && dayStr > endDate) {
                done = true;
                break;
            }

            // Extract fee paid by this account
            let feePaid = 0;
            const balanceChangesObj = (item.balance_changes as Record<string, unknown>) ?? {};
            const feeChanges = (balanceChangesObj.fungible_fee_balance_changes as Record<string, unknown>[]) ?? [];
            for (const fbc of feeChanges) {
                if ((fbc.entity_address as string) === accountAddress) {
                    const delta = parseFloat((fbc.balance_change as string) ?? '0');
                    if (delta < 0) feePaid += Math.abs(delta);
                }
            }

            // Extract balance changes
            const changes: AccountTx['balanceChanges'] = [];
            const fungibleChanges = (balanceChangesObj.fungible_balance_changes as Record<string, unknown>[]) ?? [];
            for (const bc of fungibleChanges) {
                if ((bc.entity_address as string) !== accountAddress) continue;
                const delta = parseFloat((bc.balance_change as string) ?? '0');
                if (delta !== 0) {
                    changes.push({
                        resource: (bc.resource_address as string) ?? '',
                        amount: Math.abs(delta),
                        direction: delta > 0 ? 'in' : 'out',
                    });
                }
            }

            // Extract validator operations
            const valOps: AccountTx['validatorOps'] = [];
            const receiptEvents = ((item.receipt as Record<string, unknown>)?.events as Record<string, unknown>[]) ?? [];
            for (const ev of receiptEvents) {
                const evName = (ev.name as string) ?? '';
                const emitter = (((ev.emitter as Record<string, unknown>)?.entity as Record<string, unknown>)?.entity_address as string) ?? '';
                if (!emitter.startsWith('validator_')) continue;

                const fields = ((ev.data as Record<string, unknown>)?.fields as Record<string, unknown>[]) ??
                    (((ev.data as Record<string, unknown>)?.programmatic_json as Record<string, unknown>)?.fields as Record<string, unknown>[]) ?? [];

                const gf = (name: string): string => {
                    for (const f of fields) {
                        if ((f.field_name as string) === name) return (f.value as string) ?? '0';
                    }
                    return '0';
                };

                if (evName.includes('StakeEvent')) {
                    valOps.push({ validator: emitter, op: 'stake', xrd: parseFloat(gf('xrd_staked') || gf('amount') || '0'), lsu: parseFloat(gf('stake_units') || '0') });
                } else if (evName.includes('UnstakeEvent')) {
                    valOps.push({ validator: emitter, op: 'unstake', xrd: 0, lsu: parseFloat(gf('stake_units') || gf('amount') || '0') });
                } else if (evName.includes('ClaimXrdEvent') || evName.includes('ClaimEvent')) {
                    valOps.push({ validator: emitter, op: 'claim', xrd: parseFloat(gf('claimed_xrd') || gf('amount') || '0'), lsu: 0 });
                }
            }

            // Classify transaction type
            const opsSet = new Set(valOps.map((o) => o.op));
            let txType: AccountTx['txType'];
            if (opsSet.has('stake')) txType = 'stake';
            else if (opsSet.has('unstake')) txType = 'unstake';
            else if (opsSet.has('claim')) txType = 'claim';
            else if (changes.length > 0) {
                const hasIn = changes.some((c) => c.direction === 'in');
                const hasOut = changes.some((c) => c.direction === 'out');
                txType = hasIn && hasOut ? 'trade' : hasIn ? 'deposit' : 'withdrawal';
            } else {
                txType = 'other';
            }

            if (changes.length > 0 || valOps.length > 0 || feePaid > 0) {
                txs.push({
                    date: dayStr,
                    timestamp: ts,
                    hash: txHash,
                    txType,
                    balanceChanges: changes,
                    validatorOps: valOps,
                    fee: feePaid,
                });
            }
        }

        if (!nextCursor || items.length === 0 || done) break;
        cursor = nextCursor;
    }

    return txs;
}

// ── Compute staking rewards (mirrors Python compute_staking_rewards_perfect) ──

async function computeStakingRewards(
    allRewards: Record<string, ValidatorRewardData>,
    accountAddress: string,
    validatorMap: Record<string, ValidatorMapEntry>,
    accountTxs: AccountTx[],
    currentStakes: Record<string, LsuStakeInfo>,
    year: string,
): Promise<StakingRewardRecord[]> {
    const records: StakingRewardRecord[] = [];

    // Find all validators this account has interacted with
    const usedValidators = new Set<string>();
    for (const tx of accountTxs) {
        for (const op of tx.validatorOps) {
            usedValidators.add(op.validator);
        }
    }
    for (const v of Object.keys(currentStakes)) {
        usedValidators.add(v);
    }

    if (usedValidators.size === 0) return [];

    for (const valAddr of usedValidators) {
        const valData = allRewards[valAddr];
        if (!valData) continue;

        const dailyDelegants = valData.dailyDelegants ?? {};
        const dailyStake = valData.dailyStake ?? {};

        // Filter days for the requested year
        const yearDays = Object.keys(dailyDelegants)
            .filter((d) => d.startsWith(year))
            .sort();

        if (yearDays.length === 0) continue;

        const valInfo = validatorMap[valAddr];
        if (!valInfo?.lsuResource || !valInfo?.vaultAddress) continue;

        const valName = valInfo.name || `${valAddr.slice(0, 25)}…`;

        logger.info({ validator: valName, days: yearDays.length }, '[AccountRewards] Resolving stake proportions');

        for (const dayStr of yearDays) {
            const poolReward = dailyDelegants[dayStr];
            if (poolReward <= 0) continue;

            const jsonTotalStake = dailyStake[dayStr] ?? 0;
            if (jsonTotalStake <= 0) continue;

            // Query Gateway API for exact balances on this day
            const state = await getLedgerStateForDay(
                accountAddress,
                valInfo.lsuResource,
                valInfo.vaultAddress,
                dayStr,
            );

            if (state.userLsu <= 0 || state.lsuSupply <= 0) continue;

            // Exact XRD stake of the account on this day
            const currentXrd = state.userLsu * (state.stakeVault / state.lsuSupply);

            // Proportional reward: (account_stake / total_stake) × pool_reward
            const reward = (currentXrd / jsonTotalStake) * poolReward;

            if (reward > 0) {
                records.push({
                    date: dayStr,
                    validator: valAddr,
                    validatorName: valName,
                    accountXrd: currentXrd,
                    totalStake: jsonTotalStake,
                    proportion: currentXrd / jsonTotalStake,
                    rewardXrd: reward,
                });
            }
        }
    }

    records.sort((a, b) => a.date.localeCompare(b.date));
    return records;
}

// ── Fetch resource metadata labels ─────────────────────────────────────────────

async function fetchResourceLabels(resourceAddresses: string[]): Promise<Record<string, string>> {
    const labels: Record<string, string> = { [XRD_ADDR]: 'XRD' };

    const addrs = resourceAddresses.filter((a) => a && a !== XRD_ADDR);
    if (addrs.length === 0) return labels;

    for (let i = 0; i < addrs.length; i += 20) {
        const chunk = addrs.slice(i, i + 20);
        try {
            const resp = await gatewayPost('/state/entity/details', {
                addresses: chunk,
                opt_ins: { explicit_metadata: ['symbol', 'name'] },
            });
            for (const item of (resp.items as Record<string, unknown>[]) ?? []) {
                const addr = item.address as string;
                const metaItems = ((item.metadata as Record<string, unknown>)?.items as Record<string, unknown>[]) ?? [];

                let sym = '';
                let name = '';
                for (const mi of metaItems) {
                    const key = mi.key as string;
                    const val = ((mi.value as Record<string, unknown>)?.typed as Record<string, unknown>)?.value as string;
                    if (key === 'symbol' && val) sym = val;
                    if (key === 'name' && val) name = val;
                }

                labels[addr] = sym || name || addr.slice(-12);
            }
        } catch {
            for (const addr of chunk) {
                labels[addr] = addr.slice(-12);
            }
        }
    }

    return labels;
}

// ── Build CoinTracking CSV rows ────────────────────────────────────────────────

const CT_HEADER = [
    'Type', 'Buy Amount', 'Buy Currency', 'Sell Amount', 'Sell Currency',
    'Fee Amount', 'Fee Currency', 'Exchange', 'Trade-Group', 'Comment', 'Date', 'Tx-ID',
];

function csvRow(
    ctType: string, buyAmt: number, buyCur: string, sellAmt: number, sellCur: string,
    feeAmt: number, feeCur: string, group: string, comment: string, dateTime: string, txId = '',
): string[] {
    return [
        ctType,
        buyAmt > 0 ? buyAmt.toFixed(8) : '',
        buyAmt > 0 ? buyCur : '',
        sellAmt > 0 ? sellAmt.toFixed(8) : '',
        sellAmt > 0 ? sellCur : '',
        feeAmt > 0 ? feeAmt.toFixed(8) : '',
        feeAmt > 0 ? feeCur : '',
        'Radix Network',
        group,
        comment,
        dateTime,
        txId,
    ];
}

function buildCsvRows(
    stakingRewards: StakingRewardRecord[],
    accountTxs: AccountTx[],
    validatorNameMap: Record<string, string>,
    resourceLabels: Record<string, string>,
): string[][] {
    const rows: string[][] = [];

    // Staking reward rows
    for (const r of stakingRewards) {
        rows.push(csvRow(
            'Staking', r.rewardXrd, 'XRD', 0, '', 0, '',
            'Staking', `Staking reward — ${r.validatorName.slice(0, 35)}`,
            `${r.date} 00:00:00`,
        ));
    }

    const lbl = (resAddr: string): string =>
        resourceLabels[resAddr] ?? (resAddr ? resAddr.slice(-12) : 'UNKNOWN');

    // Transaction rows
    for (const tx of accountTxs) {
        const { txType, timestamp, hash, balanceChanges, validatorOps, fee } = tx;
        const dateTime = timestamp ? timestamp.replace('T', ' ').slice(0, 19) : `${tx.date} 00:00:00`;
        const ins = balanceChanges.filter((c) => c.direction === 'in');
        const outs = balanceChanges.filter((c) => c.direction === 'out');
        let feeToApply = fee;

        if (txType === 'stake') {
            for (const op of validatorOps) {
                rows.push(csvRow('Trade', op.lsu, 'LSU', op.xrd, 'XRD', feeToApply, feeToApply > 0 ? 'XRD' : '',
                    'Staking', `Stake → ${(validatorNameMap[op.validator] || op.validator.slice(0, 25)).slice(0, 30)}`, dateTime, hash));
                feeToApply = 0;
            }
        } else if (txType === 'unstake') {
            for (const op of validatorOps) {
                rows.push(csvRow('Withdrawal', 0, '', op.lsu, 'LSU', feeToApply, feeToApply > 0 ? 'XRD' : '',
                    'Staking', `Unstake LSU — ${(validatorNameMap[op.validator] || op.validator.slice(0, 25)).slice(0, 30)}`, dateTime, hash));
                feeToApply = 0;
            }
        } else if (txType === 'claim') {
            for (const op of validatorOps) {
                rows.push(csvRow('Deposit', op.xrd, 'XRD', 0, '', feeToApply, feeToApply > 0 ? 'XRD' : '',
                    'Staking', `Claim XRD — ${(validatorNameMap[op.validator] || op.validator.slice(0, 25)).slice(0, 30)}`, dateTime, hash));
                feeToApply = 0;
            }
        } else if (txType === 'trade') {
            for (let i = 0; i < Math.max(ins.length, outs.length); i++) {
                const b = ins[i];
                const s = outs[i];
                rows.push(csvRow('Trade',
                    b ? b.amount : 0, b ? lbl(b.resource) : '',
                    s ? s.amount : 0, s ? lbl(s.resource) : '',
                    feeToApply, feeToApply > 0 ? 'XRD' : '',
                    'Trade', 'Token swap', dateTime, hash));
                feeToApply = 0;
            }
        } else if (txType === 'deposit') {
            for (const c of ins) {
                rows.push(csvRow('Deposit', c.amount, lbl(c.resource), 0, '', feeToApply, feeToApply > 0 ? 'XRD' : '',
                    'Transfer', `Received ${lbl(c.resource)}`, dateTime, hash));
                feeToApply = 0;
            }
        } else if (txType === 'withdrawal') {
            for (const c of outs) {
                rows.push(csvRow('Withdrawal', 0, '', c.amount, lbl(c.resource), feeToApply, feeToApply > 0 ? 'XRD' : '',
                    'Transfer', `Sent ${lbl(c.resource)}`, dateTime, hash));
                feeToApply = 0;
            }
        }

        // Orphan fee
        if (feeToApply > 0) {
            rows.push(csvRow('Other Fee', 0, '', 0, '', feeToApply, 'XRD',
                'Network', 'Transaction Fee', dateTime, hash));
        }
    }

    // Sort by date column (index 10)
    rows.sort((a, b) => a[10].localeCompare(b[10]));
    return rows;
}

function rowsToCsv(rows: string[][]): string {
    const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headerLine = CT_HEADER.map(quote).join(',');
    const dataLines = rows.map((row) => row.map(quote).join(','));
    return [headerLine, ...dataLines].join('\n');
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Returns the list of years that have reward data for validators the account is staked to.
 */
export async function getAvailableYearsForAccount(accountAddress: string): Promise<string[]> {
    const redis = getRedisClient();
    if (!redis) return [];

    try {
        // Fetch validator map
        const validatorMap = await fetchAllValidators();

        // Get account LSU balances
        const stakes = await getAccountLsuBalances(accountAddress, validatorMap);
        if (Object.keys(stakes).length === 0) return [];

        // Read all rewards data from Redis
        const allData = await redis.get<Record<string, ValidatorRewardData>>(REDIS_REWARDS_ALL);
        if (!allData) return [];

        // Collect all years from staked validators
        const yearsSet = new Set<string>();
        for (const valAddr of Object.keys(stakes)) {
            const valData = allData[valAddr];
            if (valData?.yearly) {
                for (const yr of Object.keys(valData.yearly)) {
                    yearsSet.add(yr);
                }
            }
        }

        return [...yearsSet].sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    } catch (e) {
        logger.error({ err: e, accountAddress }, '[AccountRewards] Failed to get available years');
        return [];
    }
}

/**
 * Generates a CoinTracking-compatible CSV with all staking rewards and
 * transaction history for the given account and year.
 *
 * This mirrors the Python `cmd_delegant` flow:
 * 1. Fetch validators and LSU supplies
 * 2. Get account LSU balances (current)
 * 3. Fetch account transactions for the year
 * 4. For each day with pool rewards, query Gateway API for exact LSU/vault state
 * 5. Calculate proportional rewards
 * 6. Build CoinTracking CSV
 */
export async function generateAccountRewardsCsv(
    accountAddress: string,
    year: string,
): Promise<{ csv: string, totalXrd: number } | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
        logger.info({ accountAddress, year }, '[AccountRewards] Starting CSV generation');

        // 1. Fetch all validators
        const validatorMap = await fetchAllValidators();
        logger.info({ validatorCount: Object.keys(validatorMap).length }, '[AccountRewards] Validators loaded');

        // 2. Get account LSU balances (current)
        const currentStakes = await getAccountLsuBalances(accountAddress, validatorMap);
        logger.info({ stakedValidators: Object.keys(currentStakes).length }, '[AccountRewards] Account stakes resolved');

        // 3. Read all rewards data from Redis
        const allData = await redis.get<Record<string, ValidatorRewardData>>(REDIS_REWARDS_ALL);
        if (!allData) return null;

        // 4. Determine date range for the year
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // 5. Fetch account transactions for this year
        const accountTxs = await fetchAccountTransactions(accountAddress, startDate, endDate);
        logger.info({ txCount: accountTxs.length }, '[AccountRewards] Transactions fetched');

        // 6. Compute staking rewards (Gateway API calls per day)
        const stakingRewards = await computeStakingRewards(
            allData, accountAddress, validatorMap, accountTxs, currentStakes, year,
        );
        logger.info(
            { rewardEntries: stakingRewards.length, totalXrd: stakingRewards.reduce((s, r) => s + r.rewardXrd, 0).toFixed(4) },
            '[AccountRewards] Staking rewards computed',
        );

        // 7. Fetch resource metadata for tokens in transactions
        const uniqueResources = new Set<string>();
        for (const tx of accountTxs) {
            for (const c of tx.balanceChanges) {
                if (c.resource) uniqueResources.add(c.resource);
            }
        }
        const resourceLabels = await fetchResourceLabels([...uniqueResources]);

        // 8. Build validator name map
        const validatorNameMap: Record<string, string> = {};
        for (const [addr, info] of Object.entries(validatorMap)) {
            validatorNameMap[addr] = info.name;
        }

        // 9. Build and return CSV
        const csvRows = buildCsvRows(stakingRewards, accountTxs, validatorNameMap, resourceLabels);

        if (csvRows.length === 0) return null;

        const totalXrd = stakingRewards.reduce((s, r) => s + r.rewardXrd, 0);

        logger.info({ totalRows: csvRows.length, totalXrd }, '[AccountRewards] CSV generated successfully');
        return {
            csv: rowsToCsv(csvRows),
            totalXrd
        };
    } catch (e) {
        logger.error({ err: e, accountAddress, year }, '[AccountRewards] Failed to generate CSV');
        return null;
    }
}
