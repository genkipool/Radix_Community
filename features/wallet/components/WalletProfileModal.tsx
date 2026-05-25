'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, ShieldCheck, LogOut, RefreshCcw, Wallet } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { SafeImage } from '@/components/ui/SafeImage';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { AccountSummaryTab } from '@/features/dashboard/explorador/components/AccountSummaryTab';
import { UnderConstructionModal } from '@/components/shared/UnderConstructionModal';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import type { Dictionary } from '@/types/i18n';
import { useCopyToClipboard } from '@/features/dashboard/hooks/useCopyToClipboard';

interface WalletProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: Dictionary;
    locale: string;
}

type TabType = 'profile' | 'accounts' | 'notifications';

export function WalletProfileModal({ isOpen, onClose, t, locale }: WalletProfileModalProps) {
    const { persona, accounts, activeNetworkId: networkId, connect, disconnect } = useRadixWallet();
    const [activeTab, setActiveTab] = useState<TabType>('accounts');
    const [isConstructionOpen, setIsConstructionOpen] = useState(false);
    const { copiedText, copy } = useCopyToClipboard();

    const navT = (t.nav || {}) as Record<string, string>;

    // Default to a connected network text
    const networkName = networkId === RadixNetworkId.Mainnet ? 'Mainnet' : 'Stokenet';
    const personaName = persona?.label || navT.wallet_connected || 'Persona';
    const personaIcon = ''; // Replace with persona icon if available in future

    const handleTabClick = (tab: TabType) => {
        if (tab === 'profile' || tab === 'notifications') {
            setIsConstructionOpen(true);
        } else {
            setActiveTab(tab);
        }
    };

    return (
        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[9000] bg-black/40 pointer-events-auto sm:pointer-events-none"
                            onClick={() => {
                                // Only close on click outside for mobile (where it covers the screen)
                                if (window.innerWidth < 640) onClose();
                            }}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full sm:w-[450px] bg-[var(--color-surface)]/95 backdrop-blur-xl border-l border-[var(--color-card-border)] shadow-2xl z-[9001] pointer-events-auto flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-[var(--color-card-border)]/50">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-[var(--color-accent)]" />
                                    <span className="text-xs font-black uppercase tracking-widest text-[var(--color-text-main)]">
                                        {networkName}
                                    </span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-full hover:bg-[var(--color-bg)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* User Info */}
                            <div className="p-6 pb-0 flex items-center gap-4">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] p-0.5 shrink-0">
                                    <div className="w-full h-full bg-[var(--color-surface)] rounded-[14px] flex items-center justify-center overflow-hidden">
                                        {personaIcon ? (
                                            <SafeImage src={personaIcon} alt={personaName} fallbackName={personaName} className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-8 h-8 text-[var(--color-text-muted)]" />
                                        )}
                                    </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-2xl font-black text-[var(--color-text-main)] truncate">{personaName}</h2>
                                    <p className="text-sm text-[var(--color-text-muted)] mt-1 font-mono truncate">
                                        {accounts.length} {navT.accounts ?? 'Cuentas'}
                                    </p>
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="px-6 mt-6 border-b border-[var(--color-card-border)]/50 flex items-center gap-6">
                                <button
                                    onClick={() => handleTabClick('profile')}
                                    className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'profile' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {navT.profile ?? 'Perfil'}
                                    {activeTab === 'profile' && <motion.div layoutId="wallet-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full" />}
                                </button>
                                <button
                                    onClick={() => handleTabClick('accounts')}
                                    className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'accounts' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {navT.accounts ?? 'Cuentas'}
                                    {activeTab === 'accounts' && <motion.div layoutId="wallet-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full" />}
                                </button>
                                <button
                                    onClick={() => handleTabClick('notifications')}
                                    className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors relative flex items-center gap-2 ${activeTab === 'notifications' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                >
                                    {navT.notifications ?? 'Notificaciones'}
                                    <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                                    {activeTab === 'notifications' && <motion.div layoutId="wallet-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full" />}
                                </button>
                            </div>

                            {/* Tab Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                                {activeTab === 'accounts' && (
                                    <div className="space-y-8">
                                        {accounts.length === 0 ? (
                                            <div className="text-center py-12 text-[var(--color-text-muted)]">
                                                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>{navT.no_accounts ?? 'No hay cuentas conectadas'}</p>
                                            </div>
                                        ) : (
                                            accounts.map((acc, index) => (
                                                <div key={acc.address} className="pb-8 border-b border-[var(--color-card-border)]/30 last:border-0">
                                                    <AccountSummaryTab
                                                        address={acc.address}
                                                        entityData={null}
                                                        entityName={acc.label || `${navT.account ?? 'Cuenta'} ${index + 1}`}
                                                        iconUrl={undefined}
                                                        getMeta={() => ''}
                                                        tt={t as unknown as Parameters<typeof AccountSummaryTab>[0]['tt']}
                                                        onCopy={copy}
                                                        copiedAddress={copiedText}
                                                        network={networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet'}
                                                        locale={locale}
                                                        isBadge={true}
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer / Action buttons */}
                            <div className="p-6 border-t border-[var(--color-card-border)]/50 bg-[var(--color-bg)]/50 grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => {
                                        connect(networkId || RadixNetworkId.Stokenet);
                                        onClose();
                                    }}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-xl text-sm font-bold text-[var(--color-text-main)] hover:bg-[var(--color-card-border)]/20 transition-all shadow-sm active:scale-95"
                                >
                                    <RefreshCcw className="w-4 h-4 text-[var(--color-primary)]" />
                                    <span>{navT.update_wallet ?? 'Actualizar'}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        disconnect();
                                        onClose();
                                    }}
                                    className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/20 transition-all shadow-sm active:scale-95"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>{navT.wallet_disconnect ?? 'Desconectar'}</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <UnderConstructionModal
                isOpen={isConstructionOpen}
                onClose={() => setIsConstructionOpen(false)}
                t={t}
            />
        </Portal>
    );
}
