'use client';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, LogOut, RefreshCcw, Wallet } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { SafeImage } from '@/components/ui/SafeImage';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { AccountSummaryTab } from '@/features/dashboard/explorador/components/AccountSummaryTab';
import { UnderConstructionModal } from '@/components/shared/UnderConstructionModal';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import type { Dictionary } from '@/types/i18n';
import { useCopyToClipboard } from '@/features/dashboard/hooks/useCopyToClipboard';
import { SearchableTagFilter } from '@/components/ui/SearchableTagFilter';

interface WalletProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: Dictionary;
    locale: string;
}

type TabType = 'profile' | 'accounts' | 'notifications';

function WalletAccountSummaryWrapper({
    address,
    entityName,
    tt,
    onCopy,
    copiedAddress,
    network,
    locale
}: {
    address: string;
    entityName: string;
    tt: Parameters<typeof AccountSummaryTab>[0]['tt'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: 'mainnet' | 'stokenet';
    locale: string;
}) {
    const { data: entityData } = useQuery({
        queryKey: entityKeys.detail(address, network),
        queryFn: () => apiFetchEntityDetails(address, network),
        enabled: true,
        staleTime: Infinity,
        gcTime: 10 * 60_000,
    });

    return (
        <AccountSummaryTab
            address={address}
            entityData={entityData || null}
            entityName={entityName}
            iconUrl={undefined}
            getMeta={() => ''}
            tt={tt}
            onCopy={onCopy}
            copiedAddress={copiedAddress}
            network={network}
            locale={locale}
            isBadge={true}
        />
    );
}

export function WalletProfileModal({ isOpen, onClose, t, locale }: WalletProfileModalProps) {
    const { persona, accounts, activeNetworkId: networkId, connect, disconnect, sessions, activeNetwork, switchNetwork } = useRadixWallet();
    const [activeTab, setActiveTab] = useState<TabType>('accounts');
    const [isConstructionOpen, setIsConstructionOpen] = useState(false);
    const [selectedAccountAddress, setSelectedAccountAddress] = useState<string | null>(null);
    const { copiedText, copy } = useCopyToClipboard();

    const navT = (t.nav || {}) as Record<string, string>;

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
                            <div className="flex items-center justify-between px-6 pt-4 border-b border-[var(--color-card-border)]/50">
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={() => sessions['mainnet'] ? switchNetwork('mainnet') : connect(RadixNetworkId.Mainnet)}
                                        className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeNetwork === 'mainnet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                    >
                                        Mainnet
                                        {activeNetwork === 'mainnet' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full" />}
                                    </button>
                                    <button
                                        onClick={() => sessions['stokenet'] ? switchNetwork('stokenet') : connect(RadixNetworkId.Stokenet)}
                                        className={`pb-3 text-sm font-bold uppercase tracking-wider transition-colors relative ${activeNetwork === 'stokenet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                    >
                                        Stokenet
                                        {activeNetwork === 'stokenet' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] rounded-t-full" />}
                                    </button>
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
                                    <div className="space-y-6">
                                        {accounts.length === 0 ? (
                                            <div className="text-center py-12 text-[var(--color-text-muted)]">
                                                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                                <p>{navT.no_accounts ?? 'No hay cuentas conectadas'}</p>
                                            </div>
                                        ) : (
                                            <>
                                                {accounts.length > 1 && (
                                                    <div className="flex justify-center mb-4">
                                                        <SearchableTagFilter
                                                            tags={accounts.map(acc => acc.address)}
                                                            activeTag={selectedAccountAddress}
                                                            onSelect={(tag) => setSelectedAccountAddress(tag)}
                                                            allLabel={navT.all_accounts ?? 'Todas las cuentas'}
                                                            tagLabels={accounts.reduce((acc, account, idx) => ({
                                                                ...acc,
                                                                [account.address]: account.label || `${navT.account ?? 'Cuenta'} ${idx + 1}`
                                                            }), {})}
                                                            placeholder={navT.search_account ?? 'Buscar cuenta...'}
                                                            width="w-full"
                                                        />
                                                    </div>
                                                )}
                                                
                                                <div className="space-y-8">
                                                    {accounts
                                                        .filter(acc => !selectedAccountAddress || acc.address === selectedAccountAddress)
                                                        .map((acc, _index) => {
                                                            const originalIndex = accounts.findIndex(a => a.address === acc.address);
                                                            return (
                                                                <div key={acc.address} className="pb-8 border-b border-[var(--color-card-border)]/30 last:border-0 last:pb-0">
                                                                    <WalletAccountSummaryWrapper
                                                                        address={acc.address}
                                                                        entityName={acc.label || `${navT.account ?? 'Cuenta'} ${originalIndex + 1}`}
                                                                        tt={t as unknown as Parameters<typeof AccountSummaryTab>[0]['tt']}
                                                                        onCopy={copy}
                                                                        copiedAddress={copiedText}
                                                                        network={networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet'}
                                                                        locale={locale}
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </>
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
