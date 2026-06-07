'use client';
import React, { useState } from 'react';
import { m, AnimatePresence } from "motion/react";
import { X, User, LogOut, RefreshCcw, Wallet, Anchor } from 'lucide-react';
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
import { CarouselFilter } from '@/components/ui/CarouselFilter';
import { TransactionBuilder } from './TransactionBuilder';
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
    locale,
    isOpen,
    stakingErrors,
    sendTransactionSection
}: {
    address: string;
    entityName: string;
    tt: Parameters<typeof AccountSummaryTab>[0]['tt'];
    onCopy: (v: string) => void;
    copiedAddress: string | null;
    network: 'mainnet' | 'stokenet';
    locale: string;
    isOpen: boolean;
    stakingErrors?: Record<string, string>;
    sendTransactionSection?: React.ReactNode;
}) {
    const { data: entityData } = useQuery({
        queryKey: entityKeys.detail(address, network),
        queryFn: () => apiFetchEntityDetails(address, network, true),
        enabled: isOpen,
        staleTime: 0,
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
            stakingErrors={stakingErrors}
            sendTransactionSection={sendTransactionSection}
        />
    );
}

export function WalletProfileModal({ isOpen, onClose, t, locale }: WalletProfileModalProps) {
    const { persona, accounts, activeNetworkId: networkId, connect, disconnect, sessions, activeNetwork, switchNetwork, selectedAccountAddress, setSelectedAccountAddress } = useRadixWallet();
    const [activeTab, setActiveTab] = useState<TabType>('accounts');
    const [isConstructionOpen, setIsConstructionOpen] = useState(false);
    const { copiedText, copy } = useCopyToClipboard();

    const navT = (t.nav || {}) as Record<string, string>;

    const [isPinned, setIsPinned] = useState(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            return localStorage.getItem('walletPinned') === 'true';
        }
        return false;
    });

    React.useEffect(() => {
        if (isOpen && isPinned && window.innerWidth >= 1024) {
            document.body.style.marginRight = '420px';
            document.body.style.transition = 'margin-right 0.3s ease';
            document.documentElement.style.setProperty('--sidebar-width', '420px');
        } else {
            document.body.style.marginRight = '0';
            document.documentElement.style.setProperty('--sidebar-width', '0px');
        }
        return () => {
            document.body.style.marginRight = '0';
            document.documentElement.style.setProperty('--sidebar-width', '0px');
        };
    }, [isOpen, isPinned]);

    const togglePin = () => {
        const newPinned = !isPinned;
        setIsPinned(newPinned);
        localStorage.setItem('walletPinned', newPinned.toString());
    };

    const handleClose = () => {
        if (isPinned) {
            setIsPinned(false);
            localStorage.setItem('walletPinned', 'false');
        }
        onClose();
    };

    const personaName = persona?.label || navT.wallet_connected || 'Persona';
    const personaIcon = ''; // Replace with persona icon if available in future

    const handleTabClick = (tab: TabType | 'full_profile') => {
        if (tab === 'profile' || tab === 'notifications' || tab === 'full_profile') {
            setIsConstructionOpen(true);
        } else {
            setActiveTab(tab as TabType);
        }
    };

    return (
        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <>
                        <m.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className={`fixed top-0 right-0 h-full w-full sm:w-[420px] sm:max-w-[420px] z-[9001] pointer-events-auto flex flex-col text-[var(--color-text-main)] overflow-x-hidden transition-all duration-300 ${
                                isPinned
                                    ? 'bg-[var(--color-bg)] border-l border-[var(--color-card-border)] shadow-none'
                                    : 'bg-[var(--color-bg)]/85 backdrop-blur-sm shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)]'
                            }`}
                        >
                            <div className="flex flex-col h-full">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 pt-6 pb-4 bg-[var(--color-surface)]/85 mb-2">
                                    <div className="flex items-center gap-6">
                                        <button
                                            type="button"
                                            onClick={() => sessions['mainnet'] ? switchNetwork('mainnet') : connect(RadixNetworkId.Mainnet)}
                                            className={`text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 relative group ${activeNetwork === 'mainnet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                        >
                                            Mainnet
                                            {activeNetwork === 'mainnet' && (
                                                <m.div layoutId="network-indicator" className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--color-primary)]" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => sessions['stokenet'] ? switchNetwork('stokenet') : connect(RadixNetworkId.Stokenet)}
                                            className={`text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 relative group ${activeNetwork === 'stokenet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                        >
                                            Stokenet
                                            {activeNetwork === 'stokenet' && (
                                                <m.div layoutId="network-indicator" className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--color-primary)]" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsConstructionOpen(true)}
                                            className={`text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 relative group text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]`}
                                        >
                                            {navT.full_profile ?? 'Perfil Completo'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={togglePin}
                                            className={`hidden lg:flex items-center justify-center transition-all duration-300 ${isPinned ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                            title={isPinned ? 'Desanclar barra lateral' : 'Anclar como barra lateral'}
                                        >
                                            <Anchor className={`size-4 transition-transform duration-300 ${isPinned ? 'scale-110' : ''}`} />
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors opacity-80 hover:opacity-100 duration-300"
                                    >
                                        <X strokeWidth={2} className="size-5" />
                                    </button>
                                </div>

                                {/* User Info & Actions */}
                                <div className="px-6 pt-2 pb-6 flex items-center justify-between gap-6">
                                    <div className="flex items-center gap-5 min-w-0 flex-1">
                                        <div className="size-20 rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-transparent">
                                            {personaIcon ? (
                                                <SafeImage src={personaIcon} alt={personaName} fallbackName={personaName} className="w-full h-full object-cover" />
                                            ) : (
                                                <User strokeWidth={1.5} className="size-10 text-[var(--color-primary)]" />
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
                                            type="button"
                                            onClick={() => {
                                                connect(networkId || RadixNetworkId.Stokenet, true);
                                            }}
                                            className="flex items-center justify-end gap-2 text-[12px] font-medium text-[var(--color-primary)] opacity-80 hover:opacity-100 transition-all duration-300"
                                        >
                                            <span>{navT.update_wallet ?? 'Actualizar'}</span>
                                            <RefreshCcw strokeWidth={2} className="size-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                disconnect();
                                                handleClose();
                                            }}
                                            className="flex items-center justify-end gap-2 text-[12px] font-medium text-red-500 opacity-80 hover:opacity-100 transition-all duration-300"
                                        >
                                            <span>{navT.wallet_disconnect ?? 'Desconectar'}</span>
                                            <LogOut strokeWidth={2} className="size-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="px-6 flex items-center gap-6 mt-1 mb-2 border-b border-[var(--color-surface)] overflow-x-auto custom-scrollbar">
                                    <button
                                        type="button"
                                        onClick={() => handleTabClick('profile')}
                                        className={`pb-2 text-[11px] font-semibold tracking-wider uppercase transition-colors relative border-b-2 whitespace-nowrap ${activeTab === 'profile' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'}`}
                                    >
                                        {navT.profile ?? 'Perfil'}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => handleTabClick('accounts')}
                                        className={`pb-2 text-[11px] font-semibold tracking-wider uppercase transition-colors relative border-b-2 ${activeTab === 'accounts' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'}`}
                                    >
                                        {navT.accounts ?? 'Cuentas'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleTabClick('notifications')}
                                        className={`pb-2 text-[11px] font-semibold tracking-wider uppercase transition-colors relative flex items-center gap-1.5 border-b-2 ${activeTab === 'notifications' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'}`}
                                    >
                                        {navT.notifications ?? 'Notificaciones'}
                                    </button>
                                </div>

                                {/* Tab Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
                                    {activeTab === 'accounts' && (
                                        <div className="space-y-6">
                                            {accounts.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full py-10 text-[var(--color-text-muted)] opacity-60">
                                                    <Wallet strokeWidth={1.5} className="size-10 mb-3 opacity-50" />
                                                    <p className="text-sm font-medium">{navT.no_accounts ?? 'No hay cuentas conectadas'}</p>
                                                </div>
                                            ) : (
                                                <>
                                                    {accounts.length > 1 && (
                                                        <div className="mb-4">
                                                            <CarouselFilter
                                                                options={[
                                                                    { value: null, label: navT.all_accounts ?? 'Todas' },
                                                                    ...accounts.map((acc, idx) => ({
                                                                        value: acc.address,
                                                                        label: acc.label || `${navT.account ?? 'Cuenta'} ${idx + 1}`
                                                                    }))
                                                                ]}
                                                                activeValue={selectedAccountAddress}
                                                                onChange={(val) => setSelectedAccountAddress(val)}
                                                            />
                                                        </div>
                                                    )}

                                                    <div className="space-y-6">
                                                        {accounts.flatMap(account =>
                                                            !selectedAccountAddress || account.address === selectedAccountAddress
                                                                ? [<div key={account.address} className="relative group">
                                                                      <WalletAccountSummaryWrapper
                                                                          address={account.address}
                                                                          entityName={account.label || `${navT.account ?? 'Cuenta'} ${accounts.findIndex(a => a.address === account.address) + 1}`}
                                                                          tt={t as unknown as Parameters<typeof AccountSummaryTab>[0]['tt']}
                                                                          onCopy={copy}
                                                                          copiedAddress={copiedText}
                                                                          network={networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet'}
                                                                          locale={locale}
                                                                          isOpen={isOpen}
                                                                          stakingErrors={t?.dashboard?.staking?.errors}
                                                                          sendTransactionSection={<TransactionBuilder accountAddress={account.address} t={t} />}
                                                                      />
                                                                </div>]
                                                                : []
                                                        )}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                            </div>
                        </m.div>
                    </>
                )}
            </AnimatePresence>

            <UnderConstructionModal
                isOpen={isConstructionOpen}
                onClose={() => setIsConstructionOpen(false)}
                t={t}
                overlayClassName={isOpen ? "sm:right-[420px]" : ""}
                contentClassName={isOpen ? "sm:pr-[420px]" : ""}
            />
        </Portal>
    );
}
