import React, { useState, useRef, useEffect } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { Edit2, Trash2, BookUser, Loader2 } from 'lucide-react';
import { useAddressBook, AddressBookEntry } from '../hooks/useAddressBook';
import { useRadixWallet } from '../hooks/useRadixWallet';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';

function AddressBookRow({ 
    entry, 
    onSave, 
    onDelete,
    navT = {}
}: { 
    entry: AddressBookEntry; 
    onSave: (id: string, updated: Omit<AddressBookEntry, 'id'>) => Promise<{ error?: string }>; 
    onDelete: (id: string) => void;
    navT?: Record<string, string>;
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [formName, setFormName] = useState(entry.name);
    const [formAddress, setFormAddress] = useState(entry.address);
    const [formNote, setFormNote] = useState(entry.note || '');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSave = async () => {
        if (!formName.trim() || !formAddress.trim()) return;
        setIsLoading(true);
        const res = await onSave(entry.id, { name: formName, address: formAddress, note: formNote });
        setIsLoading(false);
        if (res?.error) {
            setErrorMsg(res.error);
        } else {
            setErrorMsg(null);
            setIsEditing(false);
        }
    };

    const saveRef = useRef(handleSave);
    useEffect(() => {
        saveRef.current = handleSave;
    });

    const handleCancel = () => {
        setFormName(entry.name);
        setFormAddress(entry.address);
        setFormNote(entry.note || '');
        setErrorMsg(null);
        setIsEditing(false);
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isEditing && containerRef.current && !containerRef.current.contains(event.target as Node)) {
                saveRef.current();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isEditing]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    if (isEditing) {
        return (
            <div ref={containerRef} className="py-3 border-b border-[var(--color-border)]/30 -mx-2 px-2 transition-colors rounded-lg bg-[var(--color-surface)]/10" onKeyDown={handleKeyDown}>
                <div className="space-y-3">
                    <div>
                        <input 
                            type="text" 
                            placeholder={navT.agenda_name_placeholder || "Nombre"} 
                            value={formName}
                            onChange={e => {setFormName(e.target.value); setErrorMsg(null);}}
                            className="w-full bg-transparent border-b border-[var(--color-border)]/60 px-0 py-1 text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)] outline-none transition-colors text-[14px] font-semibold"
                            autoFocus
                        />
                    </div>
                    <div>
                        <input 
                            type="text" 
                            placeholder={navT.agenda_address_placeholder || "Dirección (ej: account_rdx1...)"} 
                            value={formAddress}
                            onChange={e => {setFormAddress(e.target.value); setErrorMsg(null);}}
                            className="w-full bg-transparent border-b border-[var(--color-border)]/60 px-0 py-1 text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)] outline-none transition-colors font-mono text-[12px]"
                        />
                    </div>
                    <div>
                        <input 
                            type="text" 
                            placeholder={navT.agenda_note_placeholder || "Nota (opcional)"} 
                            value={formNote}
                            onChange={e => setFormNote(e.target.value)}
                            className="w-full bg-transparent border-b border-[var(--color-border)]/60 px-0 py-1 text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)] outline-none transition-colors text-[12px]"
                            disabled={isLoading}
                        />
                    </div>
                    {isLoading && <p className="text-[var(--color-primary)] text-xs mt-1 flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> {navT.agenda_verifying || "Verificando en red..."}</p>}
                    {errorMsg && <p className="text-red-400 text-xs mt-1">{errorMsg}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="group flex items-center justify-between py-3 border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface)]/20 -mx-2 px-2 transition-colors rounded-lg">
            <div className="flex-1 min-w-0 pr-3">
                <h4 className="font-semibold text-[var(--color-text-main)] truncate text-[14px]">{entry.name}</h4>
                <p className="text-[12px] font-mono text-[var(--color-text-muted)] truncate mt-0.5">{entry.address}</p>
                {entry.note && (
                    <p className="text-[12px] text-[var(--color-text-muted)] mt-1 truncate">{entry.note}</p>
                )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                    title="Editar"
                >
                    <Edit2 className="size-3.5" />
                </button>
                <button 
                    onClick={() => onDelete(entry.id)}
                    className="p-1.5 text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                    title="Eliminar"
                >
                    <Trash2 className="size-3.5" />
                </button>
            </div>
        </div>
    );
}

export function InlineAddressBook({ navT = {} }: { navT?: Record<string, string> }) {
    const { entries, addEntry, updateEntry, deleteEntry } = useAddressBook();
    const { activeNetwork } = useRadixWallet();
    const [isAdding, setIsAdding] = useState(false);
    const [isLoadingNew, setIsLoadingNew] = useState(false);

    // Form state for new entry
    const [formName, setFormName] = useState('');
    const [formAddress, setFormAddress] = useState('');
    const [formNote, setFormNote] = useState('');
    const [addErrorMsg, setAddErrorMsg] = useState<string | null>(null);

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
        } catch (_e) {
            return false;
        }
    };

    const handleSaveNew = async () => {
        if (!formName.trim() || !formAddress.trim()) return;
        
        // Duplicate check
        const isDuplicateName = entries.some(e => e.name.toLowerCase() === formName.toLowerCase().trim());
        const isDuplicateAddress = entries.some(e => e.address.toLowerCase() === formAddress.toLowerCase().trim());

        if (isDuplicateName) {
            setAddErrorMsg(navT.agenda_error_dup_name || "Ya existe un contacto con este nombre.");
            return;
        }
        if (isDuplicateAddress) {
            setAddErrorMsg(navT.agenda_error_dup_addr || "Ya existe un contacto con esta dirección.");
            return;
        }

        setIsLoadingNew(true);
        const isValid = await verifyAddress(formAddress.trim());
        if (!isValid) {
            setIsLoadingNew(false);
            setAddErrorMsg(navT.agenda_error_invalid || "La dirección no existe en la red o es inválida.");
            return;
        }

        addEntry({ name: formName.trim(), address: formAddress.trim(), note: formNote.trim() });
        resetForm();
    };

    const handleSaveInline = async (id: string, updated: Omit<AddressBookEntry, 'id'>): Promise<{ error?: string }> => {
        // Duplicate check excluding self
        const isDuplicateName = entries.some(e => e.id !== id && e.name.toLowerCase() === updated.name.toLowerCase().trim());
        const isDuplicateAddress = entries.some(e => e.id !== id && e.address.toLowerCase() === updated.address.toLowerCase().trim());

        if (isDuplicateName) return { error: navT.agenda_error_dup_name || "Ya existe un contacto con este nombre." };
        if (isDuplicateAddress) return { error: navT.agenda_error_dup_addr || "Ya existe un contacto con esta dirección." };

        const currentEntry = entries.find(e => e.id === id);
        if (currentEntry?.address !== updated.address.trim()) {
            const isValid = await verifyAddress(updated.address.trim());
            if (!isValid) {
                return { error: navT.agenda_error_invalid || "La dirección no existe en la red o es inválida." };
            }
        }

        updateEntry(id, { name: updated.name.trim(), address: updated.address.trim(), note: updated.note?.trim() });
        return {};
    };

    return (
        <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
        >
            <div className="pt-2 pb-4">
                <div className="flex items-center gap-2 mb-4 text-[var(--color-text-main)] opacity-80">
                    <BookUser className="size-4" />
                    <h3 className="font-bold text-sm tracking-wide">{navT.agenda_title || "Mi Agenda"}</h3>
                </div>

                {!isAdding && (
                    <button 
                        onClick={() => setIsAdding(true)}
                        className="text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 font-bold text-[13px] tracking-wide transition-colors mb-2 flex items-center gap-1"
                    >
                        {navT.agenda_add_btn || "+ Añadir dirección a la agenda"}
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
                            <div className="py-3 space-y-4">
                                <h4 className="text-[11px] font-bold text-[var(--color-primary)] uppercase tracking-wider mb-1">
                                    {navT.agenda_new_contact || "Nuevo Contacto"}
                               </h4>
                                <div>
                                    <input 
                                        type="text" 
                                        placeholder={navT.agenda_name_placeholder || "Nombre"} 
                                        value={formName}
                                        onChange={e => {setFormName(e.target.value); setAddErrorMsg(null);}}
                                        className="w-full bg-transparent border-b border-[var(--color-border)]/60 px-0 py-2 text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)] outline-none transition-colors text-sm"
                                        autoFocus
                                        disabled={isLoadingNew}
                                    />
                                </div>
                                <div>
                                    <input 
                                        type="text" 
                                        placeholder={navT.agenda_address_placeholder || "Dirección (ej: account_rdx1...)"} 
                                        value={formAddress}
                                        onChange={e => {setFormAddress(e.target.value); setAddErrorMsg(null);}}
                                        className="w-full bg-transparent border-b border-[var(--color-border)]/60 px-0 py-2 text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)] outline-none transition-colors font-mono text-[13px]"
                                        disabled={isLoadingNew}
                                    />
                                </div>
                                <div>
                                    <input 
                                        type="text" 
                                        placeholder={navT.agenda_note_placeholder || "Nota (opcional)"} 
                                        value={formNote}
                                        onChange={e => setFormNote(e.target.value)}
                                        className="w-full bg-transparent border-b border-[var(--color-border)]/60 px-0 py-2 text-[var(--color-text-main)] placeholder:text-[var(--color-text-muted)]/40 focus:border-[var(--color-primary)] outline-none transition-colors text-sm"
                                        disabled={isLoadingNew}
                                    />
                                </div>
                                {isLoadingNew && <p className="text-[var(--color-primary)] text-xs flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> {navT.agenda_verifying || "Verificando en red..."}</p>}
                                {addErrorMsg && <p className="text-red-400 text-xs">{addErrorMsg}</p>}
                                <div className="flex items-center justify-end gap-4 pt-4">
                                    <button 
                                        onClick={handleSaveNew}
                                        disabled={isLoadingNew || !formName.trim() || !formAddress.trim()}
                                        className="text-[var(--color-primary)] hover:text-[var(--color-primary)]/80 font-bold text-xs tracking-wide uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {navT.agenda_add || "Añadir"}
                                    </button>
                                    <button 
                                        onClick={resetForm}
                                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] font-bold text-xs tracking-wide uppercase transition-colors"
                                    >
                                        {navT.agenda_cancel || "Cancelar"}
                                    </button>
                                </div>
                            </div>
                        </m.div>
                    )}
                </AnimatePresence>

                <div className="mt-2">
                    {entries.length === 0 && !isAdding ? (
                        <div className="py-6 text-[var(--color-text-muted)] opacity-60 italic text-center">
                            <p className="text-sm">{navT.agenda_empty || "Tu agenda está vacía."}</p>
                        </div>
                    ) : (
                        entries.map(entry => (
                            <AddressBookRow 
                                key={entry.id} 
                                entry={entry} 
                                onSave={handleSaveInline} 
                                onDelete={deleteEntry} 
                                navT={navT}
                            />
                        ))
                    )}
                </div>
            </div>
        </m.div>
    );
}
