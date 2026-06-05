'use client';

import React, { useState } from 'react';
import { m, AnimatePresence } from "motion/react";
import { Search, X, Coins, Image as ImageIcon, Layers, BookUser } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';
import { ModalOverlay } from '@/components/ui/ModalOverlay';
import { SafeImage } from '@/components/ui/SafeImage';
import { useQuery } from '@tanstack/react-query';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';

export type AssetType = 'address' | 'fungible' | 'non_fungible' | 'pool_unit';

export interface SelectedAsset {
    type: AssetType;
    resourceAddress: string;
    symbol: string;
    name: string;
    iconUrl?: string;
    amount?: string;
    id?: string;
}

interface MetadataItem {
    key: string;
    typed?: {
        value?: {
            value?: string;
        }
    }
}

interface ResourceItem {
    resource_address: string;
    explicit_metadata?: {
        items?: MetadataItem[];
    };
    vaults?: {
        items?: Array<{
            amount?: string;
            items?: string[];
        }>;
    };
}

interface AssetSelectionPopupProps {
    isOpen: boolean;
    onClose: () => void;
    network: 'mainnet' | 'stokenet';
    address: string;
    onSelectAsset: (asset: SelectedAsset) => void;
}

export function AssetSelectionPopup({ isOpen, onClose, network, address, onSelectAsset }: AssetSelectionPopupProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<AssetType>('fungible');
    const { accounts } = useRadixWallet();
    const { data: validatorsData } = useValidatorsQuery(network);

    const { data: entityData, isLoading } = useQuery({
        queryKey: dashboardKeys.entities.detail(address, network),
        queryFn: () => apiFetchEntityDetails(address, network),
        enabled: isOpen,
    });

    const handleSelect = (asset: SelectedAsset) => {
        onSelectAsset(asset);
        onClose();
    };

    // Filter logic
    const query = searchQuery.toLowerCase();

    // 1. Available Addresses (own accounts excluding current)
    const availableAddresses = accounts.filter(a => a.address !== address && (a.label.toLowerCase().includes(query) || a.address.toLowerCase().includes(query)));

    // 2. Fungibles
    const fungibles = (() => {
        if (!entityData?.fungible_resources?.items) return [];
        return entityData.fungible_resources.items.filter((f: ResourceItem) => {
            const name = f.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'name')?.typed?.value?.value || 'Unknown';
            let symbol = f.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'symbol')?.typed?.value?.value || 'Unknown';
            
            const valAddr = f.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'validator')?.typed?.value?.value;
            if (valAddr) {
                const valName = validatorsData?.validators?.find(v => v.address === valAddr)?.name;
                symbol = valName ? `${valName} LSU` : 'LSU';
            }
            
            return name.toLowerCase().includes(query) || symbol.toLowerCase().includes(query);
        });
    })();

    // 3. Non-fungibles
    const nonFungibles = (() => {
        if (!entityData?.non_fungible_resources?.items) return [];
        return entityData.non_fungible_resources.items.filter((nf: ResourceItem) => {
            const name = nf.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'name')?.typed?.value?.value || 'Unknown NFT';
            return name.toLowerCase().includes(query);
        });
    })();

    // 4. Pool Units
    const entityWithPools = entityData as typeof entityData & { pool_units?: { items?: ResourceItem[] } };
    const poolUnits = (() => {
        if (!entityWithPools?.pool_units?.items) return [];
        return entityWithPools.pool_units.items.filter((pu: ResourceItem) => {
            const name = pu.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'name')?.typed?.value?.value || 'Pool Unit';
            return name.toLowerCase().includes(query);
        });
    })();
    const poolUnitCount = entityWithPools?.pool_units?.items?.length || 0;

    const renderTabButton = (type: AssetType, label: string, icon: React.ReactNode, count?: number) => (
        <button
            onClick={() => setActiveTab(type)}
            className={`flex items-center gap-2 pb-2 text-[11px] font-semibold tracking-wider uppercase transition-colors relative border-b-2 whitespace-nowrap px-1 \${
                activeTab === type ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'
            }`}
        >
            {icon}
            {label} {count !== undefined && `(\${count})`}
        </button>
    );

    return (
        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-auto">
                        <ModalOverlay onClose={onClose} blur="sm" />
                        <m.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="relative w-[90%] max-w-[480px] bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--color-text-main)]"
                        >
                            {/* Header */}
                            <div className="p-4 border-b border-[var(--color-card-border)] flex items-center justify-between">
                                <h3 className="text-sm font-bold tracking-wider uppercase">Seleccionar Activo</h3>
                                <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] transition-colors">
                                    <X strokeWidth={2} className="size-4" />
                                </button>
                            </div>

                            {/* Search */}
                            <div className="p-4 border-b border-[var(--color-card-border)] relative">
                                <Search className="absolute left-7 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre o símbolo..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-[var(--color-bg)]/50 border border-[var(--color-card-border)] rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[var(--color-primary)]/50 transition-colors"
                                />
                            </div>

                            {/* Tabs */}
                            <div className="px-4 pt-4 flex gap-4 overflow-x-auto custom-scrollbar border-b border-[var(--color-card-border)]">
                                {renderTabButton('address', 'Direcciones', <BookUser className="size-3.5" />, availableAddresses.length)}
                                {renderTabButton('fungible', 'Tokens', <Coins className="size-3.5" />, entityData?.fungible_resources?.items?.length || 0)}
                                {renderTabButton('non_fungible', 'NFTs', <ImageIcon className="size-3.5" />, entityData?.non_fungible_resources?.items?.length || 0)}
                                {renderTabButton('pool_unit', 'Pools', <Layers className="size-3.5" />, poolUnitCount)}
                            </div>

                            {/* Content */}
                            <div className="p-2 h-[320px] overflow-y-auto custom-scrollbar">
                                {isLoading ? (
                                    <div className="flex justify-center items-center h-full text-[var(--color-text-muted)] text-sm">Cargando...</div>
                                ) : (
                                    <div className="space-y-1">
                                        {activeTab === 'address' && (
                                            availableAddresses.length === 0 ? <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">No se encontraron direcciones</div> :
                                            availableAddresses.map(acc => (
                                                <button
                                                    key={acc.address}
                                                    onClick={() => handleSelect({ type: 'address', resourceAddress: acc.address, symbol: 'ADDR', name: acc.label })}
                                                    className="w-full text-left flex flex-col p-3 rounded-xl hover:bg-[var(--color-bg)] transition-colors group"
                                                >
                                                    <span className="font-semibold text-sm group-hover:text-[var(--color-primary)] transition-colors">{acc.label}</span>
                                                    <span className="text-xs text-[var(--color-text-muted)] truncate">{acc.address}</span>
                                                </button>
                                            ))
                                        )}

                                        {activeTab === 'fungible' && (
                                            fungibles.length === 0 ? <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">No se encontraron tokens</div> :
                                            fungibles.map((f: ResourceItem) => {
                                                const name = f.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'name')?.typed?.value?.value || 'Unknown';
                                                let symbol = f.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'symbol')?.typed?.value?.value || 'Unknown';
                                                
                                                const valAddr = f.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'validator')?.typed?.value?.value;
                                                if (valAddr) {
                                                    const valName = validatorsData?.validators?.find(v => v.address === valAddr)?.name;
                                                    symbol = valName ? `${valName} LSU` : 'LSU';
                                                }
                                                
                                                const icon = f.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'icon_url')?.typed?.value?.value || '';
                                                return (
                                                    <button
                                                        key={f.resource_address}
                                                        onClick={() => handleSelect({ type: 'fungible', resourceAddress: f.resource_address, symbol, name, iconUrl: icon })}
                                                        className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-bg)] transition-colors group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-8 rounded-full bg-[var(--color-card-border)] overflow-hidden shrink-0">
                                                                {icon ? <SafeImage src={icon} alt={name} fallbackName={name} className="w-full h-full object-cover" /> : <Coins className="size-4 m-auto mt-2 text-[var(--color-text-muted)]" />}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-sm group-hover:text-[var(--color-primary)] transition-colors">{symbol}</span>
                                                                <span className="text-xs text-[var(--color-text-muted)] truncate">{name}</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-mono font-bold">{parseFloat(f.vaults?.items?.[0]?.amount || '0').toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                                    </button>
                                                );
                                            })
                                        )}

                                        {activeTab === 'non_fungible' && (
                                            nonFungibles.length === 0 ? <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">No se encontraron NFTs</div> :
                                            nonFungibles.flatMap((nf: ResourceItem) => {
                                                const name = nf.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'name')?.typed?.value?.value || 'Unknown NFT';
                                                const icon = nf.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'icon_url')?.typed?.value?.value || '';
                                                
                                                // If we have specific vault items, map each ID
                                                const vault = nf.vaults?.items?.[0];
                                                if (!vault || !vault.items) return [];

                                                return vault.items.map((id: string) => (
                                                    <button
                                                        key={`${nf.resource_address}-${id}`}
                                                        onClick={() => handleSelect({ type: 'non_fungible', resourceAddress: nf.resource_address, symbol: 'NFT', name, iconUrl: icon, id })}
                                                        className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-bg)] transition-colors group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-8 rounded-lg bg-[var(--color-card-border)] overflow-hidden shrink-0">
                                                                {icon ? <SafeImage src={icon} alt={name} fallbackName={name} className="w-full h-full object-cover" /> : <ImageIcon className="size-4 m-auto mt-2 text-[var(--color-text-muted)]" />}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-semibold text-sm group-hover:text-[var(--color-primary)] transition-colors truncate">{name}</span>
                                                                <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">{id}</span>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ));
                                            })
                                        )}

                                        {activeTab === 'pool_unit' && (
                                            poolUnits.length === 0 ? <div className="p-4 text-center text-sm text-[var(--color-text-muted)]">No se encontraron Pool Units</div> :
                                            poolUnits.map((pu: ResourceItem) => {
                                                const name = pu.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'name')?.typed?.value?.value || 'Pool Unit';
                                                const symbol = pu.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'symbol')?.typed?.value?.value || 'POOL';
                                                const icon = pu.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'icon_url')?.typed?.value?.value || '';
                                                return (
                                                    <button
                                                        key={pu.resource_address}
                                                        onClick={() => handleSelect({ type: 'pool_unit', resourceAddress: pu.resource_address, symbol, name, iconUrl: icon })}
                                                        className="w-full text-left flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-bg)] transition-colors group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="size-8 rounded-full bg-[var(--color-card-border)] overflow-hidden shrink-0">
                                                                {icon ? <SafeImage src={icon} alt={name} fallbackName={name} className="w-full h-full object-cover" /> : <Layers className="size-4 m-auto mt-2 text-[var(--color-text-muted)]" />}
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-sm group-hover:text-[var(--color-primary)] transition-colors">{symbol}</span>
                                                                <span className="text-xs text-[var(--color-text-muted)] truncate">{name}</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-xs font-mono font-bold">{parseFloat(pu.vaults?.items?.[0]?.amount || '0').toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        </m.div>
                    </div>
                )}
            </AnimatePresence>
        </Portal>
    );
}
