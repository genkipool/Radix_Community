/**
 * features/dashboard/explorador/utils/transactionUtils.ts
 *
 * Centralized logic for resolving transaction types and flags
 * to avoid duplication across components.
 */

import type { TranslationsT, GatewayEvent } from '@/features/dashboard/types';
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
}

/**
 * Returns a standardized string for the given transaction, checking
 * its manifest classes and events against a set of rules.
 */
export function resolveTransactionType(
    classes: string[],
    events: { name?: string }[],
    tt: Partial<TranslationsT['dashboard']['transactions']>
): string {
    if (classes.includes('ProtocolVote') || events.some((e) => e.name === 'ProtocolUpdateReadinessSignalEvent')) {
        return tt.tx_type_protocol_vote || 'Protocol Vote';
    }
    if (classes.length === 0) return tt.tx_type_general || 'General';

    const c = classes[0];
    if (c === 'ValidatorStake') return tt.tx_type_stake || 'Stake';
    if (c === 'ValidatorUnstake') return tt.tx_type_unstake || 'Unstake';
    if (c === 'ValidatorClaimXrd' || c === 'ValidatorClaim') return tt.tx_type_claim || 'Claim';
    if (c === 'Transfer') return tt.tx_type_transfer || 'Transfer';
    if (c === 'AccountDepositSettingsUpdate') return tt.tx_type_settings || 'Settings';

    return c || (tt.tx_type_general || 'General');
}

/**
 * Returns a set of boolean flags derived from the transaction's primary manifest class.
 * Useful for determining how to render operation-specific panels (e.g., stake, unstake).
 */
export function getTransactionFlags(classes: string[]) {
    const primaryClass = classes[0] ?? '';
    return {
        isStake: primaryClass === 'ValidatorStake',
        isUnstake: primaryClass === 'ValidatorUnstake',
        isClaim: primaryClass === 'ValidatorClaimXrd' || primaryClass === 'ValidatorClaim',
        isTransfer: primaryClass === 'Transfer',
    };
}

/**
 * Checks whether the receipt events contain at least one swap-related event.
 */
export function isSwapTransaction(events: GatewayEvent[]): boolean {
    return events.some(e => {
        const name = e.name || '';
        return name === 'SwapEvent' || name.includes('Swap');
    });
}

/**
 * Extracts swap settlement data from receipt events and balance changes.
 * Returns null if no valid swap data can be extracted.
 *
 * The "sold" token is the fungible with a negative balance change from the initiator,
 * and the "received" token is the fungible with a positive balance change to the initiator.
 * The DEX component is the emitter address of the SwapEvent.
 */
export function extractSwapData(
    events: GatewayEvent[],
    balanceChanges: BalanceChanges | undefined,
    initiators: Set<string>
): SwapData | null {
    if (!balanceChanges) return null;

    // Find the swap event emitter (DEX component)
    const swapEvent = events.find(e => {
        const name = e.name || '';
        return name === 'SwapEvent' || name.includes('Swap');
    });
    const dexComponent = sanitizeText(swapEvent?.emitter?.entity?.entity_address || '');

    // Collect all unique swap event emitters as routing hops
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

    // Find the initiator's balance changes (sold = negative, received = positive)
    const fungibles = balanceChanges.fungible_balance_changes ?? [];

    const initiatorAddrs = Array.from(initiators);

    // Sold: negative balance change from an initiator account
    const soldChanges = fungibles.filter(c =>
        initiatorAddrs.includes(sanitizeText(c.entity_address)) &&
        parseFloat(c.balance_change) < 0
    );

    // Received: positive balance change to an initiator account
    const receivedChanges = fungibles.filter(c =>
        initiatorAddrs.includes(sanitizeText(c.entity_address)) &&
        parseFloat(c.balance_change) > 0
    );

    if (soldChanges.length === 0 || receivedChanges.length === 0) return null;

    // Use the largest absolute sold amount and the largest received amount
    const sold = soldChanges.reduce((max, c) =>
        Math.abs(parseFloat(c.balance_change)) > Math.abs(parseFloat(max.balance_change)) ? c : max
        , soldChanges[0]);

    const received = receivedChanges.reduce((max, c) =>
        parseFloat(c.balance_change) > parseFloat(max.balance_change) ? c : max
        , receivedChanges[0]);

    // Initiator is the account where the sold token was withdrawn
    const initiatorAddress = sanitizeText(sold.entity_address);

    return {
        soldToken: {
            resource: sanitizeText(sold.resource_address),
            amount: Math.abs(parseFloat(sold.balance_change)).toString(),
        },
        receivedToken: {
            resource: sanitizeText(received.resource_address),
            amount: parseFloat(received.balance_change).toString(),
        },
        dexComponent,
        initiatorAddress,
        routingHops,
    };
}

/* ══════════════════════════════════════════════
   Mermaid flowchart builder for swap routing
   ══════════════════════════════════════════════ */

interface FungibleEntry {
    entity_address: string;
    resource_address: string;
    balance_change: string;
}

function short(addr: string): string {
    const c = sanitizeText(addr);
    return c.length > 26 ? `${c.slice(0, 16)}...${c.slice(-6)}` : c;
}

function fmtNum(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(abs / 1_000).toFixed(2)}K`;
    if (abs >= 1) return abs.toFixed(4);
    return abs.toFixed(6);
}

/**
 * Builds a Mermaid flowchart LR string from balance changes,
 * replicating the reference Mermaid design.
 *
 * @param fungibles  All fungible_balance_changes entries
 * @param feeEntries All fungible_fee_balance_changes entries (optional)
 * @param initiatorAddrs Initiator account addresses
 * @param names      Map of address → display name
 * @param symbols    Map of resource address → token symbol
 */
export function buildSwapRoutingChart(
    fungibles: FungibleEntry[],
    feeEntries: FungibleEntry[],
    initiatorAddrs: string[],
    names: Map<string, string>,
    symbols: Map<string, string>,
    blueprintNames: Map<string, string>,
    tt: Partial<TranslationsT['dashboard']['transactions']>
): string {
    const isInit = (a: string) => initiatorAddrs.includes(a);
    const isBurn = (a: string) => a.startsWith('resource_');
    const isValidator = (a: string) => a.includes('consensusmanager');
    const isDex = (a: string) => !isInit(a) && !isBurn(a) && !isValidator(a);

    // Unique node IDs
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
        // Remove parentheses and extra spaces
        return raw.replace(/\s*\(.*?\)\s*/g, '').trim();
    };
    const sym = (r: string) => {
        const c = sanitizeText(r);
        return symbols.get(c) || '';
    };

    // Combine all entries
    const allEntries = [...fungibles, ...feeEntries];

    // Group changes by entity → resource → amount
    type AmtMap = Map<string, number>;
    const entityIn = new Map<string, AmtMap>();
    const entityOut = new Map<string, AmtMap>();

    for (const fc of allEntries) {
        const ent = sanitizeText(fc.entity_address);
        const res = sanitizeText(fc.resource_address);
        const val = parseFloat(fc.balance_change);
        if (val > 0) {
            if (!entityIn.has(ent)) entityIn.set(ent, new Map());
            entityIn.get(ent)!.set(res, (entityIn.get(ent)!.get(res) || 0) + val);
        } else if (val < 0) {
            if (!entityOut.has(ent)) entityOut.set(ent, new Map());
            entityOut.get(ent)!.set(res, (entityOut.get(ent)!.get(res) || 0) + Math.abs(val));
        }
    }

    // All entities
    const allEntities = new Set<string>();
    for (const fc of allEntries) allEntities.add(sanitizeText(fc.entity_address));

    // Build edges: for each resource, match senders→receivers
    const edges: { from: string; to: string; resource: string; amount: number }[] = [];
    const resourceFlows = new Map<string, { senders: { e: string; a: number }[]; receivers: { e: string; a: number }[] }>();

    for (const fc of allEntries) {
        const ent = sanitizeText(fc.entity_address);
        const res = sanitizeText(fc.resource_address);
        const val = parseFloat(fc.balance_change);
        if (!resourceFlows.has(res)) resourceFlows.set(res, { senders: [], receivers: [] });
        const rf = resourceFlows.get(res)!;
        if (val < 0) rf.senders.push({ e: ent, a: Math.abs(val) });
        else if (val > 0) rf.receivers.push({ e: ent, a: val });
    }

    for (const [res, { senders, receivers }] of resourceFlows) {
        if (senders.length === 1) {
            for (const r of receivers) edges.push({ from: senders[0].e, to: r.e, resource: res, amount: r.a });
        } else if (receivers.length === 1) {
            for (const s of senders) edges.push({ from: s.e, to: receivers[0].e, resource: res, amount: s.a });
        } else {
            // N:M greedy match by closest amount
            const used = new Set<number>();
            const sorted = [...senders].sort((a, b) => b.a - a.a);
            for (const s of sorted) {
                let bestI = -1, bestD = Infinity;
                for (let i = 0; i < receivers.length; i++) {
                    if (used.has(i)) continue;
                    const d = Math.abs(s.a - receivers[i].a);
                    if (d < bestD) { bestD = d; bestI = i; }
                }
                if (bestI >= 0) {
                    used.add(bestI);
                    edges.push({ from: s.e, to: receivers[bestI].e, resource: res, amount: s.a });
                }
            }
        }
    }

    // Deduplicate edges (same from/to/resource)
    const edgeKey = (e: typeof edges[0]) => `${e.from}|${e.to}|${e.resource}`;
    const uniqueEdges = new Map<string, typeof edges[0]>();
    for (const e of edges) { uniqueEdges.set(edgeKey(e), e); }
    const finalEdges = Array.from(uniqueEdges.values());

    // Classify entities
    const dexEntities = Array.from(allEntities).filter(isDex);
    const burnEntities = Array.from(allEntities).filter(isBurn);
    const validatorEntities = Array.from(allEntities).filter(isValidator);

    // Combined formatter for node content
    // Combined formatter for node content
    const buildNodeHtml = (addr: string, mode: 'sender' | 'receiver' | 'other' = 'other') => {
        const c = sanitizeText(addr);
        const name = names.get(c);
        const bp = blueprintNames.get(c);
        const isAccount = addr.startsWith('account_');
        const minWidth = isAccount ? '260px' : '120px';

        const parts: string[] = [`<div title="${addr}" style="min-width: ${minWidth}; padding: 0 12px;">`]; // Start tooltip wrapper

        // 1. Name/Blueprint Header
        if (name) {
            parts.push(`<div style="margin-bottom:2px; font-size:20px;"><b>${label(addr)}</b></div>`);
            if (bp) {
                parts.push(`<div style="font-size:20px; opacity:0.7; margin-bottom:4px;">${bp}</div>`);
            }
        } else if (bp) {
            parts.push(`<div style="margin-bottom:4px; font-size:20px;"><b>${bp}</b></div>`);
        } else {
            // Only show address if no name and no blueprint
            parts.push(`<div style="margin-bottom:4px; font-family:monospace;"><b>${short(addr)}</b></div>`);
        }

        // Separator
        parts.push(`<div style="height:1px; border-top:1px dashed rgba(var(--color-text-main-rgb),0.15); margin:4px 0;"></div>`);

        // 2. Balance Changes
        const ii = entityIn.get(c);
        const oi = entityOut.get(c);

        if (mode === 'receiver' || mode === 'other') {
            if (ii) {
                for (const [r, a] of ii) {
                    parts.push(`<div style="font-size:18px; color:var(--color-accent) !important;">+${fmtNum(a)} ${sym(r)}</div>`);
                }
            }
        }

        if (mode === 'sender' || mode === 'other') {
            if (oi) {
                for (const [r, a] of oi) {
                    parts.push(`<div style="font-size:18px; color:#f43f5e !important;">-${fmtNum(a)} ${sym(r)}</div>`);
                }
            }
        }

        parts.push(`</div>`); // End tooltip wrapper

        return parts.join('');
    };

    // Build Mermaid lines
    const L: string[] = [];
    L.push('flowchart LR');
    L.push('  classDef user fill:transparent,stroke:#4f46e5,stroke-width:2px,rx:8,ry:8');
    L.push('  classDef fee fill:transparent,stroke:#F43F5E,stroke-width:2px,rx:8,ry:8');
    L.push('  classDef vault fill:transparent,stroke:#0ea5e9,stroke-width:2px,rx:4,ry:4');
    L.push('  classDef asset fill:transparent,stroke:#10b981,stroke-width:2px,rx:20,ry:20');

    // Maps for initiator virtual nodes
    const senderIds = new Map<string, string>();
    const receiverIds = new Map<string, string>();

    // Sender Subgraph
    L.push(`  subgraph SenderGroup ["${tt?.swap_routing_sender || 'Sender'}"]`);
    L.push('    direction TB');
    for (const addr of allEntities) {
        if (!isInit(addr)) continue;
        const sid = `S${counter++}`;
        senderIds.set(addr, sid);
        L.push(`    ${sid}["${buildNodeHtml(addr, 'sender')}"]:::user`);
    }
    L.push('  end');

    // Receiver Subgraph
    L.push(`  subgraph ReceiverGroup ["${tt?.swap_routing_receiver || 'Receiver'}"]`);
    L.push('    direction TB');
    for (const addr of allEntities) {
        if (!isInit(addr)) continue;
        const rid = `R${counter++}`;
        receiverIds.set(addr, rid);
        L.push(`    ${rid}["${buildNodeHtml(addr, 'receiver')}"]:::user`);
    }
    L.push('  end');

    // Network Fees Subgraph (Desglose)
    if (burnEntities.length > 0 || validatorEntities.length > 0) {
        L.push(`  subgraph FeesGroup ["${tt?.swap_routing_network_fees || 'Network Fees'}"]`);
        L.push('    direction TB');

        if (burnEntities.length > 0) {
            L.push(`    subgraph BurnGroup ["${tt?.swap_routing_burn || 'Burned Tokens'}"]`);
            for (const addr of burnEntities) {
                const id = nid(addr);
                L.push(`      ${id}["${buildNodeHtml(addr)}"]:::fee`);
            }
            L.push('    end');
        }

        if (validatorEntities.length > 0) {
            L.push(`    subgraph ValGroup ["${tt?.swap_routing_validators || 'Validator Rewards'}"]`);
            for (const addr of validatorEntities) {
                const id = nid(addr);
                L.push(`      ${id}["${buildNodeHtml(addr)}"]:::vault`);
            }
            L.push('    end');
        }
        L.push('  end');
    }

    // DEX subgraph
    if (dexEntities.length > 0) {
        L.push(`  subgraph DEXGroup ["${tt?.swap_dex_label || 'DEX Intermediaries'}"]`);
        L.push('    direction TB');
        L.push('    DEXSpacer[" "]:::spacer');
        for (const addr of dexEntities) {
            const id = nid(addr);
            L.push(`    ${id}["${buildNodeHtml(addr)}"]:::vault`);
        }
        L.push('  end');
    }

    // Edges — remap initiator nodes to sender/receiver variants
    const feeEdgeIndices: number[] = [];
    const outputEdgeIndices: number[] = [];
    let edgeIdx = 0;

    for (const e of finalEdges) {
        // If from is initiator, use sender node; if to is initiator, use receiver node
        const fid = isInit(e.from) ? (senderIds.get(e.from) ?? nid(e.from)) : nid(e.from);
        const tid = isInit(e.to) ? (receiverIds.get(e.to) ?? nid(e.to)) : nid(e.to);
        const s = sym(e.resource);
        const edgeLabel = `${fmtNum(e.amount)} ${s}`.trim();
        L.push(`  ${fid} -- "<span title='${e.resource}' style='font-size:20px;'>${edgeLabel}</span>" --> ${tid}`);

        // Track fee edges
        if ((isInit(e.from) && (isBurn(e.to) || isValidator(e.to))) || (isBurn(e.from) || isValidator(e.from))) {
            feeEdgeIndices.push(edgeIdx);
        }
        // Track output edges (to receiver from DEX)
        if (isDex(e.from) && isInit(e.to)) {
            outputEdgeIndices.push(edgeIdx);
        }
        edgeIdx++;
    }

    // Style fee edges as dashed red
    for (const i of feeEdgeIndices) {
        L.push(`  linkStyle ${i} stroke:#F43F5E,stroke-width:2px,stroke-dasharray: 5 5`);
    }
    // Style output edges as green/accent
    for (const i of outputEdgeIndices) {
        L.push(`  linkStyle ${i} stroke:#10b981,stroke-width:2px`);
    }

    return L.join('\n');
}
