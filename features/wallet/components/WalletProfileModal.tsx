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
            isModal={true}
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
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-full sm:w-[420px] sm:max-w-[420px] bg-[var(--color-background)]/85 backdrop-blur-sm shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] z-[9001] pointer-events-auto flex flex-col text-[var(--color-text-main)] overflow-x-hidden"
                        >
                            <div className="flex flex-col h-full">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 pt-6 pb-4 bg-[var(--color-surface)]/85 mb-2">
                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={() => sessions['mainnet'] ? switchNetwork('mainnet') : connect(RadixNetworkId.Mainnet)}
                                            className={`text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 relative group ${activeNetwork === 'mainnet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                        >
                                            Mainnet
                                            {activeNetwork === 'mainnet' && (
                                                <motion.div layoutId="network-indicator" className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--color-primary)]" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => sessions['stokenet'] ? switchNetwork('stokenet') : connect(RadixNetworkId.Stokenet)}
                                            className={`text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 relative group ${activeNetwork === 'stokenet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                        >
                                            Stokenet
                                            {activeNetwork === 'stokenet' && (
                                                <motion.div layoutId="network-indicator" className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--color-primary)]" />
                                            )}
                                        </button>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors opacity-80 hover:opacity-100 duration-300"
                                    >
                                        <X strokeWidth={2} className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* User Info & Actions */}
                                <div className="px-6 pt-2 pb-6 flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-5 min-w-0 flex-1">
                                        <div className="w-20 h-20 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-transparent">
                                            {personaIcon ? (
                                                <SafeImage src={personaIcon} alt={personaName} fallbackName={personaName} className="w-full h-full object-cover" />
                                            ) : (
                                                <User strokeWidth={1.5} className="w-10 h-10 text-[var(--color-primary)]" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h2 className="text-2xl font-semibold tracking-tight truncate text-[var(--color-text-main)]">{personaName}</h2>
                                            <p className="text-sm text-[var(--color-text-muted)] mt-1 tracking-wide truncate">
                                                {accounts.length} {navT.accounts ?? 'Cuentas'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Buttons Right Side */}
                                    <div className="flex flex-col items-end justify-center gap-3 shrink-0 pl-2">
                                        <button
                                            onClick={() => {
                                                connect(networkId || RadixNetworkId.Stokenet);
                                            }}
                                            className="flex items-center justify-end gap-2 text-[12px] font-medium text-[var(--color-primary)] opacity-80 hover:opacity-100 transition-all duration-300"
                                        >
                                            <span>{navT.update_wallet ?? 'Actualizar'}</span>
                                            <RefreshCcw strokeWidth={2} className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                disconnect();
                                                onClose();
                                            }}
                                            className="flex items-center justify-end gap-2 text-[12px] font-medium text-red-500 opacity-80 hover:opacity-100 transition-all duration-300"
                                        >
                                            <span>{navT.wallet_disconnect ?? 'Desconectar'}</span>
                                            <LogOut strokeWidth={2} className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="px-6 flex items-center gap-6 mt-1 mb-2 border-b border-[var(--color-surface)]">
                                    <button
                                        onClick={() => handleTabClick('profile')}
                                        className={`pb-2 text-[11px] font-semibold tracking-wider uppercase transition-colors relative border-b-2 ${activeTab === 'profile' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'}`}
                                    >
                                        {navT.profile ?? 'Perfil'}
                                    </button>
                                    <button
                                        onClick={() => handleTabClick('accounts')}
                                        className={`pb-2 text-[11px] font-semibold tracking-wider uppercase transition-colors relative border-b-2 ${activeTab === 'accounts' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'}`}
                                    >
                                        {navT.accounts ?? 'Cuentas'}
                                    </button>
                                    <button
                                        onClick={() => handleTabClick('notifications')}
                                        className={`pb-2 text-[11px] font-semibold tracking-wider uppercase transition-colors relative flex items-center gap-1.5 border-b-2 ${activeTab === 'notifications' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'}`}
                                    >
                                        {navT.notifications ?? 'Notificaciones'}
                                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                                    </button>
                                </div>

                                {/* Tab Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
                                    {activeTab === 'accounts' && (
                                        <div className="space-y-6">
                                            {accounts.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full py-10 text-[var(--color-text-muted)] opacity-60">
                                                    <Wallet strokeWidth={1.5} className="w-10 h-10 mb-3 opacity-50" />
                                                    <p className="text-sm font-medium">{navT.no_accounts ?? 'No hay cuentas conectadas'}</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {accounts.length > 1 && (
                                                        <div className="mb-4 flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                                                            <button
                                                                onClick={() => setSelectedAccountAddress(null)}
                                                                className={`text-[12px] whitespace-nowrap font-medium transition-colors ${!selectedAccountAddress ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                                            >
                                                                {navT.all_accounts ?? 'Todas'}
                                                            </button>
                                                            {accounts.map((acc, idx) => (
                                                                <button
                                                                    key={acc.address}
                                                                    onClick={() => setSelectedAccountAddress(acc.address)}
                                                                    className={`text-[12px] whitespace-nowrap font-medium transition-colors ${selectedAccountAddress === acc.address ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                                                >
                                                                    {acc.label || `${navT.account ?? 'Cuenta'} ${idx + 1}`}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div className="space-y-6">
                                                        {accounts
                                                            .filter(acc => !selectedAccountAddress || acc.address === selectedAccountAddress)
                                                            .map((acc, _index) => {
                                                                const originalIndex = accounts.findIndex(a => a.address === acc.address);
                                                                return (
                                                                    <div key={acc.address} className="relative group">
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
