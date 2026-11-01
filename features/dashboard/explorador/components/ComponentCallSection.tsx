'use client';

import { Boxes, Code2, Cpu, Database, ListOrdered } from 'lucide-react';

import { extractEntityMeta } from '@/features/dashboard/hooks/useEntityData';
import type { Network, TranslationsT } from '@/features/dashboard/types';
import { useEntityDetailsBatch } from '../hooks/useEntityDetailsBatch';
import type { CallArgument, ComponentCall, StoredChange } from '../utils/componentCall';
import { priceChange, type StoredField } from '../utils/oraclePrices';
import { ResourceLine } from './DepositRulesChangeSection';
import { AddressChip, shortenAddress } from './SummaryCardKit';
import { fillTemplate, formatTokenAmount } from './TransactionSummaryPanels';

type Tt = Partial<TranslationsT['dashboard']['transactions']>;

const ARG_GRID = 'grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-3';
// A floor, not a fixed height: rows of the two columns line up, and a long value grows its row instead of spilling over the next one.
const ROW_HEIGHT = 'min-h-12';

/** A template's {placeholders} replaced by plain text, for title attributes. */
const fillText = (template: string, values: Record<string, string>) =>
    template.replace(/\{(\w+)\}/g, (all, key: string) => values[key] ?? all);

/**
 * The resource each argument refers to: an amount right after a resource
 * address is read as an amount of that resource, the way manifests pass
 * (resource, amount) pairs. Null where nothing names one.
 */
const argumentResources = (args: CallArgument[]): (string | null)[] => {
    let current: string | null = null;
    return args.map((arg) => {
        if (arg.kind === 'address') {
            current = arg.value.startsWith('resource_') ? arg.value : null;
            return null;
        }
        return arg.kind === 'decimal' ? current : null;
    });
};

/**
 * The argument written into each field of an entry, when the call passes the
 * entry's key followed by exactly one value per field (as in
 * `set_data(resource, a, b, c)`). Null when the shapes do not line up.
 */
const argumentsPerField = (call: ComponentCall | undefined, entry: StoredChange): CallArgument[] | null => {
    if (!call || !('address' in entry.key)) return null;
    const keyAt = call.args.findIndex((a) => a.kind === 'address' && a.value === (entry.key as { address: string }).address);
    const rest = keyAt < 0 ? [] : call.args.slice(keyAt + 1);
    const width = Math.max(entry.before?.length ?? 0, entry.after?.length ?? 0);
    return width > 0 && rest.length === width && rest.every((a) => a.kind !== 'address' && a.kind !== 'other') ? rest : null;
};

/**
 * A call to a component that moved no assets: what was called, with which
 * arguments, and which of the component's stored values it rewrote, field by
 * field, before and after. Everything comes from the manifest and the receipt;
 * names and icons come in one request for the component and the addresses.
 */
export function ComponentCallSection({ calls, changes, caller, feePaid, tt, onCopy, copiedAddress, network, locale = 'en' }: {
    calls: ComponentCall[];
    changes: StoredChange[];
    caller: string | null;
    /** Fee already formatted, in XRD. */
    feePaid: string;
    tt?: Tt;
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: Network;
    locale?: string;
}) {
    const addresses = [
        ...calls.flatMap((c) => [c.component, ...c.args.filter((a) => a.kind === 'address').map((a) => a.value)]),
        ...changes.flatMap((c) => ('address' in c.key ? [c.key.address] : [])),
    ];
    const { data: entities } = useEntityDetailsBatch(addresses, network);
    if (calls.length === 0) return null;

    const copyTitle = tt?.copy_address || 'Copy';
    const metaOf = (address: string) => {
        const details = entities?.[address];
        return details ? extractEntityMeta(details) : null;
    };
    const nameOf = (address: string) => {
        const meta = metaOf(address);
        return meta?.symbol || meta?.name || entities?.[address]?.details?.blueprint_name || shortenAddress(address);
    };
    const symbolOf = (address: string | null) => (address ? metaOf(address)?.symbol || metaOf(address)?.name || '' : '');
    const changedCount = changes.filter((c) => !c.before || c.before.some((f, i) => f.value !== c.after?.[i]?.value)).length;
    const lastCall = calls[calls.length - 1];

    const factLabel = 'text-[9px] uppercase font-black tracking-wider text-[var(--color-text-muted)]';
    const factValue = 'mt-0.5 truncate text-xs font-bold text-[var(--color-text-main)]';
    const columnTitle = 'text-[9px] uppercase font-black tracking-wider text-[var(--color-text-muted)]';
    // Both columns share these, so their headings, lead lines, header rows and rows line up.
    const columnHeading = `flex items-center gap-1.5 px-1 pb-1.5 border-b border-[var(--color-card-border)] ${columnTitle}`;
    const leadLine = 'flex min-h-[3.25rem] items-center px-1 py-2';

    /** A number as people read it, with its token's symbol when one is known, and the exact value on hover. */
    const amount = (value: string, kind: StoredField['kind'] | CallArgument['kind'], symbol: string, title: string, strong = true) => (
        <span className="inline-flex items-baseline gap-1 font-mono cursor-help" title={title}>
            <span className={strong ? 'font-bold text-[var(--color-text-main)]' : 'text-[var(--color-text-muted)]'}>
                {kind === 'decimal' ? formatTokenAmount(value, locale) : value}
            </span>
            {symbol && <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">{symbol}</span>}
        </span>
    );
    const unitNote = (symbol: string) => (symbol ? ' ' + fillText(tt?.component_call_unit_note || '', { symbol }) : '');

    const argumentsTable = (call: ComponentCall) => {
        const resources = argumentResources(call.args);
        return (
            <div className="flex h-full flex-col">
                <h4 className={columnHeading}>
                    <ListOrdered className="size-3" />
                    {tt?.component_call_args || 'Arguments'}
                </h4>
                {/* The call as written, with names instead of addresses: what was sent at a glance. */}
                <p className={`${leadLine} font-mono text-[11px] text-[var(--color-text-muted)] break-words`}>
                    <span>
                    <span className="font-bold text-[var(--color-primary)]">{call.method}</span>(
                    {call.args.map((arg, i) => (
                        <span key={i}>
                            {i > 0 && ', '}
                            <span className="text-[var(--color-text-main)]">
                                {arg.kind === 'address' ? nameOf(arg.value) : arg.kind === 'decimal' ? formatTokenAmount(arg.value, locale) : arg.kind === 'string' ? `"${arg.value}"` : arg.kind === 'other' ? '…' : arg.value}
                            </span>
                        </span>
                    ))}
                    )
                    </span>
                </p>
                <div className={`${ARG_GRID} items-center border-y border-[var(--color-card-border)] px-1 py-1.5`}>
                    <span className={columnTitle}>#</span>
                    <span className={columnTitle}>{tt?.component_call_value || 'Value'}</span>
                    <span className={columnTitle}>{tt?.component_call_type || 'Type'}</span>
                </div>
                <ul className="flex-1 divide-y divide-[var(--color-card-border)] border-b border-[var(--color-card-border)]">
                    {call.args.map((arg, i) => {
                        const symbol = symbolOf(resources[i]);
                        const kindLabel = tt?.component_call_kinds?.[arg.kind] ?? arg.kind;
                        let shown: React.ReactNode;
                        if (arg.kind === 'address' && arg.value.startsWith('resource_')) {
                            shown = <ResourceLine address={arg.value} details={entities?.[arg.value]} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />;
                        } else if (arg.kind === 'address') {
                            shown = <AddressChip address={arg.value} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />;
                        } else if (arg.kind === 'other') {
                            // Tuples, arrays, enums…: kept as written, indentation included, in a box that scrolls rather than stretching the card.
                            shown = <pre className="max-h-64 overflow-auto rounded-md border border-[var(--color-card-border)] bg-[var(--code-bg)] p-2 font-mono text-[11px] leading-relaxed text-[var(--color-text-main)]">{arg.value}</pre>;
                        } else if (arg.kind === 'decimal' || arg.kind === 'integer') {
                            const title = fillText(tt?.component_call_arg_title || 'Exact value: {value}. Argument {n} of {method}().', { value: arg.value, n: String(i + 1), method: call.method }) + unitNote(symbol);
                            shown = amount(arg.value, arg.kind, symbol, title);
                        } else {
                            shown = <span className="font-mono text-xs font-bold text-[var(--color-text-main)] break-all">{arg.kind === 'string' ? `"${arg.value}"` : arg.value}</span>;
                        }
                        return (
                            <li key={i} className={`${ARG_GRID} ${ROW_HEIGHT} px-1 py-1.5 ${arg.kind === 'other' ? 'items-start' : 'items-center'}`}>
                                <span className="grid size-5 place-items-center rounded-full bg-[var(--color-primary)]/10 text-[9px] font-black text-[var(--color-primary)]">{i + 1}</span>
                                {arg.kind === 'other' ? (
                                    <>
                                        {/* On a narrow card the code takes the type's column too, with the type above it. */}
                                        <div className="min-w-0 text-sm @max-md:col-span-2">
                                            <span className={`mb-1 block @md:hidden ${columnTitle}`}>{kindLabel}</span>
                                            {shown}
                                        </div>
                                        <span className={`@max-md:hidden ${columnTitle}`}>{kindLabel}</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="min-w-0 text-sm">{shown}</div>
                                        <span className={columnTitle}>{kindLabel}</span>
                                    </>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    };

    const changeTable = (entry: StoredChange, i: number) => {
        const width = Math.max(entry.before?.length ?? 0, entry.after?.length ?? 0);
        const sent = argumentsPerField(lastCall, entry);
        const keyName = 'address' in entry.key ? nameOf(entry.key.address) : entry.key.hex.slice(0, 16);
        const symbol = 'address' in entry.key ? symbolOf(entry.key.address) : '';
        const keyArg = 'address' in entry.key ? (lastCall?.args ?? []).findIndex((a) => a.kind === 'address' && a.value === (entry.key as { address: string }).address) : -1;
        const fieldTitle = (n: number, side: string, value: string) =>
            fillText(tt?.component_call_field_title || 'Field {n} of the value stored for {key}, {side}. Exact value: {value}.', { n: String(n), key: keyName, side, value }) + unitNote(symbol);
        return (
            <div key={i} className="min-w-0">
                <div className={`${leadLine} justify-between gap-3`}>
                    {keyArg >= 0 ? (
                        // The key is one of the arguments, shown in full on the left: name it, do not repeat it.
                        <span className="min-w-0 truncate text-xs text-[var(--color-text-muted)]" title={(entry.key as { address: string }).address}>
                            {fillTemplate(tt?.component_call_stored_for || 'Value stored for {key} · key = argument {n}', {
                                key: <strong className="text-[var(--color-text-main)]">{keyName}</strong>,
                                n: <strong className="text-[var(--color-primary)]">{keyArg + 1}</strong>,
                            })}
                        </span>
                    ) : 'address' in entry.key ? (
                        <ResourceLine address={entry.key.address} details={entities?.[entry.key.address]} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} />
                    ) : (
                        // The whole key when it fits; the ellipsis only when the column is too narrow.
                        <span className="min-w-0 truncate font-mono text-xs text-[var(--color-text-main)]" title={entry.key.hex}>{tt?.component_call_key || 'Key'} {entry.key.hex}</span>
                    )}
                    {!entry.before && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-[var(--color-success)]">{tt?.component_call_new_entry || 'New'}</span>}
                </div>
                {entry.after || entry.before ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-y border-[var(--color-card-border)]">
                                    <th className={`px-1 py-1.5 text-left ${columnTitle}`}>{tt?.component_call_field || 'Field'}</th>
                                    {sent && <th className={`px-1 py-1.5 text-right ${columnTitle}`} title={tt?.component_call_sent_hint}>{tt?.component_call_sent || 'Sent'}</th>}
                                    <th className={`px-1 py-1.5 text-right ${columnTitle}`}>{tt?.component_call_before || 'Before'}</th>
                                    <th className={`px-1 py-1.5 text-right ${columnTitle}`}>{tt?.component_call_after || 'After'}</th>
                                    <th className={`px-1 py-1.5 text-right ${columnTitle}`}>{tt?.component_call_change || 'Change'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-card-border)]">
                                {Array.from({ length: width }, (_, f) => {
                                    const before = entry.before?.[f];
                                    const after = entry.after?.[f];
                                    const moved = before?.value !== after?.value;
                                    const pct = moved && before?.kind === 'decimal' && after?.kind === 'decimal' ? priceChange(before.value, after.value) : null;
                                    const arg = sent?.[f];
                                    return (
                                        <tr key={f} className={`${ROW_HEIGHT} ${moved ? 'bg-[var(--color-primary)]/5' : ''}`}>
                                            <td className="px-1 py-2 font-bold text-[var(--color-text-muted)]">#{f + 1}</td>
                                            {sent && (
                                                <td className="px-1 py-2 text-right">
                                                    {arg && amount(arg.value, arg.kind, symbol, fillText(tt?.component_call_sent_title || 'Value the call passed for field {n}: {value}.', { n: String(f + 1), value: arg.value }) + unitNote(symbol) + (moved || Number(arg.value) === Number(after?.value) ? '' : ' ' + (tt?.component_call_sent_kept || 'The field kept its value: the component reads it as "leave unchanged".')), false)}
                                                </td>
                                            )}
                                            <td className="px-1 py-2 text-right">
                                                {before ? amount(before.value, before.kind, symbol, fieldTitle(f + 1, tt?.component_call_side_before || 'before the transaction', before.value), false) : '–'}
                                            </td>
                                            <td className="px-1 py-2 text-right">
                                                {after ? amount(after.value, after.kind, symbol, fieldTitle(f + 1, tt?.component_call_side_after || 'after the transaction', after.value), moved) : '–'}
                                            </td>
                                            <td className="px-1 py-2 text-right whitespace-nowrap">
                                                {pct !== null ? (
                                                    <span className={`font-bold ${pct >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`} title={tt?.component_call_change_title}>
                                                        {pct >= 0 ? '+' : ''}{pct.toLocaleString(locale, { maximumFractionDigits: 2 })} %
                                                    </span>
                                                ) : moved ? (
                                                    <span className="font-bold text-[var(--color-primary)]">{tt?.component_call_changed || 'Changed'}</span>
                                                ) : (
                                                    <span className="text-[var(--color-text-muted)]">{tt?.component_call_unchanged || 'Unchanged'}</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="px-1 text-[11px] text-[var(--color-text-muted)]">{tt?.component_call_undecoded || 'Its value is not a plain list of numbers: see the raw receipt.'}</p>
                )}
            </div>
        );
    };

    return (
        <div className="@container bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-primary)]/30 overflow-hidden mt-4">
            <h3 className="px-4 py-3 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold border-b border-[var(--color-primary)]/20 bg-[var(--color-surface)] flex items-center gap-2">
                <Cpu className="size-3.5 text-[var(--color-primary)]" />
                {tt?.component_call_label || 'Component call'}
            </h3>
            {calls.map((call, c) => {
                const details = entities?.[call.component];
                const blueprint = details?.details?.blueprint_name;
                const pkg = details?.details?.package_address;
                const last = c === calls.length - 1;
                return (
                    <div key={call.component + call.method + c} className={`p-3 space-y-5 ${c > 0 ? 'border-t border-[var(--color-card-border)]' : ''}`}>
                        <p className="px-1 text-[13px] leading-relaxed text-[var(--color-text-main)]">
                            {fillTemplate(tt?.component_call_desc || '{caller} called {method} on {component}. No assets moved.', {
                                caller: <strong>{caller ? shortenAddress(caller) : tt?.component_call_someone || 'Someone'}</strong>,
                                method: <code className="font-mono font-bold text-[var(--color-primary)]">{call.method}</code>,
                                component: <strong>{nameOf(call.component)}</strong>,
                            })}
                            {last && (
                                <>
                                    {' '}
                                    {changedCount > 0
                                        ? fillTemplate(changedCount === 1 ? tt?.component_call_changed_one || 'It rewrote 1 value stored in the component.' : tt?.component_call_changed_other || 'It rewrote {count} values stored in the component.', { count: <strong>{changedCount}</strong> })
                                        : tt?.component_call_nothing_changed || 'It changed no stored value the receipt can show.'}
                                    {' '}
                                    {fillTemplate(tt?.component_call_fee || 'Fee paid: {fee} XRD.', { fee: <strong>{feePaid}</strong> })}
                                </>
                            )}
                        </p>

                        {/* Facts sharing the width evenly, hairlines between them, as in the oracle section. */}
                        <dl className={`grid grid-cols-1 ${blueprint ? '@md:grid-cols-3' : '@md:grid-cols-2'} gap-px overflow-hidden rounded-lg border border-[var(--color-card-border)] bg-[var(--color-card-border)]`}>
                            <div className="min-w-0 bg-[var(--color-card-bg)] px-3 py-2">
                                <dt className={`flex items-center gap-1 ${factLabel}`}><Boxes className="size-3" />{tt?.component_call_component || 'Component'}</dt>
                                <dd className={factValue}>{nameOf(call.component)}</dd>
                                <dd><AddressChip address={call.component} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} /></dd>
                            </div>
                            <div className="min-w-0 bg-[var(--color-card-bg)] px-3 py-2">
                                <dt className={`flex items-center gap-1 ${factLabel}`}><Code2 className="size-3" />{tt?.component_call_method || 'Method'}</dt>
                                <dd className={`${factValue} font-mono`}>{call.method}()</dd>
                            </div>
                            {blueprint && (
                                <div className="min-w-0 bg-[var(--color-card-bg)] px-3 py-2">
                                    <dt className={`flex items-center gap-1 ${factLabel}`}><Cpu className="size-3" />{tt?.component_call_blueprint || 'Blueprint'}</dt>
                                    <dd className={`${factValue} font-mono`}>{blueprint}</dd>
                                    {pkg && <dd><AddressChip address={pkg} copiedAddress={copiedAddress} onCopy={onCopy} copyTitle={copyTitle} /></dd>}
                                </div>
                            )}
                        </dl>

                        {/* Arguments and stored changes side by side when the card is wide enough; stacked, full width, when not or when only one is there. */}
                        {(() => {
                            const showArgs = call.args.length > 0;
                            const showChanges = last && changes.length > 0;
                            if (!showArgs && !showChanges) return null;
                            return (
                                <div className={`grid gap-5 ${showArgs && showChanges ? '@3xl:grid-cols-2' : ''}`}>
                                    {showArgs && <div className="min-w-0">{argumentsTable(call)}</div>}
                                    {showChanges && (
                                        <div className="flex min-w-0 flex-col">
                                            <h4 className={columnHeading}><Database className="size-3" />{tt?.component_call_changes || 'Stored values it changed'}</h4>
                                            <div className={`flex-1 grid content-start gap-5 border-b border-[var(--color-card-border)] ${showArgs ? '' : '@3xl:grid-cols-2'}`}>{changes.map(changeTable)}</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                );
            })}
        </div>
    );
}
