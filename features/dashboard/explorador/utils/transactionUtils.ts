/**
 * features/dashboard/explorador/utils/transactionUtils.ts
 *
 * Centralized logic for resolving transaction types and flags
 * to avoid duplication across components.
 */

import type { TranslationsT, GatewayEvent, GatewayField, FeeDestination, FungibleChange } from '@/features/dashboard/types';
import type { BalanceChanges } from '../types';
import { sanitizeText } from '@/utils/sanitize';

/** A single hop in the DEX routing path */
export interface SwapHop {
    component: string;
    name: string;
}

/** Extracted swap data for the SwapSettlementCard */
export interface SwapData {
    soldToken: { resource: string; amount: string };
    receivedToken: { resource: string; amount: string };
    dexComponent: string;
    initiatorAddress: string;
    routingHops: SwapHop[];
    minReceivedAmount?: string;
}

export function resolveTransactionType(
    classes: string[],
    events: { name?: string }[],
    tt?: Partial<TranslationsT['dashboard']['transactions']>
): string {
    if (classes.includes('ProtocolVote') || events.some((e) => e.name === 'ProtocolUpdateReadinessSignalEvent')) {
        return tt?.tx_type_protocol_vote || 'Protocol Vote';
    }
    if (classes.length === 0) return tt?.tx_type_general || 'General';

    const c = classes[0];
    if (c === 'ValidatorStake') return tt?.tx_type_stake || 'Stake';
    if (c === 'ValidatorUnstake') return tt?.tx_type_unstake || 'Unstake';
    if (c === 'ValidatorClaimXrd' || c === 'ValidatorClaim') return tt?.tx_type_claim || 'Claim';
    if (c === 'Transfer') return tt?.tx_type_transfer || 'Transfer';
    if (c === 'AccountDepositSettingsUpdate') return tt?.tx_type_settings || 'Settings';

    return c || (tt?.tx_type_general || 'General');
}

export function getTransactionFlags(classes: string[]) {
    const primaryClass = classes[0] ?? '';
    return {
        isStake: primaryClass === 'ValidatorStake',
        isUnstake: primaryClass === 'ValidatorUnstake',
        isClaim: primaryClass === 'ValidatorClaimXrd' || primaryClass === 'ValidatorClaim',
        isTransfer: primaryClass === 'Transfer',
    };
}

export function isSwapTransaction(events: GatewayEvent[]): boolean {
    return events.some(e => {
        const name = e.name || '';
        return name === 'SwapEvent' || name.includes('Swap');
    });
}

/**
 * Detects if a swap is a normal swap (Token A -> Token B) or arbitrage (Token A -> ... -> Token A).
 */
export function detectSwapMode(events: GatewayEvent[], initiatorAddrs: string[]): 'NORMAL_SWAP' | 'ARBITRAGE' | 'NOT_SWAP' {
    let hasSwap = false;
    const tokensOut = new Set<string>();
    const tokensIn = new Set<string>();

    for (const ev of events) {
        if (ev.name === 'SwapEvent' || (ev.name && ev.name.includes('Swap'))) {
            hasSwap = true;
        }

        // Analyze if the user account emitted deposits or withdrawals
        const ent = ev.emitter?.entity?.entity_address;
        if (ent && initiatorAddrs.includes(ent)) {
            const fields = ev.data?.fields || [];

            // Look for the field containing the resource address
            const resField = fields.find((f: GatewayField) =>
                f.field_name === 'resource_address' ||
                f.type_name === 'ResourceAddress' ||
                (typeof f.value === 'string' && f.value.startsWith('resource_'))
            );

            if (resField && typeof resField.value === 'string') {
                if (ev.name === 'WithdrawEvent') tokensOut.add(resField.value);
                if (ev.name === 'DepositEvent') tokensIn.add(resField.value);
            }
        }
    }

    if (!hasSwap) return 'NOT_SWAP';

    // If any token that left came back into the same account, it's an ARBITRAGE
    for (const token of Array.from(tokensOut)) {
        if (tokensIn.has(token)) {
            return 'ARBITRAGE';
        }
    }

    return 'NORMAL_SWAP';
}

/**
 * Extracts the "minimum expected amount" from manifest instructions.
 * Looks for ASSERT_WORKTOP_CONTAINS followed by Decimal("...") a few lines below.
 */
export function extractMinAmount(manifest?: string): string | undefined {
    if (!manifest) return undefined;

    // Split into lines for easier processing
    const lines = manifest.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Find the ASSERT_WORKTOP_CONTAINS instruction
        if (line.includes('ASSERT_WORKTOP_CONTAINS')) {
            // Look ahead up to 5 lines for a Decimal("...")
            for (let j = i + 1; j <= i + 5 && j < lines.length; j++) {
                const nextLine = lines[j].trim();
                const match = nextLine.match(/Decimal\("([^"]+)"\)/);
                if (match) {
                    return match[1];
                }
            }
        }
    }

    return undefined;
}

export function extractSwapData(
    events: GatewayEvent[],
    balanceChanges: BalanceChanges | undefined,
    initiators: Set<string>,
    manifestInstructions?: string
): SwapData | null {
    if (!balanceChanges) return null;

    const swapEvent = events.find(e => {
        const name = e.name || '';
        return name === 'SwapEvent' || name.includes('Swap');
    });
    const dexComponent = sanitizeText(swapEvent?.emitter?.entity?.entity_address || '');

    const seenHops = new Set<string>();
    const routingHops: SwapHop[] = [];
    for (const e of events) {
        const eName = e.name || '';
        if (eName === 'SwapEvent' || eName.includes('Swap')) {
            const addr = sanitizeText(e.emitter?.entity?.entity_address || '');
            if (addr && !seenHops.has(addr)) {
                seenHops.add(addr);
                routingHops.push({ component: addr, name: eName });
            }
        }
    }

    const fungibles = balanceChanges.fungible_balance_changes ?? [];
    const initiatorAddrs = Array.from(initiators);

    const grossOut = new Map<string, number>();
    const grossIn = new Map<string, number>();

    for (const ev of events) {
        const ent = sanitizeText(ev.emitter?.entity?.entity_address || '');
        if (initiatorAddrs.includes(ent)) {
            if (ev.name === 'DepositEvent' || ev.name === 'WithdrawEvent') {
                const fields = ev.data?.fields || [];
                let res = '';
                let amt = 0;
                for (const f of fields) {
                    const val = f.value;
                    if (typeof val === 'string' && (f.type_name === 'ResourceAddress' || f.field_name === 'resource_address' || val.startsWith('resource_'))) {
                        res = sanitizeText(val);
                    }
                    if ((f.kind === 'Decimal' || f.field_name === 'amount') && (typeof val === 'string' || typeof val === 'number')) {
                        amt = parseFloat(String(val));
                    }
                }
                if (res && amt > 0) {
                    if (ev.name === 'DepositEvent') grossIn.set(res, (grossIn.get(res) || 0) + amt);
                    if (ev.name === 'WithdrawEvent') grossOut.set(res, (grossOut.get(res) || 0) + amt);
                }
            }
        }
    }

    let soldResource = '';
    let soldAmount = 0;
    let receivedResource = '';
    let receivedAmount = 0;

    if (grossOut.size > 0 && grossIn.size > 0) {
        for (const [res, amt] of grossOut.entries()) {
            if (amt > soldAmount) { soldAmount = amt; soldResource = res; }
        }
        for (const [res, amt] of grossIn.entries()) {
            if (amt > receivedAmount) { receivedAmount = amt; receivedResource = res; }
        }
    } else {
        const soldChanges = fungibles.filter(c =>
            initiatorAddrs.includes(sanitizeText(c.entity_address)) &&
            parseFloat(c.balance_change) < 0
        );

        const receivedChanges = fungibles.filter(c =>
            initiatorAddrs.includes(sanitizeText(c.entity_address)) &&
            parseFloat(c.balance_change) > 0
        );

        if (soldChanges.length === 0 || receivedChanges.length === 0) return null;

        const sold = soldChanges.reduce((max, c) =>
            Math.abs(parseFloat(c.balance_change)) > Math.abs(parseFloat(max.balance_change)) ? c : max
            , soldChanges[0]);

        const received = receivedChanges.reduce((max, c) =>
            parseFloat(c.balance_change) > parseFloat(max.balance_change) ? c : max
            , receivedChanges[0]);

        soldResource = sanitizeText(sold.resource_address);
        soldAmount = Math.abs(parseFloat(sold.balance_change));
        receivedResource = sanitizeText(received.resource_address);
        receivedAmount = parseFloat(received.balance_change);
    }

    if (!soldResource || !receivedResource) return null;

    const initiatorAddress = initiatorAddrs[0] || '';

    return {
        soldToken: {
            resource: soldResource,
            amount: soldAmount.toString(),
        },
        receivedToken: {
            resource: receivedResource,
            amount: receivedAmount.toString(),
        },
        dexComponent,
        initiatorAddress,
        routingHops,
        minReceivedAmount: extractMinAmount(manifestInstructions),
    };
}

function short(addr: string): string {
    const c = sanitizeText(addr);
    return c.length > 26 ? `${c.slice(0, 16)}...${c.slice(-6)}` : c;
}

function fmtNum(n: number): string {
    if (n === 0) return '0';
    const abs = Math.abs(n);
    let str = abs.toFixed(4);
    if (str.includes('.')) {
        str = str.replace(/0+$/, '').replace(/\.$/, '');
    }
    if (str === '0' || str === '') {
        const [mantissa, exponent] = abs.toExponential().split('e');
        return `${parseFloat(mantissa).toFixed(2).replace(/\.?0+$/, '')}x10^${exponent}`;
    }
    return str;
}

export function buildSwapRoutingChart(
    events: GatewayEvent[],
    fungibles: FungibleChange[],
    feeEntries: FungibleChange[],
    initiatorAddrs: string[],
    names: Map<string, string>,
    symbols: Map<string, string>,
    blueprintNames: Map<string, string>,
    tt?: Partial<TranslationsT['dashboard']['transactions']>,
    feePaid: number = 0,
    feeDest?: FeeDestination,
    feePayer?: string
): string {
    const isInit = (a: string) => initiatorAddrs.includes(a);
    const isBurn = (a: string) => a.startsWith('resource_');
    const isValidator = (a: string) => a.includes('consensusmanager');
    const isDex = (a: string) => !isInit(a) && !isBurn(a) && !isValidator(a);

    const ids = new Map<string, string>();
    let counter = 0;
    const nid = (a: string) => {
        const key = sanitizeText(a);
        if (!ids.has(key)) ids.set(key, `N${counter++}`);
        return ids.get(key)!;
    };

    const label = (a: string) => {
        const c = sanitizeText(a);
        const raw = names.get(c) || short(c);
        return raw.replace(/\s*\(.*?\)\s*/g, '').trim();
    };

    const getSymbol = (r: string) => {
        const c = sanitizeText(r);
        return symbols.get(c) || (c.includes('radxrd') ? 'XRD' : `TKN_${c.slice(-4).toUpperCase()}`);
    };

    const allEntries = [...fungibles, ...feeEntries];
    const complexity = allEntries.length;
    const scale = Math.min(3.0, Math.max(1.0, 1 + (complexity - 3) * 0.15));

    const fHeader = Math.round(20 * scale);
    const fTitle = Math.round(20 * scale);
    const fAmount = Math.round(18 * scale);
    const fEdge = Math.round(18 * scale);
    const fFee = Math.round(16 * scale);
    const strokeW = Math.max(3, Math.round(2.5 * scale));

    type AmtMap = Map<string, number>;
    const entityIn = new Map<string, AmtMap>();
    const entityOut = new Map<string, AmtMap>();

    const addFlow = (map: Map<string, AmtMap>, ent: string, res: string, amt: number) => {
        if (!map.has(ent)) map.set(ent, new Map());
        map.get(ent)!.set(res, (map.get(ent)!.get(res) || 0) + amt);
    };

    // ─────────────────────────────────────────────────────────
    // 1. EXTRACT GROSS FLOWS FOR EDGES (LINES)
    // ─────────────────────────────────────────────────────────
    const processedFromEvents = new Set<string>();
    if (events && Array.isArray(events)) {
        for (const ev of events) {
            const ent = ev.emitter?.entity?.entity_address;
            if (!ent || isValidator(ent) || isBurn(ent)) continue;

            if (ev.name === 'DepositEvent' || ev.name === 'WithdrawEvent') {
                processedFromEvents.add(ent);
                const fields = ev.data?.fields || [];
                let res = '';
                let amt = 0;
                for (const f of fields) {
                    const val = f.value;
                    if (typeof val === 'string' && (f.type_name === 'ResourceAddress' || f.field_name === 'resource_address' || val.startsWith('resource_'))) {
                        res = sanitizeText(val);
                    }
                    if ((f.kind === 'Decimal' || f.field_name === 'amount') && (typeof val === 'string' || typeof val === 'number')) {
                        amt = parseFloat(String(val));
                    }
                }
                if (res && amt > 0) {
                    if (ev.name === 'DepositEvent') addFlow(entityIn, ent, res, amt);
                    if (ev.name === 'WithdrawEvent') addFlow(entityOut, ent, res, amt);
                }
            }
        }
    }

    for (const fc of allEntries) {
        const ent = sanitizeText(fc.entity_address);
        if (processedFromEvents.has(ent)) continue;
        const res = sanitizeText(fc.resource_address);
        const val = parseFloat(fc.balance_change);
        if (val > 0) addFlow(entityIn, ent, res, val);
        else if (val < 0) addFlow(entityOut, ent, res, Math.abs(val));
    }

    // ─────────────────────────────────────────────────────────
    // 2. EXTRACT NET FLOWS FOR TEXT BOXES (ACCOUNT CARDS)
    // ─────────────────────────────────────────────────────────
    const netEntityIn = new Map<string, AmtMap>();
    const netEntityOut = new Map<string, AmtMap>();

    for (const fc of allEntries) {
        const ent = sanitizeText(fc.entity_address);
        const res = sanitizeText(fc.resource_address);
        const val = parseFloat(fc.balance_change);

        if (val > 0) addFlow(netEntityIn, ent, res, val);
        else if (val < 0) addFlow(netEntityOut, ent, res, Math.abs(val));
    }

    // ─────────────────────────────────────────────────────────
    // 3. PRECALCULATE EDGES TO ONLY SHOW CONNECTED ENTITIES
    // ─────────────────────────────────────────────────────────
    const allTokens = new Set<string>();
    for (const outMap of entityOut.values()) for (const res of outMap.keys()) allTokens.add(res);
    for (const inMap of entityIn.values()) for (const res of inMap.keys()) allTokens.add(res);

    interface EdgeData { sourceAddr: string; targetAddr: string; res: string; amt: number; }
    const rawEdges: EdgeData[] = [];

    for (const res of allTokens) {
        const sources: { id: string; amt: number }[] = [];
        for (const [ent, outMap] of entityOut.entries()) {
            if (outMap.has(res) && !isValidator(ent) && !isBurn(ent)) sources.push({ id: ent, amt: outMap.get(res)! });
        }

        const targets: { id: string; amt: number }[] = [];
        for (const [ent, inMap] of entityIn.entries()) {
            if (inMap.has(res) && !isValidator(ent) && !isBurn(ent)) targets.push({ id: ent, amt: inMap.get(res)! });
        }

        // ==========================================
        // LA MAGIA ESTÁ AQUÍ: ORDENAR (SORTING)
        // Evita el cruce de cables en arbitrajes
        // ==========================================

        // Sources: Los Initiators (Usuarios) deben gastar su dinero primero, luego los DEXes.
        sources.sort((a, b) => (isInit(a.id) === isInit(b.id) ? 0 : isInit(a.id) ? -1 : 1));

        // Targets: Los DEXes deben recibir el dinero primero, luego los Initiators (Usuarios).
        targets.sort((a, b) => (isInit(a.id) === isInit(b.id) ? 0 : !isInit(a.id) ? -1 : 1));

        // ==========================================

        let sIdx = 0;
        let tIdx = 0;
        while (sIdx < sources.length && tIdx < targets.length) {
            const s = sources[sIdx];
            const t = targets[tIdx];
            const transferAmt = Math.min(s.amt, t.amt);

            if (transferAmt > 1e-8 && s.id !== t.id) {
                rawEdges.push({ sourceAddr: s.id, targetAddr: t.id, res, amt: transferAmt });
            }

            s.amt -= transferAmt;
            t.amt -= transferAmt;
            if (s.amt <= 1e-8) sIdx++;
            if (t.amt <= 1e-8) tIdx++;
        }
    }

    const connectedEntities = new Set<string>();
    for (const edge of rawEdges) {
        connectedEntities.add(edge.sourceAddr);
        connectedEntities.add(edge.targetAddr);
    }
    if (feePaid > 0 && feePayer) connectedEntities.add(feePayer);

    let cssInjected = false;
    const buildNodeHtml = (addr: string, mode: 'sender' | 'receiver' | 'other' = 'other') => {
        const c = sanitizeText(addr);
        const name = names.get(c);
        const bp = blueprintNames.get(c);
        const isAccount = addr.startsWith('account_');
        const minWidth = Math.round((isAccount ? 260 : 120) * scale);
        const padX = Math.round(12 * scale);

        let extraCss = '';
        if (!cssInjected) {
            const arrowScale = Math.max(1.5, scale * 1.5);
            extraCss = `<style> marker[id*='arrowhead'] path { transform: scale(${arrowScale}); transform-origin: center; } </style>`;
            cssInjected = true;
        }

        const copyTooltip = `${tt?.click_to_copy || 'Click to copy'} ${addr}`;
        const parts: string[] = [
            `<div data-diag-copy="${addr}" title='${copyTooltip}' style='min-width: ${minWidth}px; padding: 0 ${padX}px; cursor: pointer;'>`,
            extraCss
        ];

        if (name) {
            parts.push(`<div style='margin-bottom:2px; font-size:${fTitle}px;'><b>${label(addr)}</b></div>`);
            if (bp) parts.push(`<div style='font-size:${fTitle}px; opacity:0.7; margin-bottom:4px;'>${bp}</div>`);
        } else if (bp) {
            parts.push(`<div style='margin-bottom:4px; font-size:${fTitle}px;'><b>${bp}</b></div>`);
        } else {
            parts.push(`<div style='margin-bottom:4px; font-family:monospace; font-size:${fTitle}px;'><b>${short(addr)}</b></div>`);
        }

        parts.push(`<div style='height:1px; border-top:1px dashed rgba(var(--color-text-main-rgb),0.15); margin:4px 0;'></div>`);

        const inMap = isAccount ? entityIn.get(c) : netEntityIn.get(c);
        const outMap = isAccount ? entityOut.get(c) : netEntityOut.get(c);

        if (mode === 'receiver' || mode === 'other') {
            if (inMap) {
                for (const [r, a] of inMap) {
                    parts.push(`<div style='font-size:${fAmount}px; font-weight:bold; color:var(--color-accent) !important; white-space: nowrap;'>+${fmtNum(a)} ${getSymbol(r)}</div>`);

                    if (isAccount && mode === 'receiver') {
                        const isArbitrageForToken = outMap && outMap.has(r);
                        if (isArbitrageForToken) {
                            const netAmt = netEntityIn.get(c)?.get(r) || 0;
                            if (netAmt > 0) {
                                parts.push(`<div style='font-size:${fAmount}px; font-weight:900; color:var(--color-primary) !important; white-space: nowrap; margin-top:4px;'>Beneficio: +${fmtNum(netAmt)} ${getSymbol(r)}</div>`);
                            }
                        }
                    }
                }
            }
        }

        if (mode === 'sender' || mode === 'other') {
            if (outMap) {
                for (const [r, a] of outMap) {
                    const fw = isAccount ? 'bold' : 'bold';
                    parts.push(`<div style='font-size:${fAmount}px; font-weight:${fw}; color:#f43f5e !important; white-space: nowrap;'>-${fmtNum(a)} ${getSymbol(r)}</div>`);
                }
            }
            if (feePaid > 0 && c === feePayer) {
                parts.push(`<div style='font-size:${fAmount}px; font-weight:bold; color:#f43f5e !important; white-space: nowrap;'>Fees: -${fmtNum(feePaid)} XRD</div>`);
            }
        }

        parts.push(`</div>`);
        return parts.join('');
    };

    const L: string[] = [];
    L.push(`%%{init: { 'themeVariables': { 'clusterFontSize': '${fHeader}px' } } }%%`);
    L.push('flowchart LR');
    L.push('  classDef user fill:transparent,stroke:#4f46e5,stroke-width:2px,rx:8,ry:8');
    L.push('  classDef fee fill:transparent,stroke:#F43F5E,stroke-width:2px,rx:8,ry:8');
    L.push('  classDef vault fill:transparent,stroke:#0ea5e9,stroke-width:2px,rx:4,ry:4');
    L.push('  classDef spacer fill:transparent,stroke:none');

    const senderIds = new Map<string, string>();
    const receiverIds = new Map<string, string>();

    const senders = Array.from(connectedEntities).filter(a => isInit(a) && (entityOut.has(a) || a === feePayer));
    if (senders.length > 0) {
        L.push(`  subgraph SenderGroup["${tt?.swap_routing_sender || 'Sender'}"]`);
        L.push('    direction TB');
        L.push('    S_Spacer[" "]:::spacer');
        for (const addr of senders) {
            const sid = `S${counter++}`;
            senderIds.set(addr, sid);
            L.push(`    ${sid}["${buildNodeHtml(addr, 'sender')}"]:::user`);
        }
        L.push('  end');
    }

    const receivers = Array.from(connectedEntities).filter(a => isInit(a) && entityIn.has(a));
    if (receivers.length > 0) {
        L.push(`  subgraph ReceiverGroup["${tt?.swap_routing_receiver || 'Receiver'}"]`);
        L.push('    direction TB');
        L.push('    R_Spacer[" "]:::spacer');
        for (const addr of receivers) {
            const rid = `R${counter++}`;
            receiverIds.set(addr, rid);
            L.push(`    ${rid}["${buildNodeHtml(addr, 'receiver')}"]:::user`);
        }
        L.push('  end');
    }

    const intermediaries = Array.from(connectedEntities).filter(a => !isInit(a));
    if (intermediaries.length > 0) {
        L.push(`  subgraph DEXGroup["${tt?.swap_dex_label || 'Intermediaries'}"]`);
        L.push('    direction TB');
        L.push('    D_Spacer[" "]:::spacer');
        for (const addr of intermediaries) {
            const id = nid(addr);
            const style = isDex(addr) ? 'vault' : 'user';
            L.push(`    ${id}["${buildNodeHtml(addr, 'other')}"]:::${style}`);
        }
        L.push('  end');
    }

    const feeLinks: { from: string; to: string; label: string }[] = [];
    if (feePaid > 0 && feePayer) {
        const netFeeId = 'NF_Rhombus';
        const payerId = senderIds.get(feePayer) || receiverIds.get(feePayer) || nid(feePayer);
        const feeTooltip = `${tt?.click_to_copy || 'Click to copy address'}: ${feePayer}`;

        const rhombusText = tt?.swap_routing_network_fees || 'Network Fees';
        const feeHtml = `<div data-diag-copy="${feePayer}" title='${feeTooltip}' style='cursor:pointer; color:var(--color-text-main); font-size:${fTitle}px; padding: 8px; text-align: center; white-space: nowrap;'>${rhombusText}<br/><b>${fmtNum(feePaid)} XRD</b></div>`;

        L.push(`  ${netFeeId}{"${feeHtml}"}:::fee`);
        feeLinks.push({ from: payerId, to: netFeeId, label: `${fmtNum(feePaid)} XRD` });

        if (feeDest) {
            const breakdownText = tt?.swap_routing_fee_breakdown || 'Fee breakdown';
            L.push(`  subgraph FeesGroup["${breakdownText}"]`);
            L.push('    direction TB');
            L.push('    F_Spacer[" "]:::spacer');

            const getVal = (v: unknown): string => {
                if (!v) return '0';
                if (typeof v === 'string') return v;
                if (typeof v === 'object') {
                    const record = v as Record<string, unknown>;
                    return String(record.xrd_amount ?? record.xrdAmount ?? record.amount ?? '0');
                }
                return '0';
            };

            const toBurn = parseFloat(getVal(feeDest.to_burn ?? feeDest.toBurn));
            const toProposer = parseFloat(getVal(feeDest.to_proposer ?? feeDest.toProposer));
            const toValSet = parseFloat(getVal(feeDest.to_validator_set ?? feeDest.toValidatorSet));
            const royalties = feeDest.to_royalty_recipients ?? feeDest.toRoyaltyRecipients;
            const toRoyalties = Array.isArray(royalties)
                ? royalties.reduce((acc: number, r: unknown) => acc + parseFloat(getVal(r)), 0)
                : 0;

            if (toBurn > 0) {
                const burnHtml = `<div style='color:var(--color-text-main); font-size:${fFee}px; text-align: center; white-space: nowrap;'>${tt?.swap_routing_burn || 'Burn'}<br/><b>${fmtNum(toBurn)} XRD</b></div>`;
                L.push(`    BurnNode["${burnHtml}"]:::fee`);
                feeLinks.push({ from: netFeeId, to: 'BurnNode', label: `${fmtNum(toBurn)} XRD` });
            }
            if (toProposer > 0) {
                const propHtml = `<div style='color:var(--color-text-main); font-size:${fFee}px; text-align: center; white-space: nowrap;'>${tt?.swap_routing_proposer || 'Proposer'}<br/><b>${fmtNum(toProposer)} XRD</b></div>`;
                L.push(`    ProposerNode["${propHtml}"]:::vault`);
                feeLinks.push({ from: netFeeId, to: 'ProposerNode', label: `${fmtNum(toProposer)} XRD` });
            }
            if (toValSet > 0) {
                const valHtml = `<div style='color:var(--color-text-main); font-size:${fFee}px; text-align: center; white-space: nowrap;'>${tt?.swap_routing_validators || 'Validators'}<br/><b>${fmtNum(toValSet)} XRD</b></div>`;
                L.push(`    ValidatorNode["${valHtml}"]:::vault`);
                feeLinks.push({ from: netFeeId, to: 'ValidatorNode', label: `${fmtNum(toValSet)} XRD` });
            }
            if (toRoyalties > 0) {
                const royHtml = `<div style='color:var(--color-text-main); font-size:${fFee}px; text-align: center; white-space: nowrap;'>Royalties<br/><b>${fmtNum(toRoyalties)} XRD</b></div>`;
                L.push(`    RoyaltiesNode["${royHtml}"]:::fee`);
                feeLinks.push({ from: netFeeId, to: 'RoyaltiesNode', label: `${fmtNum(toRoyalties)} XRD` });
            }
            L.push('  end');
        }
    }

    const getSourceId = (addr: string) => senderIds.get(addr) || nid(addr);
    const getTargetId = (addr: string) => receiverIds.get(addr) || nid(addr);

    let edgeIdx = 0;
    const feeEdgeIndices: number[] = [];
    const outputEdgeIndices: number[] = [];

    for (const edge of rawEdges) {
        const sNodeId = getSourceId(edge.sourceAddr);
        const tNodeId = getTargetId(edge.targetAddr);
        const edgeLabel = `${fmtNum(edge.amt)} ${getSymbol(edge.res)}`;

        L.push(`  ${sNodeId} == "<span style='font-size:${fEdge}px; white-space: nowrap;'>${edgeLabel}</span>" ==> ${tNodeId}`);

        if (isInit(edge.targetAddr)) outputEdgeIndices.push(edgeIdx);
        edgeIdx++;
    }

    for (const fl of feeLinks) {
        const labelHtml = `<span style='font-size:${fFee}px; white-space: nowrap;'>${fl.label}</span>`;
        const labelStr = fl.label ? ` == "${labelHtml}" ==> ` : ' ==> ';
        L.push(`  ${fl.from}${labelStr}${fl.to}`);
        feeEdgeIndices.push(edgeIdx++);
    }

    for (let i = 0; i < edgeIdx; i++) {
        if (feeEdgeIndices.includes(i)) L.push(`  linkStyle ${i} stroke:#F43F5E,stroke-width:${strokeW}px,stroke-dasharray:5,5`);
        else if (outputEdgeIndices.includes(i)) L.push(`  linkStyle ${i} stroke:#10b981,stroke-width:${strokeW}px`);
        else L.push(`  linkStyle ${i} stroke-width:${strokeW}px`);
    }

    return L.join('\n');
}
