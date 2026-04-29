

import Big from 'big.js';

const GATEWAY_URL = 'https://mainnet.radixdlt.com';
const XRD_ADDR = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';

interface ValidatorMapEntry {
    lsuResource: string;
    vaultAddress: string;
    name: string;
}

interface AccountTx {
    date: string;
    timestamp: string;
    hash: string;
    txType: 'stake' | 'unstake' | 'claim' | 'trade' | 'deposit' | 'withdrawal' | 'other';
    balanceChanges: { resource: string; amount: number; direction: 'in' | 'out' }[];
    validatorOps: { validator: string; op: 'stake' | 'unstake' | 'claim'; xrd: number; lsu: number }[];
    fee: number;
}

interface LedgerDayState {
    userLsu: number;
    lsuSupply: number;
    stakeVault: number;
}

interface ValidatorRewardData {
    dailyDelegants?: Record<string, number>;
    dailyStake?: Record<string, number>;
    yearly?: Record<string, number>;
    yearlyDelegants?: Record<string, number>;
}

interface StakingRewardRecord {
    date: string;
    validator: string;
    validatorName: string;
    accountXrd: number;
    totalAccountXrd: number;
    totalStake: number;
    proportion: number;
    rewardXrd: number;
}

// ── Gateway API Interfaces ───────────────────────────────────────────────────

interface GatewayMetadataItem {
    key: string;
    value?: {
        typed?: {
            value?: string;
        };
    };
}

interface GatewayValidatorItem {
    address?: string;
    state?: {
        address?: string;
        stake_unit_resource_address?: string;
        stake_xrd_vault?: {
            entity_address?: string;
        };
    };
    stake_unit_resource_address?: string;
    metadata?: {
        items?: GatewayMetadataItem[];
    };
}

interface GatewayValidatorListResponse {
    validators?: {
        items?: GatewayValidatorItem[];
        next_cursor?: string | null;
    };
    items?: GatewayValidatorItem[];
    next_cursor?: string | null;
}

interface GatewayEntityDetailsItem {
    address: string;
    fungible_resources?: {
        items?: {
            resource_address: string;
            amount?: string;
            balance?: {
                value?: string;
                amount?: string;
            };
        }[];
    };
    details?: {
        total_supply?: string;
        total_minted?: string;
        balance?: string | {
            amount?: string;
            value?: string;
        };
        amount?: string;
    };
    metadata?: {
        items?: GatewayMetadataItem[];
    };
}

interface GatewayEntityDetailsResponse {
    items?: GatewayEntityDetailsItem[];
}

interface GatewayTransactionItem {
    confirmed_at?: string;
    intent_hash?: string;
    transaction_hash?: string;
    balance_changes?: {
        fungible_fee_balance_changes?: {
            entity_address: string;
            balance_change?: string;
        }[];
        fungible_balance_changes?: {
            entity_address: string;
            balance_change?: string;
            resource_address?: string;
        }[];
    };
    receipt?: {
        events?: {
            name?: string;
            emitter?: {
                entity?: {
                    entity_address?: string;
                };
            };
            data?: {
                fields?: {
                    field_name?: string;
                    value?: string;
                }[];
                programmatic_json?: {
                    fields?: {
                        field_name?: string;
                        value?: string;
                    }[];
                };
            };
        }[];
    };
}

interface GatewayTransactionStreamResponse {
    items?: GatewayTransactionItem[];
    next_cursor?: string | null;
}

// ── Gateway Operations ────────────────────────────────────────────────────────

async function gatewayPost(endpoint: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> {
    let backoff = 1000;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(`${GATEWAY_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal,
            });
            if (res.status === 429) {
                const retryAfter = parseFloat(res.headers.get('Retry-After') || '0') * 1000;
                await new Promise((r) => setTimeout(r, Math.max(retryAfter, backoff)));
                backoff *= 2;
                continue;
            }
            if (!res.ok) throw new Error(`Gateway returned ${res.status}`);
            return await res.json() as Record<string, unknown>;
        } catch (err) {
            if (attempt === 3) throw err;
            await new Promise((r) => setTimeout(r, backoff));
            backoff *= 2;
        }
    }
    throw new Error(`Exhausted retries in gatewayPost: ${endpoint}`);
}

async function fetchAllValidators(signal?: AbortSignal): Promise<Record<string, ValidatorMapEntry>> {
    const result: Record<string, ValidatorMapEntry> = {};
    let cursor: string | null = null;
    do {
        const body: Record<string, unknown> = {
            limit_per_page: 100,
            opt_ins: { validator_active_in_epoch: true, explicit_metadata: true, component_state: true },
        };
        if (cursor) body.cursor = cursor;

        const rawData = await gatewayPost('/state/validators/list', body, signal);
        const data = rawData as unknown as GatewayValidatorListResponse;
        const validatorsObj = data.validators;
        const items = validatorsObj?.items ?? data.items ?? [];

        for (const v of items) {
            const addr = v.address ?? v.state?.address ?? '';
            const state = v.state ?? {};
            const lsu = state.stake_unit_resource_address ?? v.stake_unit_resource_address ?? '';
            const vault = state.stake_xrd_vault?.entity_address ?? '';
            let name = '';
            const metaItems = v.metadata?.items ?? [];
            for (const mi of metaItems) {
                if (mi.key === 'name') {
                    name = mi.value?.typed?.value ?? '';
                    break;
                }
            }
            if (addr) {
                result[addr] = { lsuResource: lsu, vaultAddress: vault, name: name || `${addr.slice(0, 25)}…` };
            }
        }
        cursor = validatorsObj?.next_cursor ?? data.next_cursor ?? null;
    } while (cursor);
    return result;
}

async function getLedgerStateForDay(accountAddress: string, lsuResource: string, vaultAddress: string, dayStr: string, signal?: AbortSignal): Promise<LedgerDayState> {
    try {
        const rawData = await gatewayPost('/state/entity/details', {
            addresses: [accountAddress, lsuResource, vaultAddress],
            at_ledger_state: { timestamp: `${dayStr}T23:59:59Z` },
            opt_ins: { fungible_resources: true },
        }, signal);
        const data = rawData as unknown as GatewayEntityDetailsResponse;

        let userLsu = 0;
        let lsuSupply = 0;
        let stakeVault = 0;

        for (const item of (data.items ?? [])) {
            const addr = item.address;
            if (addr === accountAddress) {
                const fungibles = item.fungible_resources?.items ?? [];
                for (const res of fungibles) {
                    if (res.resource_address === lsuResource) {
                        userLsu = parseFloat(res.amount ?? res.balance?.value ?? '0');
                    }
                }
            } else if (addr === lsuResource) {
                const details = item.details ?? {};
                const supRaw = details.total_supply ?? details.total_minted;
                if (supRaw) lsuSupply = parseFloat(supRaw);
            } else if (addr === vaultAddress) {
                const details = item.details ?? {};
                const balance = details.balance ?? details.amount;
                if (balance !== null && balance !== undefined) {
                    if (typeof balance === 'object') {
                        stakeVault = parseFloat(balance.amount ?? balance.value ?? '0');
                    } else {
                        stakeVault = parseFloat(String(balance));
                    }
                }
                if (stakeVault === 0) {
                    const fungibles = item.fungible_resources?.items ?? [];
                    for (const f of fungibles) {
                        const resAddr = f.resource_address ?? '';
                        if (resAddr === XRD_ADDR || !resAddr) {
                            const rawVal = f.amount ?? f.balance?.amount ?? f.balance?.value ?? '0';
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

async function fetchAccountTransactions(accountAddress: string, startDate: string, endDate: string, signal?: AbortSignal): Promise<AccountTx[]> {
    const txs: AccountTx[] = [];
    let cursor: string | null = null;
    let done = false;

    while (!done) {
        const body: Record<string, unknown> = {
            limit_per_page: 100,
            affected_global_entities_filter: [accountAddress],
            opt_ins: { receipt_events: true, balance_changes: true },
            kind_filter: 'User',
            order: 'Asc',
        };
        if (cursor) body.cursor = cursor;

        let rawData;
        try {
            rawData = await gatewayPost('/stream/transactions', body, signal);
        } catch {
            break;
        }
        const data = rawData as unknown as GatewayTransactionStreamResponse;

        const items = data.items ?? [];
        for (const item of items) {
            const ts = item.confirmed_at ?? '';
            const dayStr = ts ? ts.slice(0, 10) : 'unknown';
            const txHash = item.intent_hash ?? item.transaction_hash ?? '';

            if (dayStr && dayStr > endDate) {
                done = true;
                break;
            }
            if (dayStr && dayStr < startDate) {
                continue;
            }

            let feePaid = 0;
            const balanceChangesObj = item.balance_changes ?? {};
            const feeChanges = balanceChangesObj.fungible_fee_balance_changes ?? [];
            for (const fbc of feeChanges) {
                if (fbc.entity_address === accountAddress) {
                    const delta = parseFloat(fbc.balance_change ?? '0');
                    if (delta < 0) feePaid += Math.abs(delta);
                }
            }

            const changes: AccountTx['balanceChanges'] = [];
            const fungibleChanges = balanceChangesObj.fungible_balance_changes ?? [];
            for (const bc of fungibleChanges) {
                if (bc.entity_address !== accountAddress) continue;
                const delta = parseFloat(bc.balance_change ?? '0');
                if (delta !== 0) {
                    changes.push({
                        resource: bc.resource_address ?? '',
                        amount: Math.abs(delta),
                        direction: delta > 0 ? 'in' : 'out',
                    });
                }
            }

            const valOps: AccountTx['validatorOps'] = [];
            const receiptEvents = item.receipt?.events ?? [];
            for (const ev of receiptEvents) {
                const evName = ev.name ?? '';
                const emitter = ev.emitter?.entity?.entity_address ?? '';
                if (!emitter.startsWith('validator_')) continue;

                const fields = ev.data?.fields ?? ev.data?.programmatic_json?.fields ?? [];
                const gf = (name: string): string => {
                    for (const f of fields) {
                        if (f.field_name === name) return f.value ?? '0';
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

            const opsSet = new Set(valOps.map((o) => o.op));
            let txType: AccountTx['txType'] = 'other';
            if (opsSet.has('stake')) txType = 'stake';
            else if (opsSet.has('unstake')) txType = 'unstake';
            else if (opsSet.has('claim')) txType = 'claim';
            else if (changes.length > 0) {
                const hasIn = changes.some((c) => c.direction === 'in');
                const hasOut = changes.some((c) => c.direction === 'out');
                txType = hasIn && hasOut ? 'trade' : hasIn ? 'deposit' : 'withdrawal';
            }

            if (changes.length > 0 || valOps.length > 0 || feePaid > 0) {
                txs.push({ date: dayStr, timestamp: ts, hash: txHash, txType, balanceChanges: changes, validatorOps: valOps, fee: feePaid });
            }
        }
        if (!data.next_cursor || items.length === 0 || done) break;
        cursor = data.next_cursor;
    }
    return txs;
}

async function fetchResourceLabels(resourceAddresses: string[], signal?: AbortSignal): Promise<Record<string, string>> {
    const labels: Record<string, string> = { [XRD_ADDR]: 'XRD' };
    const addrs = resourceAddresses.filter((a) => a && a !== XRD_ADDR);
    if (addrs.length === 0) return labels;

    for (let i = 0; i < addrs.length; i += 20) {
        const chunk = addrs.slice(i, i + 20);
        try {
            const rawData = await gatewayPost('/state/entity/details', { addresses: chunk, opt_ins: { explicit_metadata: ['symbol', 'name'] } }, signal);
            const resp = rawData as unknown as GatewayEntityDetailsResponse;
            for (const item of (resp.items ?? [])) {
                const addr = item.address;
                const metaItems = item.metadata?.items ?? [];
                let sym = '', name = '';
                for (const mi of metaItems) {
                    const key = mi.key;
                    const val = mi.value?.typed?.value;
                    if (key === 'symbol' && val) sym = val;
                    if (key === 'name' && val) name = val;
                }
                labels[addr] = sym || name || addr.slice(-12);
            }
        } catch {
            for (const addr of chunk) labels[addr] = addr.slice(-12);
        }
    }
    return labels;
}

// ── Math Calculation & Simulation ──────────────────────────────────────────

async function computeStakingRewardsMath(
    allRewards: Record<string, ValidatorRewardData>,
    accountAddress: string,
    validatorMap: Record<string, ValidatorMapEntry>,
    accountTxs: AccountTx[],
    year: string,
    onProgress: (p: number) => void,
    signal?: AbortSignal
): Promise<MathResult> {
    const records: StakingRewardRecord[] = [];

    const usedValidators = new Set<string>();
    for (const tx of accountTxs) {
        for (const op of tx.validatorOps) {
            usedValidators.add(op.validator);
        }
    }
    for (const valAddr of Object.keys(allRewards)) {
        usedValidators.add(valAddr);
    }

    const prevYear = parseInt(year) - 1;
    const extraDates = new Set<string>();
    for (const tx of accountTxs) {
        if (tx.txType === 'unstake' || tx.txType === 'claim') {
            extraDates.add(tx.date);
        }
    }
    if (accountTxs.length > 0) {
        extraDates.add(accountTxs[accountTxs.length - 1].date);
    }

    const qDates = Array.from(new Set([
        `${prevYear}-12-31`,
        `${year}-03-31`,
        `${year}-06-30`,
        `${year}-09-30`,
        `${year}-12-31`,
        ...extraDates
    ])).filter(d => d.startsWith(year) || d === `${prevYear}-12-31`).sort();

    // Pre-fetch all required snapshots in parallel batches of 15
    const snapshotCache: Record<string, LedgerDayState> = {};
    const prefetchTasks: { valAddr: string; dateStr: string }[] = [];

    for (const valAddr of usedValidators) {
        const valInfo = validatorMap[valAddr];
        if (!valInfo?.lsuResource || !valInfo?.vaultAddress) continue;
        for (const dateStr of qDates) {
            prefetchTasks.push({ valAddr, dateStr });
        }
    }

    const BATCH_SIZE = 15;
    for (let i = 0; i < prefetchTasks.length; i += BATCH_SIZE) {
        const batch = prefetchTasks.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (task) => {
            if (signal?.aborted) return;
            const valInfo = validatorMap[task.valAddr];
            if (!valInfo) return;
            const key = `${task.valAddr}_${task.dateStr}`;
            snapshotCache[key] = await getLedgerStateForDay(accountAddress, valInfo.lsuResource, valInfo.vaultAddress, task.dateStr, signal);
        }));
    }

    let processed = 0;
    const totalVals = usedValidators.size;

    // To calculate total balance, we need to store results for each validator
    const validatorDailyBalances: Record<string, Record<string, number>> = {}; // valAddr -> { date -> balance }
    const validatorTxBalances: Record<string, Record<string, number>> = {}; // valAddr -> { hash -> balance }
    
    for (const valAddr of usedValidators) {
        if (signal?.aborted) throw new Error('Aborted');
        processed++;
        const valData = allRewards[valAddr];
        if (!valData) continue;
        const dailyDelegants = valData.dailyDelegants ?? {};
        const dailyStake = valData.dailyStake ?? {};
        const yearDays = Object.keys(dailyDelegants).filter((d) => d.startsWith(year)).sort();
        if (yearDays.length === 0) continue;

        const valInfo = validatorMap[valAddr];
        if (!valInfo?.lsuResource || !valInfo?.vaultAddress) continue;
        const valName = valInfo.name || `${valAddr.slice(0, 25)}…`;

        // Extract daily transactions for this validator
        const txsByDay: Record<string, AccountTx['validatorOps']> = {};
        for (const tx of accountTxs) {
            const ops = tx.validatorOps.filter(op => op.validator === valAddr);
            if (ops.length > 0) {
                if (!txsByDay[tx.date]) txsByDay[tx.date] = [];
                txsByDay[tx.date].push(...ops);
            }
        }

        const getCachedSnapshot = (dateStr: string) => {
            const key = `${valAddr}_${dateStr}`;
            return snapshotCache[key] || { userLsu: 0, lsuSupply: 0, stakeVault: 0 };
        };

        let currentInitialStakeXrd = new Big(0);
        let currentInitialStakeLsu = new Big(0);

        const startState = getCachedSnapshot(qDates[0]);
        if (startState.lsuSupply > 0) {
            const vaultB = new Big(startState.stakeVault);
            const supplyB = new Big(startState.lsuSupply);
            const userB = new Big(startState.userLsu);
            currentInitialStakeXrd = userB.times(vaultB).div(supplyB);
            currentInitialStakeLsu = userB;
        }

        validatorDailyBalances[valAddr] = {};
        validatorTxBalances[valAddr] = {};

        for (let i = 0; i < qDates.length - 1; i++) {
            const pStart = qDates[i];
            const pEnd = qDates[i + 1];

            const periodDays = yearDays.filter(d => d > pStart && d <= pEnd);
            if (periodDays.length === 0) continue;

            const endState = getCachedSnapshot(pEnd);
            const exactFinalStakeXrd = endState.lsuSupply > 0
                ? new Big(endState.userLsu).times(new Big(endState.stakeVault)).div(new Big(endState.lsuSupply))
                : new Big(0);

            // SIMULATION PHASE for period
            let calcStakeXrd = new Big(currentInitialStakeXrd);
            let calcUserLsu = new Big(currentInitialStakeLsu);
            let txVolumeInPeriod = new Big(0);

            for (const dayStr of periodDays) {
                if (signal?.aborted) throw new Error('Aborted');
                const ops = txsByDay[dayStr] || [];
                for (const op of ops) {
                    txVolumeInPeriod = txVolumeInPeriod.plus(new Big(Math.abs(op.xrd) || Math.abs(op.lsu)));
                    if (op.op === 'stake') {
                        calcUserLsu = calcUserLsu.plus(new Big(op.lsu));
                        calcStakeXrd = calcStakeXrd.plus(new Big(op.xrd));
                    } else if (op.op === 'unstake') {
                        const proportion = calcUserLsu.gt(0) ? new Big(op.lsu).div(calcUserLsu) : new Big(0);
                        const xrdUnstaked = calcStakeXrd.times(proportion);
                        calcUserLsu = calcUserLsu.minus(new Big(op.lsu));
                        calcStakeXrd = calcStakeXrd.minus(xrdUnstaked);
                    }
                }

                const poolReward = new Big(dailyDelegants[dayStr] ?? 0);
                const jsonTotalStake = new Big(dailyStake[dayStr] ?? 0);
                if (poolReward.gt(0) && jsonTotalStake.gt(0) && calcStakeXrd.gt(0)) {
                    const reward = calcStakeXrd.div(jsonTotalStake).times(poolReward);
                    calcStakeXrd = calcStakeXrd.plus(reward);
                }
            }

            let diffPercent = new Big(0);
            if (calcStakeXrd.gt(0)) {
                diffPercent = exactFinalStakeXrd.minus(calcStakeXrd).div(calcStakeXrd);
            }

            // ACTUAL CALCULATION PHASE for period
            calcStakeXrd = new Big(currentInitialStakeXrd);
            calcUserLsu = new Big(currentInitialStakeLsu);
            let txVolumeUpToDay = new Big(0);
            let dayIndex = 0;

            for (const dayStr of periodDays) {
                if (signal?.aborted) throw new Error('Aborted');
                dayIndex++;

                const validatorProgressBase = ((processed - 1) / totalVals) * 100;
                const periodProgressFraction = ((i + (dayIndex / periodDays.length)) / (qDates.length - 1)) * (100 / totalVals);
                onProgress(validatorProgressBase + periodProgressFraction);

                const ops = txsByDay[dayStr] || [];
                for (const op of ops) {
                    const opVol = new Big(Math.abs(op.xrd) || Math.abs(op.lsu));
                    txVolumeUpToDay = txVolumeUpToDay.plus(opVol);
                    if (op.op === 'stake') {
                        calcUserLsu = calcUserLsu.plus(new Big(op.lsu));
                        calcStakeXrd = calcStakeXrd.plus(new Big(op.xrd));
                    } else if (op.op === 'unstake') {
                        const proportion = calcUserLsu.gt(0) ? new Big(op.lsu).div(calcUserLsu) : new Big(0);
                        const xrdUnstaked = calcStakeXrd.times(proportion);
                        calcUserLsu = calcUserLsu.minus(new Big(op.lsu));
                        calcStakeXrd = calcStakeXrd.minus(xrdUnstaked);
                    }
                }

                const weightTime = dayIndex / periodDays.length;
                const weightEvent = txVolumeInPeriod.gt(0) ? txVolumeUpToDay.div(txVolumeInPeriod).toNumber() : weightTime;
                const finalWeight = (weightTime + weightEvent) / 2;

                const correctedStakeXrd = calcStakeXrd.times(new Big(1).plus(diffPercent.times(finalWeight)));

                const poolReward = new Big(dailyDelegants[dayStr] ?? 0);
                const jsonTotalStake = new Big(dailyStake[dayStr] ?? 0);
                let reward = new Big(0);

                if (poolReward.gt(0) && jsonTotalStake.gt(0) && correctedStakeXrd.gt(0)) {
                    reward = correctedStakeXrd.div(jsonTotalStake).times(poolReward);
                    calcStakeXrd = calcStakeXrd.plus(reward);

                    validatorDailyBalances[valAddr][dayStr] = correctedStakeXrd.toNumber();
                    records.push({
                        date: dayStr,
                        validator: valAddr,
                        validatorName: valName,
                        accountXrd: correctedStakeXrd.toNumber(),
                        totalAccountXrd: 0, // Fill in later pass
                        totalStake: jsonTotalStake.toNumber(),
                        proportion: correctedStakeXrd.div(jsonTotalStake).toNumber(),
                        rewardXrd: reward.toNumber(),
                    });
                }

                // Also record balance for transactions on this day
                const dayOps = txsByDay[dayStr] || [];
                if (dayOps.length > 0) {
                    const txHashesOnDay = new Set(accountTxs.filter(tx => tx.date === dayStr).map(tx => tx.hash));
                    for (const hash of txHashesOnDay) {
                        validatorTxBalances[valAddr][hash] = correctedStakeXrd.toNumber();
                    }
                }
            }

            currentInitialStakeXrd = exactFinalStakeXrd;
            const endPeriodState = getCachedSnapshot(pEnd);
            currentInitialStakeLsu = new Big(endPeriodState.userLsu);
        }
    }

    // Second pass: Sum up balances across all validators
    const dailyTotalBalance: Record<string, number> = {};
    const txTotalBalance: Record<string, number> = {};

    for (const valAddr of Object.keys(validatorDailyBalances)) {
        for (const [date, bal] of Object.entries(validatorDailyBalances[valAddr])) {
            dailyTotalBalance[date] = (dailyTotalBalance[date] || 0) + bal;
        }
        for (const [hash, bal] of Object.entries(validatorTxBalances[valAddr])) {
            txTotalBalance[hash] = (txTotalBalance[hash] || 0) + bal;
        }
    }

    // Update records with total balance
    for (const r of records) {
        r.totalAccountXrd = dailyTotalBalance[r.date] || r.accountXrd;
    }

    records.sort((a, b) => a.date.localeCompare(b.date));
    return { records, txTotalBalance };
}

interface MathResult {
    records: StakingRewardRecord[];
    txTotalBalance: Record<string, number>;
}

// ── Build CoinTracking CSV rows ────────────────────────────────────────────────

const CT_HEADER = [
    'Type', 'Buy Amount', 'Buy Currency', 'Sell Amount', 'Sell Currency',
    'Fee Amount', 'Fee Currency', 'Exchange', 'Trade-Group', 'Comment', 'Date', 'Tx-ID', 'Staking Balance'
];

function csvRow(
    ctType: string, buyAmt: number, buyCur: string, sellAmt: number, sellCur: string,
    feeAmt: number, feeCur: string, group: string, comment: string, dateTime: string, txId = '',
    stakingBalance?: number
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
        stakingBalance !== undefined ? stakingBalance.toFixed(8) : '',
    ];
}

function buildCsvRows(
    stakingRewards: StakingRewardRecord[],
    accountTxs: AccountTx[],
    txBalances: Record<string, number>,
    validatorNameMap: Record<string, string>,
    resourceLabels: Record<string, string>,
): string[][] {
    const rows: string[][] = [];

    for (const r of stakingRewards) {
        rows.push(csvRow(
            'Staking', r.rewardXrd, 'XRD', 0, '', 0, '',
            'Staking', `Staking reward — ${r.validatorName.slice(0, 35)}`,
            `${r.date} 00:00:00`,
            '',
            r.totalAccountXrd
        ));
    }

    const lbl = (resAddr: string): string => resourceLabels[resAddr] ?? (resAddr ? resAddr.slice(-12) : 'UNKNOWN');

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
                rows.push(csvRow('Trade', b ? b.amount : 0, b ? lbl(b.resource) : '', s ? s.amount : 0, s ? lbl(s.resource) : '',
                    feeToApply, feeToApply > 0 ? 'XRD' : '', 'Trade', 'Token swap', dateTime, hash));
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

        if (feeToApply > 0) {
            rows.push(csvRow('Other Fee', 0, '', 0, '', feeToApply, 'XRD', 'Network', 'Transaction Fee', dateTime, hash, txBalances[hash]));
        } else {
            // Even if fee is 0, we might want to update the last row added for this tx with the balance
            const lastRow = rows[rows.length - 1];
            if (lastRow && lastRow[11] === hash) {
                lastRow[12] = txBalances[hash] !== undefined ? txBalances[hash].toFixed(8) : '';
            }
        }
    }

    rows.sort((a, b) => a[10].localeCompare(b[10]));
    return rows;
}

function rowsToCsv(rows: string[][]): string {
    const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headerLine = CT_HEADER.map(quote).join(',');
    const dataLines = rows.map((row) => row.map(quote).join(','));
    return [headerLine, ...dataLines].join('\n');
}

export async function generateClientAccountRewardsCsv(
    accountAddress: string,
    year: string,
    onProgress: (p: number) => void,
    signal?: AbortSignal
): Promise<{ csv: string, totalXrd: number }> {
    onProgress(5);

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    // 1, 2, 3. Fetch all in parallel
    const [validatorMap, rewardsData, accountTxs] = await Promise.all([
        fetchAllValidators(signal),
        fetch(`/api/account-rewards-data?year=${year}`, { signal }).then(async res => {
            if (!res.ok) throw new Error('Failed to fetch rewards data');
            const data = await res.json();
            return data.rewardsData;
        }),
        fetchAccountTransactions(accountAddress, startDate, endDate, signal)
    ]);
    onProgress(20);

    // 4. Compute staking rewards with simulation math
    // We pass 20-90% progress to computeStakingRewardsMath
    const { records: stakingRewards, txTotalBalance } = await computeStakingRewardsMath(
        rewardsData, accountAddress, validatorMap, accountTxs, year,
        (p) => onProgress(20 + p * 0.7), // Map 0-100 to 20-90
        signal
    );
    onProgress(90);

    // 5. Fetch resource metadata for tokens in transactions
    const uniqueResources = new Set<string>();
    for (const tx of accountTxs) {
        for (const c of tx.balanceChanges) {
            if (c.resource) uniqueResources.add(c.resource);
        }
    }
    const resourceLabels = await fetchResourceLabels([...uniqueResources], signal);
    onProgress(95);

    // 6. Build validator name map
    const validatorNameMap: Record<string, string> = {};
    for (const [addr, info] of Object.entries(validatorMap)) {
        validatorNameMap[addr] = info.name;
    }

    // 7. Build and return CSV
    const csvRows = buildCsvRows(stakingRewards, accountTxs, txTotalBalance, validatorNameMap, resourceLabels);
    if (csvRows.length === 0) throw new Error('No data found for this year');

    const totalXrd = stakingRewards.reduce((s, r) => s + r.rewardXrd, 0);
    onProgress(100);

    return {
        csv: rowsToCsv(csvRows),
        totalXrd
    };
}
