/**
 * features/dashboard/explorador/utils/transactionUtils.ts
 *
 * Centralized logic for resolving transaction types and flags
 * to avoid duplication across components.
 */

import type { TranslationsT, GatewayEvent, FeeDestination } from '@/features/dashboard/types';
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

export function extractSwapData(
    events: GatewayEvent[],
    balanceChanges: BalanceChanges | undefined,
    initiators: Set<string>
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

export function buildSwapRoutingChart(
    fungibles: FungibleEntry[],
    feeEntries: FungibleEntry[],
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

    // ─────────────────────────────────────────────────────────
    // CÁLCULO DE ESCALA DINÁMICA
    // ─────────────────────────────────────────────────────────
    const complexity = allEntries.length;
    const scale = Math.min(3.0, Math.max(1.0, 1 + (complexity - 3) * 0.15));

    // Textos de cabecera mucho más masivos (fHeader sube a 20 base)
    const fHeader = Math.round(20 * scale);
    const fTitle = Math.round(20 * scale);
    const fAmount = Math.round(18 * scale);
    const fEdge = Math.round(18 * scale);
    const fFee = Math.round(16 * scale);

    // Grosor de línea balanceado para no devorar la flecha
    const strokeW = Math.max(3, Math.round(2.5 * scale));

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

    const allEntities = new Set<string>();
    for (const fc of allEntries) {
        const addr = sanitizeText(fc.entity_address);
        if (isValidator(addr) || isBurn(addr)) continue;
        allEntities.add(addr);
    }

    let cssInjected = false;

    const buildNodeHtml = (addr: string, mode: 'sender' | 'receiver' | 'other' = 'other') => {
        const c = sanitizeText(addr);
        const name = names.get(c);
        const bp = blueprintNames.get(c);

        const isAccount = addr.startsWith('account_');
        const minWidth = Math.round((isAccount ? 260 : 120) * scale);
        const padX = Math.round(12 * scale);

        // INYECTOR CSS PARA OBLIGAR A LAS FLECHAS A CRECER
        let extraCss = '';
        if (!cssInjected) {
            const arrowScale = Math.max(1.5, scale * 1.5);
            // Usamos comillas simples para no romper el string de Mermaid
            extraCss = `<style> marker[id*='arrowhead'] path { transform: scale(${arrowScale}); transform-origin: center; } </style>`;
            cssInjected = true;
        }

        const copyTooltip = `Click to copy: ${addr}`;
        const parts: string[] = [
            `<div onclick='navigator.clipboard.writeText(&quot;${addr}&quot;)' title='${copyTooltip}' style='min-width: ${minWidth}px; padding: 0 ${padX}px; cursor: pointer;'>`,
            extraCss // Se inyecta invisiblemente en el primer nodo
        ];

        if (name) {
            parts.push(`<div style='margin-bottom:2px; font-size:${fTitle}px;'><b>${label(addr)}</b></div>`);
            if (bp) {
                parts.push(`<div style='font-size:${fTitle}px; opacity:0.7; margin-bottom:4px;'>${bp}</div>`);
            }
        } else if (bp) {
            parts.push(`<div style='margin-bottom:4px; font-size:${fTitle}px;'><b>${bp}</b></div>`);
        } else {
            parts.push(`<div style='margin-bottom:4px; font-family:monospace; font-size:${fTitle}px;'><b>${short(addr)}</b></div>`);
        }

        parts.push(`<div style='height:1px; border-top:1px dashed rgba(var(--color-text-main-rgb),0.15); margin:4px 0;'></div>`);

        const ii = entityIn.get(c);
        const oi = entityOut.get(c);

        if (mode === 'receiver' || mode === 'other') {
            if (ii) {
                for (const [r, a] of ii) {
                    parts.push(`<div style='font-size:${fAmount}px; color:var(--color-accent) !important;'>+${fmtNum(a)} ${getSymbol(r)}</div>`);
                }
            }
        }

        if (mode === 'sender' || mode === 'other') {
            if (oi) {
                for (const [r, a] of oi) {
                    parts.push(`<div style='font-size:${fAmount}px; color:#f43f5e !important;'>-${fmtNum(a)} ${getSymbol(r)}</div>`);
                }
            }
        }

        parts.push(`</div>`);
        return parts.join('');
    };

    const L: string[] = [];

    // Forzamos el tamaño de la fuente de los Subgrafos (Cabeceras)
    L.push(`%%{init: { 'themeVariables': { 'clusterFontSize': '${fHeader}px' } } }%%`);
    L.push('flowchart LR');

    L.push('  classDef user fill:transparent,stroke:#4f46e5,stroke-width:2px,rx:8,ry:8');
    L.push('  classDef fee fill:transparent,stroke:#F43F5E,stroke-width:2px,rx:8,ry:8');
    L.push('  classDef vault fill:transparent,stroke:#0ea5e9,stroke-width:2px,rx:4,ry:4');

    const senderIds = new Map<string, string>();
    const receiverIds = new Map<string, string>();

    // 1. Sender Subgraph
    const senders = Array.from(allEntities).filter(a => isInit(a) && entityOut.has(a));
    if (senders.length > 0) {
        const title = tt?.swap_routing_sender || 'Sender';
        L.push(`  subgraph SenderGroup["${title}"]`);
        L.push('    direction TB');
        for (const addr of senders) {
            const sid = `S${counter++}`;
            senderIds.set(addr, sid);
            L.push(`    ${sid}["${buildNodeHtml(addr, 'sender')}"]:::user`);
        }
        L.push('  end');
    }

    // 2. Receiver Subgraph
    const receivers = Array.from(allEntities).filter(a => isInit(a) && entityIn.has(a));
    if (receivers.length > 0) {
        const title = tt?.swap_routing_receiver || 'Receiver';
        L.push(`  subgraph ReceiverGroup["${title}"]`);
        L.push('    direction TB');
        for (const addr of receivers) {
            const rid = `R${counter++}`;
            receiverIds.set(addr, rid);
            L.push(`    ${rid}["${buildNodeHtml(addr, 'receiver')}"]:::user`);
        }
        L.push('  end');
    }

    // 3. Intermediaries Subgraph (DEX/Pools)
    const intermediaries = Array.from(allEntities).filter(a => !isInit(a));
    if (intermediaries.length > 0) {
        const title = tt?.swap_dex_label || 'Intermediaries';
        L.push(`  subgraph DEXGroup["${title}"]`);
        L.push('    direction TB');
        for (const addr of intermediaries) {
            const id = nid(addr);
            const style = isDex(addr) ? 'vault' : 'user';
            L.push(`    ${id}["${buildNodeHtml(addr, 'other')}"]:::${style}`);
        }
        L.push('  end');
    }

    // 4. Fee Flow Logic (Rhombus + Breakdown)
    const feeLinks: { from: string; to: string; label: string }[] = [];
    if (feePaid > 0 && feePayer) {
        const netFeeId = 'NF_Rhombus';
        const payerId = senderIds.get(feePayer) || receiverIds.get(feePayer) || nid(feePayer);
        const feeTooltip = `Click to copy: ${feePayer}`;

        const rhombusText = tt?.swap_routing_network_fees || 'Comisiones de Red';
        const feeHtml = `<div onclick='navigator.clipboard.writeText(&quot;${feePayer}&quot;)' title='${feeTooltip}' style='cursor:pointer; color:var(--color-text-main); font-size:${fTitle}px; padding: 8px;'>${rhombusText}<br/><b>${fmtNum(feePaid)} XRD</b></div>`;

        L.push(`  ${netFeeId}{"${feeHtml}"}:::fee`);
        feeLinks.push({ from: payerId, to: netFeeId, label: `${fmtNum(feePaid)} XRD` });

        if (feeDest) {
            const breakdownText = tt?.swap_routing_fee_breakdown || 'Desglose de fees';
            L.push(`  subgraph FeesGroup["${breakdownText}"]`);
            L.push('    direction LR');

            const getVal = (v: string | { xrd_amount?: string; xrdAmount?: string;[key: string]: unknown } | undefined | null) =>
                typeof v === 'string' ? v : (v as { xrd_amount?: string; xrdAmount?: string })?.xrd_amount || (v as { xrd_amount?: string; xrdAmount?: string })?.xrdAmount || '0';

            const toBurn = parseFloat(getVal(feeDest.to_burn || feeDest.toBurn || '0'));
            const toProposer = parseFloat(getVal(feeDest.to_proposer || feeDest.toProposer || '0'));
            const toValSet = parseFloat(getVal(feeDest.to_validator_set || feeDest.toValidatorSet || '0'));
            const toRoyalties = Array.isArray(feeDest.to_royalty_recipients)
                ? feeDest.to_royalty_recipients.reduce((acc: number, r: string | { amount?: string; xrd_amount?: string; xrdAmount?: string }) => {
                    const amt = typeof r === 'string' ? r : (r.amount || r.xrd_amount || r.xrdAmount || '0');
                    return acc + parseFloat(amt);
                }, 0)
                : 0;

            if (toBurn > 0) {
                const burnHtml = `<div style='color:var(--color-text-main); font-size:${fFee}px;'>${tt?.swap_routing_burn || 'Burned Tokens'}<br/><b>${fmtNum(toBurn)} XRD</b></div>`;
                L.push(`    BurnNode["${burnHtml}"]:::fee`);
                feeLinks.push({ from: netFeeId, to: 'BurnNode', label: `${fmtNum(toBurn)} XRD` });
            }
            if (toProposer > 0) {
                const propHtml = `<div style='color:var(--color-text-main); font-size:${fFee}px;'>${tt?.swap_routing_proposer || 'Proposer Rewards'}<br/><b>${fmtNum(toProposer)} XRD</b></div>`;
                L.push(`    ProposerNode["${propHtml}"]:::vault`);
                feeLinks.push({ from: netFeeId, to: 'ProposerNode', label: `${fmtNum(toProposer)} XRD` });
            }
            if (toValSet > 0) {
                const valHtml = `<div style='color:var(--color-text-main); font-size:${fFee}px;'>${tt?.swap_routing_validators || 'Validator Rewards'}<br/><b>${fmtNum(toValSet)} XRD</b></div>`;
                L.push(`    ValidatorNode["${valHtml}"]:::vault`);
                feeLinks.push({ from: netFeeId, to: 'ValidatorNode', label: `${fmtNum(toValSet)} XRD` });
            }
            if (toRoyalties > 0) {
                const royHtml = `<div style='color:var(--color-text-main); font-size:${fFee}px;'>Royalties<br/><b>${fmtNum(toRoyalties)} XRD</b></div>`;
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

    const allTokens = new Set<string>();
    for (const outMap of entityOut.values()) {
        for (const res of outMap.keys()) allTokens.add(res);
    }
    for (const inMap of entityIn.values()) {
        for (const res of inMap.keys()) allTokens.add(res);
    }

    for (const res of allTokens) {
        const sources: { id: string; amt: number }[] = [];
        for (const [ent, outMap] of entityOut.entries()) {
            if (outMap.has(res) && !isValidator(ent) && !isBurn(ent)) {
                sources.push({ id: ent, amt: outMap.get(res)! });
            }
        }

        const targets: { id: string; amt: number }[] = [];
        for (const [ent, inMap] of entityIn.entries()) {
            if (inMap.has(res) && !isValidator(ent) && !isBurn(ent)) {
                targets.push({ id: ent, amt: inMap.get(res)! });
            }
        }

        let sIdx = 0;
        let tIdx = 0;
        while (sIdx < sources.length && tIdx < targets.length) {
            const s = sources[sIdx];
            const t = targets[tIdx];
            const transferAmt = Math.min(s.amt, t.amt);

            if (transferAmt > 1e-8) {
                const sNodeId = getSourceId(s.id);
                const tNodeId = getTargetId(t.id);

                const edgeLabel = `${fmtNum(transferAmt)} ${getSymbol(res)}`;

                // Usamos "==>" (conexión nativa gruesa) en lugar de "-->"
                L.push(`  ${sNodeId} == "<span style='font-size:${fEdge}px;'>${edgeLabel}</span>" ==> ${tNodeId}`);

                if (isInit(t.id)) {
                    outputEdgeIndices.push(edgeIdx);
                }
                edgeIdx++;
            }

            s.amt -= transferAmt;
            t.amt -= transferAmt;

            if (s.amt <= 1e-8) sIdx++;
            if (t.amt <= 1e-8) tIdx++;
        }
    }

    for (const fl of feeLinks) {
        const labelHtml = `<span style='font-size:${fFee}px;'>${fl.label}</span>`;
        // Usamos "==>" también para las fees
        const labelStr = fl.label ? ` == "${labelHtml}" ==> ` : ' ==> ';
        L.push(`  ${fl.from}${labelStr}${fl.to}`);
        feeEdgeIndices.push(edgeIdx++);
    }

    // --- Aplicamos el grosor dinámico pero controlado ---
    for (let i = 0; i < edgeIdx; i++) {
        if (feeEdgeIndices.includes(i)) {
            L.push(`  linkStyle ${i} stroke:#F43F5E,stroke-width:${strokeW}px,stroke-dasharray:5,5`);
        } else if (outputEdgeIndices.includes(i)) {
            L.push(`  linkStyle ${i} stroke:#10b981,stroke-width:${strokeW}px`);
        } else {
            L.push(`  linkStyle ${i} stroke-width:${strokeW}px`);
        }
    }

    return L.join('\n');
}