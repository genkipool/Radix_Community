'use client';
import React, { useState } from 'react';
import { m, AnimatePresence } from "motion/react";
import { X, User, LogOut, RefreshCcw, Wallet, MoreVertical, LayoutPanelLeft, PictureInPicture2, AppWindow } from 'lucide-react';
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
import dashboardExploradorEn from '@/features/dashboard/explorador/locales/en.json';
import dashboardExploradorEs from '@/features/dashboard/explorador/locales/es.json';
import dashboardStakingEn from '@/features/dashboard/staking/locales/en.json';
import dashboardStakingEs from '@/features/dashboard/staking/locales/es.json';
import { useCopyToClipboard } from '@/features/dashboard/hooks/useCopyToClipboard';
import { CarouselFilter } from '@/components/ui/CarouselFilter';
import { TransactionBuilder } from './TransactionBuilder';
import { InlineAddressBook } from './InlineAddressBook';
import { BookUser } from 'lucide-react';
interface WalletProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    t: Dictionary;
    locale: string;
    isStandalone?: boolean;
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

export function WalletProfileModal({ isOpen, onClose, t, locale, isStandalone = false }: WalletProfileModalProps) {
    const { persona, accounts, activeNetworkId: networkId, connect, disconnect, sessions, activeNetwork, switchNetwork, selectedAccountAddresses, setSelectedAccountAddresses } = useRadixWallet();
    const [activeTab, setActiveTab] = useState<TabType>('accounts');
    const [isConstructionOpen, setIsConstructionOpen] = useState(false);
    const [isAddressBookVisible, setIsAddressBookVisible] = useState(false);
    const [externalWindow, setExternalWindow] = useState<Window | null>(null);
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

    const handlePiP = async () => {
        if ('documentPictureInPicture' in window) {
            try {
                const pipWindow = await (window as Window & { documentPictureInPicture?: { requestWindow: (opts: { width: number; height: number }) => Promise<Window> } }).documentPictureInPicture!.requestWindow({
                    width: 420,
                    height: 800,
                });
                
                const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
                styles.forEach((style) => {
                    pipWindow.document.head.appendChild(style.cloneNode(true));
                });
                
                pipWindow.document.documentElement.className = document.documentElement.className;
                pipWindow.document.documentElement.style.cssText = document.documentElement.style.cssText;
                pipWindow.document.body.className = 'bg-[var(--color-bg)]';
                
                pipWindow.addEventListener('pagehide', () => {
                    setExternalWindow(null);
                });
                
                setExternalWindow(pipWindow);
            } catch (e) {
                console.error(e);
                alert('No se pudo abrir la ventana Picture-in-Picture.');
            }
        } else {
            alert('La API Document Picture-in-Picture no está soportada en tu navegador (requiere Chrome/Edge 111+).');
        }
    };

    const handlePopupWindow = () => {
        const popup = window.open(
            '',
            'RadixWalletPopup',
            'width=420,height=800,scrollbars=yes,resizable=yes'
        );
        if (!popup) {
            alert('El navegador bloqueó la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.');
            return;
        }

        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'));
        styles.forEach((style) => {
            popup.document.head.appendChild(style.cloneNode(true));
        });

        popup.document.documentElement.className = document.documentElement.className;
        popup.document.documentElement.style.cssText = document.documentElement.style.cssText;
        popup.document.body.className = 'bg-[var(--color-bg)]';
        
        popup.addEventListener('beforeunload', () => {
            setExternalWindow(null);
        });

        setExternalWindow(popup);
    };



    const handleClose = () => {
        if (isPinned) {
            setIsPinned(false);
            localStorage.setItem('walletPinned', 'false');
        }
        if (externalWindow) {
            externalWindow.close();
            setExternalWindow(null);
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

    const isStandaloneMode = isStandalone || !!externalWindow;

    return (
        <Portal target={externalWindow ? externalWindow.document.body : undefined}>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop – closes modal on mousedown (not mouseup/click) */}
                        {!isPinned && !isStandaloneMode && (
                            <m.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
                                className="fixed inset-0 z-[9000]"
                                onMouseDown={handleClose}
                            />
                        )}
                        <m.div
                            initial={isStandaloneMode ? undefined : { x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={isStandaloneMode ? undefined : { x: '100%', opacity: 0 }}
                            transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }}
                            className={
                                isStandaloneMode
                                    ? 'w-full h-full flex flex-col text-[var(--color-text-main)] overflow-x-hidden bg-[var(--color-bg)]'
                                    : `fixed top-0 right-0 h-full w-full sm:w-[420px] sm:max-w-[420px] z-[9001] pointer-events-auto flex flex-col text-[var(--color-text-main)] overflow-x-hidden transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ${
                                        isPinned
                                            ? 'bg-[var(--color-bg)] border-l border-[var(--color-card-border)] shadow-none'
                                            : 'bg-[var(--color-bg)]/85 backdrop-blur-sm shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)]'
                                    }`
                            }
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
                                        <div className="relative group/menu">
                                            <button
                                                type="button"
                                                className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg)] transition-colors opacity-80 hover:opacity-100 duration-300"
                                                aria-label="Más opciones"
                                            >
                                                <MoreVertical strokeWidth={2} className="size-5" />
                                            </button>
                                            <div className="absolute top-full right-0 mt-1 w-64 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl z-[9999] opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 overflow-hidden transform origin-top-right scale-95 group-hover/menu:scale-100">
                                                <div className="flex flex-col p-1.5 space-y-0.5">
                                                    <button type="button" onClick={togglePin} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)] rounded-lg transition-colors text-left group/item">
                                                        <LayoutPanelLeft className="size-4 text-[var(--color-text-muted)] group-hover/item:text-[var(--color-primary)] transition-colors" />
                                                        <span>{isPinned ? t.nav.wallet_pin_sidebar_remove || 'Desanclar barra lateral' : t.nav.wallet_pin_sidebar || 'Anclar como barra lateral'}</span>
                                                    </button>
                                                    <button type="button" onClick={handlePiP} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)] rounded-lg transition-colors text-left group/item">
                                                        <PictureInPicture2 className="size-4 text-[var(--color-text-muted)] group-hover/item:text-[var(--color-primary)] transition-colors" />
                                                        <span>{t.nav.wallet_picture_in_picture || 'Convertir a ventana picture in picture'}</span>
                                                    </button>
                                                    <button type="button" onClick={handlePopupWindow} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-semibold text-[var(--color-text-main)] hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)] rounded-lg transition-colors text-left group/item">
                                                        <AppWindow className="size-4 text-[var(--color-text-muted)] group-hover/item:text-[var(--color-primary)] transition-colors" />
                                                        <span>{t.nav.wallet_popup_window || 'Convertir en ventana emergente'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
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
                                                        <div className="mb-4">
                                                            <h3 className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--color-text-muted)] border-b border-[var(--color-card-border)]/50 pb-2 mb-3 px-1">
                                                                {navT.filter_addresses || 'Filtrar direcciones'}
                                                            </h3>
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
                                                                    title={navT.filter_addresses || 'Filtrar direcciones'}
                                                                    filterText={navT.filter || 'Filtrar'}
                                                                    multiSelectLabel={navT.selected || 'seleccionadas'}
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
                                                        </div>

                                                    <AnimatePresence>
                                                        {isAddressBookVisible && <InlineAddressBook navT={navT} />}
                                                    </AnimatePresence>

                                                    <div className="space-y-6">
                                                        {accounts.flatMap(account =>
                                                            selectedAccountAddresses.length === 0 || selectedAccountAddresses.includes(account.address)
                                                                ? [<div key={account.address} className="relative group">
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
