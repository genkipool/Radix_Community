'use client';

import { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { BookUser, Check, Edit2, Loader2, Trash2, X } from 'lucide-react';
import {
    useAddressBook,
    addressCategory,
    type AddressBookEntry,
    type AddressCategory,
} from '../hooks/useAddressBook';
import { useRadixWallet } from '../hooks/useRadixWallet';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';

type NavT = Record<string, string>;

/** Ordered category tabs; `all` is always first, the rest appear when populated. */
const CATEGORY_ORDER: AddressCategory[] = [
    'account',
    'validator',
    'pool',
    'component',
    'package',
    'resource',
    'other',
];

function tabLabel(cat: AddressCategory | 'all', navT: NavT): string {
    const key = `agenda_tab_${cat}`;
    const fallback: Record<AddressCategory | 'all', string> = {
        all: 'Todas',
        account: 'Cuentas',
        validator: 'Validadores',
        pool: 'Pools',
        component: 'Componentes',
        package: 'Paquetes',
        resource: 'Recursos',
        other: 'Otras',
    };
    return navT[key] ?? fallback[cat];
}

function categoryLabel(cat: AddressCategory, navT: NavT): string {
    const key = `agenda_cat_${cat}`;
    const fallback: Record<AddressCategory, string> = {
        account: 'Cuenta',
        validator: 'Validador',
        pool: 'Pool',
        component: 'Componente',
        package: 'Paquete',
        resource: 'Recurso',
        other: 'Otra',
    };
    return navT[key] ?? fallback[cat];
}

function CategoryBadge({ category, navT }: { category: AddressCategory; navT: NavT }) {
    return (
        <span
            className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
                background: 'rgba(var(--color-primary-rgb), 0.1)',
                color: 'var(--color-primary)',
            }}
        >
            {categoryLabel(category, navT)}
        </span>
    );
}

/** One saved entry: read row with edit/delete, or an inline edit form. */
function EntryRow({
    entry,
    navT,
    onSave,
    onDelete,
}: {
    entry: AddressBookEntry;
    navT: NavT;
    onSave: (id: string, updated: Omit<AddressBookEntry, 'id' | 'category'>) => Promise<{ error?: string }>;
    onDelete: (id: string) => void;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formName, setFormName] = useState(entry.name);
    const [formAddress, setFormAddress] = useState(entry.address);
    const [formNote, setFormNote] = useState(entry.note || '');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const cancel = () => {
        setFormName(entry.name);
        setFormAddress(entry.address);
        setFormNote(entry.note || '');
        setErrorMsg(null);
        setIsEditing(false);
    };

    const save = async () => {
        if (!formName.trim() || !formAddress.trim()) return;
        setIsLoading(true);
        const res = await onSave(entry.id, {
            name: formName,
            address: formAddress,
            note: formNote,
        });
        setIsLoading(false);
        if (res?.error) setErrorMsg(res.error);
        else setIsEditing(false);
    };

    if (isEditing) {
        const detected = addressCategory(formAddress);
        return (
            <div className="-mx-2 border-b border-[var(--color-card-border)] bg-[var(--color-surface)]/10 px-2 py-3">
                <div className="space-y-3">
                    <input
                        type="text"
                        placeholder={navT.agenda_name_placeholder || 'Nombre'}
                        value={formName}
                        onChange={(e) => { setFormName(e.target.value); setErrorMsg(null); }}
                        className="w-full border-b border-[var(--color-border)]/60 bg-transparent px-0 py-1 text-[14px] font-semibold text-[var(--color-text-main)] outline-none transition-colors placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)]"
                        autoFocus
                    />
                    <input
                        type="text"
                        placeholder={navT.agenda_address_placeholder || 'Dirección (account_…, validator_…, pool_…)'}
                        value={formAddress}
                        onChange={(e) => { setFormAddress(e.target.value); setErrorMsg(null); }}
                        className="w-full border-b border-[var(--color-border)]/60 bg-transparent px-0 py-1 font-mono text-[12px] text-[var(--color-text-main)] outline-none transition-colors placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)]"
                    />
                    <input
                        type="text"
                        placeholder={navT.agenda_note_placeholder || 'Nota (opcional)'}
                        value={formNote}
                        onChange={(e) => setFormNote(e.target.value)}
                        className="w-full border-b border-[var(--color-border)]/60 bg-transparent px-0 py-1 text-[12px] text-[var(--color-text-main)] outline-none transition-colors placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)]"
                        disabled={isLoading}
                    />
                    {formAddress.trim() && <CategoryBadge category={detected} navT={navT} />}
                    {isLoading && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--color-primary)]">
                            <Loader2 className="size-3 animate-spin" /> {navT.agenda_verifying || 'Verificando en red…'}
                        </p>
                    )}
                    {errorMsg && <p className="mt-1 text-xs text-red-400">{errorMsg}</p>}
                    <div className="flex items-center justify-end gap-4 pt-1">
                        <button
                            onClick={save}
                            disabled={isLoading || !formName.trim() || !formAddress.trim()}
                            className="text-xs font-bold uppercase tracking-wide text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary)]/80 disabled:opacity-50"
                        >
                            {navT.agenda_save || 'Guardar'}
                        </button>
                        <button
                            onClick={cancel}
                            className="text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-main)]"
                        >
                            {navT.agenda_cancel || 'Cancelar'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="group -mx-2 flex items-center justify-between border-b border-[var(--color-card-border)] px-2 py-3 transition-colors hover:bg-[var(--color-surface)]/20">
            <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center gap-2">
                    <h4 className="truncate text-[14px] font-semibold text-[var(--color-text-main)]">{entry.name}</h4>
                    <CategoryBadge category={entry.category ?? addressCategory(entry.address)} navT={navT} />
                </div>
                <p className="mt-0.5 truncate font-mono text-[12px] text-[var(--color-text-muted)]">{entry.address}</p>
                {entry.note && <p className="mt-1 truncate text-[12px] text-[var(--color-text-muted)]">{entry.note}</p>}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-primary)]"
                    title={navT.agenda_edit || 'Editar'}
                >
                    <Edit2 className="size-3.5" />
                </button>
                <button
                    onClick={() => onDelete(entry.id)}
                    className="p-1.5 text-[var(--color-text-muted)] transition-colors hover:text-red-400"
                    title={navT.agenda_delete || 'Eliminar'}
                >
                    <Trash2 className="size-3.5" />
                </button>
            </div>
        </div>
    );
}

/**
 * The address book (agenda): add, edit and delete saved addresses, organised
 * by on-ledger entity category (accounts, validators, pools, components,
 * packages…). The category is derived from each address's prefix, so the model
 * scales to new entity families by extending `AddressCategory` alone. Shared by
 * the wallet profile modal and the console tool for one design, one source.
 */
export function AddressBook({
    navT = {},
    showHeader = true,
}: {
    navT?: NavT;
    /** Hide the internal title row (the console page already has a header). */
    showHeader?: boolean;
}) {
    const { entries, addEntry, updateEntry, deleteEntry } = useAddressBook();
    const { activeNetwork } = useRadixWallet();

    const [isAdding, setIsAdding] = useState(false);
    const [isLoadingNew, setIsLoadingNew] = useState(false);
    const [formName, setFormName] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formNote, setFormNote] = useState('');
    const [addErrorMsg, setAddErrorMsg] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<AddressCategory | 'all'>('all');

    // Only surface tabs for categories that actually have entries.
    const presentSet = new Set(entries.map((e) => e.category ?? addressCategory(e.address)));
    const presentCategories = CATEGORY_ORDER.filter((c) => presentSet.has(c));

    const visibleEntries =
        activeTab === 'all'
            ? entries
            : entries.filter((e) => (e.category ?? addressCategory(e.address)) === activeTab);

    const resetForm = () => {
        setFormName('');
        setFormAddress('');
        setFormNote('');
        setAddErrorMsg(null);
        setIsAdding(false);
        setIsLoadingNew(false);
    };

    const verifyAddress = async (address: string) => {
        try {
            await apiFetchEntityDetails(address, activeNetwork === 'stokenet' ? 'stokenet' : 'mainnet', true);
            return true;
        } catch {
            return false;
        }
    };

    const handleSaveNew = async () => {
        if (!formName.trim() || !formAddress.trim()) return;
        const name = formName.trim();
        const address = formAddress.trim();

        if (entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
            setAddErrorMsg(navT.agenda_error_dup_name || 'Ya existe un contacto con este nombre.');
            return;
        }
        if (entries.some((e) => e.address.toLowerCase() === address.toLowerCase())) {
            setAddErrorMsg(navT.agenda_error_dup_addr || 'Ya existe un contacto con esta dirección.');
            return;
        }

        setIsLoadingNew(true);
        if (!(await verifyAddress(address))) {
            setIsLoadingNew(false);
            setAddErrorMsg(navT.agenda_error_invalid || 'La dirección no existe en la red o es inválida.');
            return;
        }

        addEntry({ name, address, note: formNote.trim() });
        resetForm();
    };

    const handleSaveInline = async (
        id: string,
        updated: Omit<AddressBookEntry, 'id' | 'category'>,
    ): Promise<{ error?: string }> => {
        const name = updated.name.trim();
        const address = updated.address.trim();

        if (entries.some((e) => e.id !== id && e.name.toLowerCase() === name.toLowerCase())) {
            return { error: navT.agenda_error_dup_name || 'Ya existe un contacto con este nombre.' };
        }
        if (entries.some((e) => e.id !== id && e.address.toLowerCase() === address.toLowerCase())) {
            return { error: navT.agenda_error_dup_addr || 'Ya existe un contacto con esta dirección.' };
        }

        const current = entries.find((e) => e.id === id);
        if (current?.address !== address && !(await verifyAddress(address))) {
            return { error: navT.agenda_error_invalid || 'La dirección no existe en la red o es inválida.' };
        }

        updateEntry(id, { name, address, note: updated.note?.trim() });
        return {};
    };

    const detectedNew = addressCategory(formAddress);

    return (
        <div className="w-full">
            {showHeader && (
                <div className="mb-4 flex items-center gap-2 text-[var(--color-text-main)] opacity-80">
                    <BookUser className="size-4" />
                    <h3 className="text-sm font-bold tracking-wide">{navT.agenda_title || 'Mi Agenda'}</h3>
                </div>
            )}

            {!isAdding && (
                <button
                    onClick={() => setIsAdding(true)}
                    className="mb-2 flex items-center gap-1 text-[13px] font-bold tracking-wide text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary)]/80"
                >
                    {navT.agenda_add_btn || '+ Añadir dirección a la agenda'}
                </button>
            )}

            <AnimatePresence mode="wait">
                {isAdding && (
                    <m.div
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-4 py-3">
                            <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                                {navT.agenda_new_contact || 'Nuevo Contacto'}
                            </h4>
                            <input
                                type="text"
                                placeholder={navT.agenda_name_placeholder || 'Nombre'}
                                value={formName}
                                onChange={(e) => { setFormName(e.target.value); setAddErrorMsg(null); }}
                                className="w-full border-b border-[var(--color-border)]/60 bg-transparent px-0 py-2 text-sm text-[var(--color-text-main)] outline-none transition-colors placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)]"
                                autoFocus
                                disabled={isLoadingNew}
                            />
                            <input
                                type="text"
                                placeholder={navT.agenda_address_placeholder || 'Dirección (account_…, validator_…, pool_…)'}
                                value={formAddress}
                                onChange={(e) => { setFormAddress(e.target.value); setAddErrorMsg(null); }}
                                className="w-full border-b border-[var(--color-border)]/60 bg-transparent px-0 py-2 font-mono text-[13px] text-[var(--color-text-main)] outline-none transition-colors placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)]"
                                disabled={isLoadingNew}
                            />
                            <input
                                type="text"
                                placeholder={navT.agenda_note_placeholder || 'Nota (opcional)'}
                                value={formNote}
                                onChange={(e) => setFormNote(e.target.value)}
                                className="w-full border-b border-[var(--color-border)]/60 bg-transparent px-0 py-2 text-sm text-[var(--color-text-main)] outline-none transition-colors placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)]"
                                disabled={isLoadingNew}
                            />
                            {formAddress.trim() && (
                                <div className="flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]">
                                    {navT.agenda_detected || 'Detectado:'} <CategoryBadge category={detectedNew} navT={navT} />
                                </div>
                            )}
                            {isLoadingNew && (
                                <p className="flex items-center gap-1 text-xs text-[var(--color-primary)]">
                                    <Loader2 className="size-3 animate-spin" /> {navT.agenda_verifying || 'Verificando en red…'}
                                </p>
                            )}
                            {addErrorMsg && <p className="text-xs text-red-400">{addErrorMsg}</p>}
                            <div className="flex items-center justify-end gap-4 pt-2">
                                <button
                                    onClick={handleSaveNew}
                                    disabled={isLoadingNew || !formName.trim() || !formAddress.trim()}
                                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[var(--color-primary)] transition-colors hover:text-[var(--color-primary)]/80 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Check className="size-3.5" /> {navT.agenda_add || 'Añadir'}
                                </button>
                                <button
                                    onClick={resetForm}
                                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-main)]"
                                >
                                    <X className="size-3.5" /> {navT.agenda_cancel || 'Cancelar'}
                                </button>
                            </div>
                        </div>
                    </m.div>
                )}
            </AnimatePresence>

            {/* Category tabs (only when there is more than one family to split) */}
            {presentCategories.length > 1 && (
                <div className="mb-1 flex items-center gap-4 overflow-x-auto border-b border-[var(--color-card-border)]/50 no-scrollbar">
                    {(['all', ...presentCategories] as const).map((cat) => {
                        const count = cat === 'all' ? entries.length : entries.filter((e) => (e.category ?? addressCategory(e.address)) === cat).length;
                        const active = activeTab === cat;
                        return (
                            <button
                                key={cat}
                                onClick={() => setActiveTab(cat)}
                                className={`shrink-0 border-b-2 pb-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                                    active
                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'
                                }`}
                            >
                                {tabLabel(cat, navT)} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="mt-2">
                {entries.length === 0 && !isAdding ? (
                    <div className="py-6 text-center italic text-[var(--color-text-muted)] opacity-60">
                        <p className="text-sm">{navT.agenda_empty || 'Tu agenda está vacía.'}</p>
                    </div>
                ) : (
                    visibleEntries.map((entry) => (
                        <EntryRow
                            key={entry.id}
                            entry={entry}
                            navT={navT}
                            onSave={handleSaveInline}
                            onDelete={deleteEntry}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
