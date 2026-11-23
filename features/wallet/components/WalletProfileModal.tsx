'use client';
import React, { useState } from 'react';
import { m, AnimatePresence } from "motion/react";
import { X, User, LogOut, RefreshCcw, Wallet, ChevronDown } from 'lucide-react';
import { SidePanelModal } from '@/components/shared/SidePanelModal';
import { SidePanelControls } from '@/components/shared/SidePanelControls';
import { useSidePanelControls } from '@/components/shared/hooks/useSidePanelControls';
import { SafeImage } from '@/components/ui/SafeImage';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { AccountSummaryTab } from '@/features/dashboard/explorador/components/AccountSummaryTab';
import { UnderConstructionModal } from '@/components/shared/UnderConstructionModal';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { entityKeys } from '@/features/dashboard/utils/entityCache';
import type { Dictionary } from '@/types/i18n';
import dashboardExploradorEn from '@/features/dashboard/explorador/locales/en.json';
import dashboardExploradorEs from '@/features/dashboard/explorador/locales/es.json';
import dashboardStakingEn from '@/features/dashboard/staking/locales/en.json';
import dashboardStakingEs from '@/features/dashboard/staking/locales/es.json';
import { useCopyToClipboard } from '@/features/dashboard/hooks/useCopyToClipboard';
import { CarouselFilter } from '@/components/ui/CarouselFilter';
import { TransactionBuilder } from './TransactionBuilder';
import { InlineAddressBook } from './InlineAddressBook';
import { WalletSectionsMenu } from './WalletSectionsMenu';
import {
    useWalletModalSections,
    type WalletModalSectionKey,
    type WalletModalSectionsVisibility,
} from '../hooks/useWalletModalSections';
import { BookUser } from 'lucide-react';
interface WalletProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: Dictionary;
    locale: string;
    isStandalone?: boolean;
    onBuyClick?: () => void;
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
    sendTransactionSection,
    filterSection,
    visibleSections,
    sectionOrder,
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
    filterSection?: React.ReactNode;
    visibleSections?: WalletModalSectionsVisibility;
    sectionOrder?: WalletModalSectionKey[];
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
            filterSection={filterSection}
            visibleSections={visibleSections}
            sectionOrder={sectionOrder}
        />
    );
}

export function WalletProfileModal({ isOpen, onClose, t, locale, isStandalone = false, onBuyClick }: WalletProfileModalProps) {
    const { persona, accounts, activeNetworkId: networkId, connect, disconnect, sessions, activeNetwork, switchNetwork, selectedAccountAddresses, setSelectedAccountAddresses } = useRadixWallet();
    const [activeTab, setActiveTab] = useState<TabType>('accounts');
    const [isConstructionOpen, setIsConstructionOpen] = useState(false);
    const [isAddressBookVisible, setIsAddressBookVisible] = useState(false);
    const [isFilterOpen, setIsFilterOpen] = useState(true);
    const {
        visibleSections,
        sectionOrder,
        toggleSection,
        reorderSections,
        resetSections,
        hasHiddenSections,
        hasCustomOrder,
    } = useWalletModalSections();
    const { copiedText, copy } = useCopyToClipboard();

    const navT = (t.nav || {}) as Record<string, string>;

    const {
        isPinned,
        togglePin,
        handlePiP,
        handlePopupWindow,
        externalWindow,
        closeExternalWindow,
        resetPin,
    } = useSidePanelControls('walletPinned');



    const handleClose = () => {
        resetPin();
        closeExternalWindow();
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

    const isStandaloneMode = isStandalone || !!externalWindow;

    return (
        <>
            <SidePanelModal
                isOpen={isOpen}
                onClose={handleClose}
                isStandalone={isStandaloneMode}
                isPinned={isPinned}
                portalTarget={externalWindow ? externalWindow.document.body : undefined}
                widthClass="sm:w-[430px] sm:max-w-[430px]"
            >
            <div className="flex flex-col h-full">
                                {/* Header */}
                                <div className="flex items-center justify-between px-6 pt-6 pb-4 bg-[var(--color-surface)]/85 mb-2">
                                    <div className="flex items-center gap-6 overflow-x-auto no-scrollbar pr-4">
                                        <button
                                            type="button"
                                            onClick={() => sessions['mainnet'] ? switchNetwork('mainnet') : connect(RadixNetworkId.Mainnet)}
                                            className={`text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 relative group shrink-0 ${activeNetwork === 'mainnet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                        >
                                            Mainnet
                                            {activeNetwork === 'mainnet' && (
                                                <m.div layoutId="network-indicator" className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--color-primary)]" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => sessions['stokenet'] ? switchNetwork('stokenet') : connect(RadixNetworkId.Stokenet)}
                                            className={`text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 relative group shrink-0 ${activeNetwork === 'stokenet' ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}
                                        >
                                            Stokenet
                                            {activeNetwork === 'stokenet' && (
                                                <m.div layoutId="network-indicator" className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[var(--color-primary)]" />
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsConstructionOpen(true)}
                                            className={`text-[10px] font-bold tracking-[0.15em] uppercase transition-all duration-300 relative group text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] shrink-0`}
                                        >
                                            {navT.full_profile ?? 'Perfil Completo'}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <SidePanelControls
                                            isPinned={isPinned}
                                            togglePin={togglePin}
                                            handlePiP={handlePiP}
                                            handlePopupWindow={handlePopupWindow}
                                            pinText={t.nav?.wallet_pin_sidebar || 'Anclar como barra lateral'}
                                            unpinText={t.nav?.wallet_pin_sidebar_remove || 'Desanclar barra lateral'}
                                            pipText={t.nav?.wallet_picture_in_picture || 'Convertir a ventana picture in picture'}
                                            popupText={t.nav?.wallet_popup_window || 'Convertir en ventana emergente'}
                                        />
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg)] transition-colors opacity-80 hover:opacity-100 duration-300"
                                        >
                                            <X strokeWidth={2} className="size-5" />
                                        </button>
                                    </div>
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
                                                disconnect(activeNetwork);
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
                                <div className="px-6 flex items-center justify-between gap-2 mt-1 mb-2 border-b border-[var(--color-surface)]">
                                    <div className="flex items-stretch self-stretch gap-6 overflow-x-auto custom-scrollbar min-w-0 flex-1">
                                        <button
                                            type="button"
                                            onClick={() => handleTabClick('accounts')}
                                            className={`flex items-center pt-0.5 text-[11px] font-semibold tracking-wider uppercase transition-colors relative border-b-2 whitespace-nowrap ${activeTab === 'accounts' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'}`}
                                        >
                                            {navT.accounts ?? 'Cuentas'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleTabClick('notifications')}
                                            className={`flex items-center gap-1.5 pt-0.5 text-[11px] font-semibold tracking-wider uppercase transition-colors relative border-b-2 whitespace-nowrap ${activeTab === 'notifications' ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'}`}
                                        >
                                            {navT.notifications ?? 'Notificaciones'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (onBuyClick) {
                                                    onClose();
                                                    onBuyClick();
                                                }
                                            }}
                                            className="flex items-center gap-1.5 pt-0.5 text-[11px] font-semibold tracking-wider uppercase transition-colors relative border-b-2 text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)] whitespace-nowrap"
                                        >
                                            {navT.wallet_buy_xrd ?? 'Comprar XRD'}
                                        </button>
                                    </div>
                                    <WalletSectionsMenu
                                        visibleSections={visibleSections}
                                        sectionOrder={sectionOrder}
                                        hasHiddenSections={hasHiddenSections}
                                        hasCustomOrder={hasCustomOrder}
                                        onToggleSection={toggleSection}
                                        onReorderSections={reorderSections}
                                        onResetSections={resetSections}
                                        navT={navT}
                                        closeLabel={t.ui?.close ?? ''}
                                    />
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
                                            ) : (() => {
                                                const visibleAccounts = accounts.filter(
                                                    (account) =>
                                                        selectedAccountAddresses.length === 0 ||
                                                        selectedAccountAddresses.includes(account.address),
                                                );
                                                const firstVisibleSection = sectionOrder.find(
                                                    (key) => visibleSections[key],
                                                );
                                                const filterAtTop = firstVisibleSection === 'filter';
                                                const inlineFilterInAccount =
                                                    visibleAccounts.length === 1 && !filterAtTop;
                                                const filterAtBottom =
                                                    !inlineFilterInAccount &&
                                                    !filterAtTop &&
                                                    sectionOrder[sectionOrder.length - 1] === 'filter';
                                                const filterSectionNode = visibleSections.filter ? (
                                                    <div className={inlineFilterInAccount ? '' : 'mb-4'}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsFilterOpen(v => !v)}
                                                            aria-expanded={isFilterOpen}
                                                            className="w-full flex items-center justify-between gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] border-b border-[var(--color-card-border)]/50 pb-2 mb-3 px-1 transition-colors"
                                                        >
                                                            <span>{navT.filter_addresses || 'Filtrar direcciones'}</span>
                                                            <ChevronDown className={`size-3.5 shrink-0 transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                                                        </button>
                                                        <AnimatePresence initial={false}>
                                                            {isFilterOpen && (
                                                                <m.div
                                                                    initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
                                                                    animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
                                                                    exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
                                                                    transition={{ duration: 0.2 }}
                                                                >
                                                                    <div className="flex items-center relative">
                                                                        <div className="flex-1 min-w-0">
                                                                            <CarouselFilter
                                                                                options={[
                                                                                    ...(accounts.length > 1 ? [{ value: null, label: navT.all_accounts ?? 'Todas' }] : []),
                                                                                    ...accounts.map((acc, idx) => ({
                                                                                        value: acc.address,
                                                                                        label: acc.label || `${navT.account ?? 'Cuenta'} ${idx + 1}`
                                                                                    }))
                                                                                ]}
                                                                                activeValues={selectedAccountAddresses}
                                                                                onChange={(vals) => setSelectedAccountAddresses(vals)}
                                                                                title={navT.filter_addresses}
                                                                                filterText={navT.filter}
                                                                                multiSelectLabel={navT.selected}
                                                                                isRelative={false}
                                                                            />
                                                                        </div>
                                                                        <button
                                                                            className={`p-2 w-10 flex items-center justify-center transition-colors shrink-0 ml-1 rounded-full ${isAddressBookVisible ? 'text-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)]'}`}
                                                                            onClick={() => setIsAddressBookVisible(!isAddressBookVisible)}
                                                                            title="Agenda de direcciones"
                                                                        >
                                                                            <BookUser className="size-5" />
                                                                        </button>
                                                                    </div>
                                                                    <AnimatePresence>
                                                                        {isAddressBookVisible && <InlineAddressBook navT={navT} />}
                                                                    </AnimatePresence>
                                                                </m.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </div>
                                                ) : null;

                                                return (
                                                    <>
                                                        {!inlineFilterInAccount && !filterAtBottom && filterSectionNode}

                                                        <div className="space-y-6">
                                                            {visibleAccounts.map((account) => (
                                                                <div key={account.address} className="relative group">
                                                                    <WalletAccountSummaryWrapper
                                                                        address={account.address}
                                                                        entityName={account.label || `${navT.account ?? 'Cuenta'} ${accounts.findIndex(a => a.address === account.address) + 1}`}
                                                                        tt={(t?.dashboard?.transactions || (locale === 'es' ? dashboardExploradorEs.dashboard.transactions : dashboardExploradorEn.dashboard.transactions)) as unknown as Parameters<typeof AccountSummaryTab>[0]['tt']}
                                                                        onCopy={copy}
                                                                        copiedAddress={copiedText}
                                                                        network={networkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet'}
                                                                        locale={locale}
                                                                        isOpen={isOpen}
                                                                        stakingErrors={(t?.dashboard?.staking?.errors || (locale === 'es' ? dashboardStakingEs.dashboard.staking.errors : dashboardStakingEn.dashboard.staking.errors)) as unknown as Parameters<typeof AccountSummaryTab>[0]['stakingErrors']}
                                                                        sendTransactionSection={visibleSections.send ? <TransactionBuilder accountAddress={account.address} t={t} /> : undefined}
                                                                        filterSection={inlineFilterInAccount ? filterSectionNode : undefined}
                                                                        visibleSections={visibleSections}
                                                                        sectionOrder={sectionOrder}
                                                                    />
                                                                </div>
                                                            ))}
                                                        </div>

                                                        {!inlineFilterInAccount && filterAtBottom && filterSectionNode}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>

            </div>
        </SidePanelModal>

            <UnderConstructionModal
                isOpen={isConstructionOpen}
                onClose={() => setIsConstructionOpen(false)}
                t={t}
                overlayClassName={isOpen ? "sm:right-[420px]" : ""}
                contentClassName={isOpen ? "sm:pr-[420px]" : ""}
            />
        </>
    );
}
