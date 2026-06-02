'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Search, Coins, Image as ImageIcon, Layers, Check } from 'lucide-react';
import { m, AnimatePresence } from "motion/react";
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { buildMultiTransferManifest, TransferGroup } from '@/features/wallet/lib/manifest-builders';
import { apiFetchEntityDetails } from '@/features/dashboard/services/apiClient';
import { useQuery } from '@tanstack/react-query';
import { SafeImage } from '@/components/ui/SafeImage';

interface TransactionBuilderProps {
    accountAddress: string;
    t?: Record<string, unknown>;
    locale?: string;
}

interface AssetItem {
    internalId: string;
    type: 'fungible' | 'non_fungible' | 'pool_unit';
    resourceAddress: string;
    symbol: string;
    name: string;
    iconUrl?: string;
    amount?: string;
    nftId?: string;
    destAddress?: string;
    groupId?: string;
}

interface MetadataItem {
    key: string;
    value?: {
        typed?: {
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

type PopupMode = 'address' | 'asset';
type AssetType = 'address' | 'fungible' | 'non_fungible' | 'pool_unit';

interface SelectedAsset {
    type: AssetType;
    resourceAddress: string;
    symbol: string;
    name: string;
    iconUrl?: string;
    amount?: string;
    id?: string;
}

function getMetadataValue(items: MetadataItem[] | undefined, key: string): string | undefined {
    return items?.find((m: MetadataItem) => m.key === key)?.value?.typed?.value;
}

function isLsuToken(metadataItems: MetadataItem[] | undefined): boolean {
    return !!metadataItems?.some((m: MetadataItem) => m.key === 'validator');
}

export function TransactionBuilder({ accountAddress, t }: TransactionBuilderProps) {
    const navT = (t?.nav || {}) as Record<string, string>;
    const { activeNetworkId, activeNetwork, accounts } = useRadixWallet();
    const network = activeNetwork || 'mainnet';
    const xrdAddress = RADIX_TOKEN_ADDRESSES[activeNetworkId || RadixNetworkId.Mainnet].XRD;

    const [destinationAddress, setDestinationAddress] = useState('');
    const [isAddressValid, setIsAddressValid] = useState<boolean | null>(null);
    const [validatingAddress, setValidatingAddress] = useState(false);

    const [assets, setAssets] = useState<AssetItem[]>([
        {
            internalId: 'default-xrd',
            type: 'fungible',
            resourceAddress: xrdAddress,
            symbol: 'XRD',
            name: 'Radix',
            amount: '',
        }
    ]);

    const [popupOpen, setPopupOpen] = useState(false);
    const [popupMode, setPopupMode] = useState<PopupMode>('asset');
    const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<AssetType>('fungible');

    const [isTransacting, setIsTransacting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Multi-selection state (only used in 'address' mode)
    const [selectedItems, setSelectedItems] = useState<SelectedAsset[]>([]);
    const [addressCount, setAddressCount] = useState(1);
    const [popupDestTarget, setPopupDestTarget] = useState<string | null>(null);

    const assetsRef = useRef(assets);

    useEffect(() => {
        assetsRef.current = assets;
    }, [assets]);

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setPopupOpen(false);
                setPopupDestTarget(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Validate destination address
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!destinationAddress || destinationAddress.length < 10) {
                setIsAddressValid(null);
                return;
            }
            setValidatingAddress(true);
            try {
                if (destinationAddress.startsWith('account_')) {
                    await apiFetchEntityDetails(destinationAddress, network);
                    setIsAddressValid(true);
                } else {
                    setIsAddressValid(false);
                }
            } catch (_err) {
                setIsAddressValid(false);
            } finally {
                setValidatingAddress(false);
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [destinationAddress, network]);

    // Fetch entity data for popup asset selection
    const { data: entityData, isLoading: isLoadingAssets } = useQuery({
        queryKey: ['entityDetails', accountAddress, network],
        queryFn: () => apiFetchEntityDetails(accountAddress, network),
        enabled: popupOpen,
    });

    const handleAssetSelect = (selected: SelectedAsset) => {
        if (selected.type === 'address') {
            setDestinationAddress(selected.resourceAddress);
            setPopupOpen(false);
            setPopupDestTarget(null);
            return;
        }

        const newType = selected.type === 'pool_unit' ? 'fungible' : selected.type;

        if (editingAssetId === 'new') {
            setAssets(prev => [...prev, {
                internalId: Math.random().toString(36).substring(7),
                type: newType,
                resourceAddress: selected.resourceAddress,
                symbol: selected.symbol,
                name: selected.name,
                iconUrl: selected.iconUrl,
                amount: '',
                nftId: selected.id,
            }]);
        } else {
            setAssets(prev => prev.map(a => a.internalId === editingAssetId ? {
                ...a,
                type: newType,
                resourceAddress: selected.resourceAddress,
                symbol: selected.symbol,
                name: selected.name,
                iconUrl: selected.iconUrl,
                nftId: selected.id,
            } : a));
        }
        setPopupOpen(false);
        setPopupDestTarget(null);
    };

    const toggleSelectedItem = (item: SelectedAsset) => {
        setSelectedItems(prev => {
            const key = item.id ? `${item.resourceAddress}-${item.id}` : item.resourceAddress;
            const exists = prev.some(s => {
                const sk = s.id ? `${s.resourceAddress}-${s.id}` : s.resourceAddress;
                return sk === key;
            });
            if (exists) {
                return prev.filter(s => {
                    const sk = s.id ? `${s.resourceAddress}-${s.id}` : s.resourceAddress;
                    return sk !== key;
                });
            }
            return [...prev, item];
        });
    };

    const isItemSelected = (item: SelectedAsset): boolean => {
        const key = item.id ? `${item.resourceAddress}-${item.id}` : item.resourceAddress;
        const inSelected = selectedItems.some(s => {
            const sk = s.id ? `${s.resourceAddress}-${s.id}` : s.resourceAddress;
            return sk === key;
        });
        if (popupDestTarget !== null) {
            const inGroup = assets.some(a => {
                if (a.groupId !== popupDestTarget) return false;
                const ak = a.nftId ? `${a.resourceAddress}-${a.nftId}` : a.resourceAddress;
                return ak === key;
            });
            return inGroup ? !inSelected : inSelected;
        }
        return inSelected;
    };

    const handleConfirmSelection = () => {
        if (popupDestTarget !== null) {
            // Diff mode: compute initial group state from live assets, diff against selectedItems
            const assetKey = (s: { resourceAddress: string; id?: string }) => s.id ? `${s.resourceAddress}-${s.id}` : s.resourceAddress;
            const initialGroupKeys = new Set(
                assetsRef.current
                    .filter(a => a.groupId === popupDestTarget)
                    .map(a => a.nftId ? `${a.resourceAddress}-${a.nftId}` : a.resourceAddress)
            );

            // Items user toggled ON that are NOT already in the group → add
            const added = selectedItems.filter(s => s.type !== 'address' && !initialGroupKeys.has(assetKey(s)));

            // Items user toggled OFF that ARE in the group → remove
            const removedKeys = new Set(
                selectedItems
                    .filter(s => s.type !== 'address')
                    .filter(s => initialGroupKeys.has(assetKey(s)))
                    .map(assetKey)
            );

            if (added.length > 0) {
                const groupExisting = assetsRef.current.filter(a => a.groupId === popupDestTarget);
                const groupDest = groupExisting.length > 0 ? groupExisting[0].destAddress : '';
                setAssets(prev => {
                    const newAssets = added.map(s => ({
                        internalId: Math.random().toString(36).substring(7),
                        type: (s.type === 'pool_unit' ? 'fungible' : s.type) as 'fungible' | 'non_fungible',
                        resourceAddress: s.resourceAddress,
                        symbol: s.symbol,
                        name: s.name,
                        iconUrl: s.iconUrl,
                        amount: '',
                        nftId: s.id,
                        groupId: popupDestTarget,
                        destAddress: groupDest,
                    }));
                    return [...prev, ...newAssets];
                });
            }

            if (removedKeys.size > 0) {
                setAssets(prev => prev.filter(a => {
                    if (a.groupId !== popupDestTarget) return true;
                    const aKey = a.nftId ? `${a.resourceAddress}-${a.nftId}` : a.resourceAddress;
                    return !removedKeys.has(aKey);
                }));
            }
        } else {
            const assetKey = (s: { resourceAddress: string; id?: string }) => s.id ? `${s.resourceAddress}-${s.id}` : s.resourceAddress;

            // Handle destination address selection
            const selectedAddress = selectedItems.find(s => s.type === 'address');
            if (selectedAddress) {
                setDestinationAddress(selectedAddress.resourceAddress);
            } else if (destinationAddress) {
                // Address was deselected — clear it
                const wasAddressPreSelected = accounts.some(acc => acc.address === destinationAddress);
                if (wasAddressPreSelected) {
                    setDestinationAddress('');
                }
            }

            // Diff-based logic for global assets (no groupId, no destAddress)
            const selectedAssetItems = selectedItems.filter(s => s.type !== 'address');
            const existingGlobalKeys = new Set(
                assetsRef.current
                    .filter(a => a.groupId === undefined && a.internalId !== 'default-xrd')
                    .map(a => a.nftId ? `${a.resourceAddress}-${a.nftId}` : a.resourceAddress)
            );

            // Items in selection but NOT in existing globals → add
            const toAdd = selectedAssetItems.filter(s => !existingGlobalKeys.has(assetKey(s)));

            // Items in existing globals but NOT in selection → remove
            const selectedKeys = new Set(selectedAssetItems.map(assetKey));
            const toRemoveKeys = new Set(
                [...existingGlobalKeys].filter(k => !selectedKeys.has(k))
            );

            // Apply asset diff (add new / remove deselected)
            if (toAdd.length > 0 || toRemoveKeys.size > 0) {
                setAssets(prev => {
                    let next = toRemoveKeys.size > 0
                        ? prev.filter(a => {
                            if (a.groupId !== undefined || a.internalId === 'default-xrd') return true;
                            const aKey = a.nftId ? `${a.resourceAddress}-${a.nftId}` : a.resourceAddress;
                            return !toRemoveKeys.has(aKey);
                        })
                        : prev;

                    if (toAdd.length > 0) {
                        const newAssets = toAdd.map(s => ({
                            internalId: Math.random().toString(36).substring(7),
                            type: (s.type === 'pool_unit' ? 'fungible' : s.type) as 'fungible' | 'non_fungible',
                            resourceAddress: s.resourceAddress,
                            symbol: s.symbol,
                            name: s.name,
                            iconUrl: s.iconUrl,
                            amount: '',
                            nftId: s.id,
                        }));
                        next = [...next, ...newAssets];
                    }

                    return next;
                });
            }

            // Create destination+XRD pairs from addressCount.
            // Always runs when addressCount > 0, even when assets were selected.
            if (addressCount > 0) {
                setAssets(prev => {
                    const pairs = Array.from({ length: addressCount }, () => ({
                        internalId: Math.random().toString(36).substring(7),
                        type: 'fungible' as const,
                        resourceAddress: xrdAddress,
                        symbol: 'XRD',
                        name: 'Radix',
                        amount: '',
                        destAddress: '',
                        groupId: Math.random().toString(36).substring(7),
                    }));
                    return [...prev, ...pairs];
                });
            }
        }

        setSelectedItems([]);
        setAddressCount(1);
        setPopupDestTarget(null);
        setPopupOpen(false);
    };

    const removeAsset = (id: string) => {
        setAssets(prev => prev.filter(a => a.internalId !== id));
    };

    const updateAmount = (id: string, val: string) => {
        setAssets(prev => prev.map(a => a.internalId === id ? { ...a, amount: val } : a));
    };

    const updateGroupDestAddress = (groupId: string, val: string) => {
        setAssets(prev => prev.map(a => a.groupId === groupId ? { ...a, destAddress: val } : a));
    };

    const handleSend = async () => {
        const hasAnyDest = assets.some(a => a.destAddress || destinationAddress);
        if (!hasAnyDest) {
            setError('No hay direcciones de destino configuradas.');
            return;
        }
        setError(null);
        setIsTransacting(true);

        try {
            const destGroups = new Map<string, { type: 'fungible' | 'non_fungible'; resourceAddress: string; amount?: number; nonFungibleLocalIds?: string[] }[]>();

            assets.forEach(a => {
                const effDest = a.destAddress || destinationAddress;
                if (!effDest) return;

                const item = a.type === 'non_fungible'
                    ? { type: 'non_fungible' as const, resourceAddress: a.resourceAddress, nonFungibleLocalIds: a.nftId ? [a.nftId] : [] }
                    : { type: 'fungible' as const, resourceAddress: a.resourceAddress, amount: parseFloat(a.amount || '0') };

                const existing = destGroups.get(effDest);
                if (existing) {
                    existing.push(item);
                } else {
                    destGroups.set(effDest, [item]);
                }
            });

            if (destGroups.size === 0) {
                setError('No hay direcciones de destino configuradas.');
                setIsTransacting(false);
                return;
            }

            const groups: TransferGroup[] = [];
            for (const [dest, items] of destGroups) {
                const validItems = items.filter(i => (i.type === 'fungible' && (i.amount || 0) > 0) || (i.type === 'non_fungible' && i.nonFungibleLocalIds && i.nonFungibleLocalIds.length > 0));
                if (validItems.length === 0) continue;
                groups.push({ toAccountAddress: dest, items: validItems });
            }

            if (groups.length === 0) {
                setError('No has ingresado ninguna cantidad válida a transferir.');
                setIsTransacting(false);
                return;
            }

            const manifest = buildMultiTransferManifest(accountAddress, groups);

            const toolkit = getOrCreateToolkit(activeNetworkId || RadixNetworkId.Mainnet);
            if (!toolkit) throw new Error('Radix Toolkit no inicializado');

            const result = await toolkit.walletApi.sendTransaction({
                transactionManifest: manifest,
                version: 1,
            });

            if (result.isErr()) {
                setError('Transacciones rechazadas o fallidas.');
            } else {
                setDestinationAddress('');
                setAssets([{
                    internalId: 'default-xrd',
                    type: 'fungible',
                    resourceAddress: xrdAddress,
                    symbol: 'XRD',
                    name: 'Radix',
                    amount: '',
                }]);
            }
        } catch (err: unknown) {
            setError((err as Error).message || 'Ocurrió un error al enviar la transacción.');
        } finally {
            setIsTransacting(false);
        }
    };

    const handleOpenPopup = (mode: PopupMode, assetId?: string, destTarget?: string) => {
        setPopupMode(mode);
        setPopupDestTarget(destTarget ?? null);
        if (mode === 'address' && destTarget === undefined) {
            setActiveTab('address');
        } else {
            setActiveTab('fungible');
        }
        setEditingAssetId(assetId ?? null);
        setSearchQuery('');
        setAddressCount(1);

        // For global address popup: initialize selection from already-added assets
        // so previously added items appear checked when reopening.
        // For per-dest popup: start empty — isItemSelected uses diff-based XOR
        // that derives selection from live group assets automatically.
        if (mode === 'address' && destTarget === undefined) {
            const existingSelection: SelectedAsset[] = assetsRef.current
                .filter(a => a.groupId === undefined && a.internalId !== 'default-xrd')
                .map(a => ({
                    type: a.type === 'fungible' ? 'fungible' as const : 'non_fungible' as const,
                    resourceAddress: a.resourceAddress,
                    symbol: a.symbol,
                    name: a.name,
                    iconUrl: a.iconUrl,
                    id: a.nftId,
                }));

            // Also include the current destination address as a selected address item
            if (destinationAddress) {
                const matchingAccount = accounts.find(acc => acc.address === destinationAddress);
                if (matchingAccount) {
                    existingSelection.push({
                        type: 'address',
                        resourceAddress: matchingAccount.address,
                        symbol: 'ADDR',
                        name: matchingAccount.label,
                    });
                }
            }

            setSelectedItems(existingSelection);
        } else {
            setSelectedItems([]);
        }

        setPopupOpen(true);
    };

    // Popup data helpers
    const query = searchQuery.toLowerCase();

    const availableAddresses = accounts.filter(a =>
        a.address !== accountAddress &&
        (a.label.toLowerCase().includes(query) || a.address.toLowerCase().includes(query))
    );

    const fungibles = (() => {
        if (!entityData?.fungible_resources?.items) return [];
        return entityData.fungible_resources.items.filter((f: ResourceItem) => {
            const name = getMetadataValue(f.explicit_metadata?.items, 'name') || 'Unknown';
            const symbol = getMetadataValue(f.explicit_metadata?.items, 'symbol') || 'Unknown';
            return name.toLowerCase().includes(query) || symbol.toLowerCase().includes(query);
        });
    })();

    const nonFungibles = (() => {
        if (!entityData?.non_fungible_resources?.items) return [];
        return entityData.non_fungible_resources.items.filter((nf: ResourceItem) => {
            const name = getMetadataValue(nf.explicit_metadata?.items, 'name') || 'Unknown NFT';
            return name.toLowerCase().includes(query);
        });
    })();

    const poolUnits = (() => {
        const ed = entityData as { pool_units?: { items?: ResourceItem[] } } | undefined;
        if (!ed?.pool_units?.items) return [];
        return ed.pool_units.items.filter((pu: ResourceItem) => {
            const name = getMetadataValue(pu.explicit_metadata?.items, 'name') || 'Pool Unit';
            return name.toLowerCase().includes(query);
        });
    })();

    const allTabs: { type: AssetType; label: string; count?: number }[] = [
        { type: 'address', label: 'Direcciones', count: availableAddresses.length },
        { type: 'fungible', label: 'Tokens', count: entityData?.fungible_resources?.items?.length || 0 },
        { type: 'non_fungible', label: 'NFTs', count: entityData?.non_fungible_resources?.items?.length || 0 },
        { type: 'pool_unit', label: 'Pools', count: (entityData as { pool_units?: { items?: unknown[] } } | undefined)?.pool_units?.items?.length || 0 },
    ];
    const tabs = (popupMode === 'asset' || popupDestTarget !== null) ? allTabs.filter(t => t.type !== 'address') : allTabs;

    const isAddressMode = popupMode === 'address';

    // Per-dest popup: derive selection state from live group assets
    const perDestInfo = popupDestTarget !== null ? (() => {
        const groupKeys = new Set(
            assets
                .filter(a => a.groupId === popupDestTarget)
                .map(a => a.nftId ? `${a.resourceAddress}-${a.nftId}` : a.resourceAddress)
        );
        let added = 0;
        let removed = 0;
        for (const s of selectedItems) {
            if (s.type === 'address') continue;
            const sk = s.id ? `${s.resourceAddress}-${s.id}` : s.resourceAddress;
            if (groupKeys.has(sk)) { removed++; }
            else { added++; }
        }
        return {
            hasAny: groupKeys.size > 0 || added > 0,
            count: groupKeys.size + added - removed,
        };
    })() : null;

    const hasSelectedAssets = perDestInfo?.hasAny ?? selectedItems.some(s => s.type !== 'address');
    const selectedCount = perDestInfo?.count ?? selectedItems.length;

    const renderAddressTab = () => {
        if (!isAddressMode || popupDestTarget !== null) return null;
        return (
            <>
                {/* Add destination input section */}
                <div className="flex items-center justify-between px-1 mb-2 border-b border-[var(--color-card-border)] pb-3">
                    <span className="text-xs text-[var(--color-text-main)] font-medium">{navT.wallet_add_dest_input || 'Añadir input dirección de destino'}</span>
                    <input
                        type="number"
                        min={0}
                        max={99}
                        value={addressCount}
                        onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '' || raw === '0') { setAddressCount(0); return; }
                            const num = parseInt(raw, 10);
                            if (!isNaN(num) && num >= 0) setAddressCount(num);
                        }}
                        className="w-14 text-center bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-1.5 px-1 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        title="Cantidad de inputs"
                    />
                </div>
                {/* Account list */}
                {availableAddresses.length === 0
                    ? <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">No se encontraron direcciones</div>
                    : availableAddresses.map(acc => {
                        const isAddrSelected = selectedItems.some(s => s.type === 'address' && s.resourceAddress === acc.address);
                        return (
                            <button
                                key={acc.address}
                                type="button"
                                onClick={() => {
                                    const addrItem: SelectedAsset = { type: 'address', resourceAddress: acc.address, symbol: 'ADDR', name: acc.label };
                                    if (isAddrSelected) {
                                        toggleSelectedItem(addrItem);
                                    } else {
                                        // Deselect other addresses, select this one
                                        setSelectedItems(prev => [...prev.filter(s => s.type !== 'address'), addrItem]);
                                    }
                                }}
                                className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg transition-colors group ${isAddrSelected ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30' : 'hover:bg-[var(--color-bg)]'
                                    }`}
                            >
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="font-semibold text-xs group-hover:text-[var(--color-primary)] transition-colors">{acc.label}</span>
                                    <span className="text-[10px] text-[var(--color-text-muted)] truncate">{acc.address}</span>
                                </div>
                                <div className={`size-4 rounded border flex items-center justify-center shrink-0 ml-2 transition-colors ${isAddrSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-card-border)]'
                                    }`}>
                                    {isAddrSelected && <Check className="size-3 text-white" strokeWidth={3} />}
                                </div>
                            </button>
                        );
                    })
                }
            </>
        );
    };

    const renderFungibleItems = () => (
        fungibles.length === 0
            ? <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">No se encontraron tokens</div>
            : fungibles.map((f: ResourceItem) => {
                const name = getMetadataValue(f.explicit_metadata?.items, 'name') || 'Unknown';
                const symbol = getValueOrLsu(f.explicit_metadata?.items, getMetadataValue(f.explicit_metadata?.items, 'symbol') || 'Unknown');
                const icon = getMetadataValue(f.explicit_metadata?.items, 'icon_url') || '';
                const item: SelectedAsset = { type: 'fungible', resourceAddress: f.resource_address, symbol, name, iconUrl: icon };
                const sel = isItemSelected(item);
                return (
                    <button
                        key={f.resource_address}
                        type="button"
                        onClick={() => {
                            if (isAddressMode) {
                                toggleSelectedItem(item);
                            } else {
                                handleAssetSelect(item);
                            }
                        }}
                        className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg transition-colors group ${sel ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30' : 'hover:bg-[var(--color-bg)]'
                            }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="size-7 rounded-full bg-[var(--color-card-border)] overflow-hidden shrink-0">
                                {icon ? <SafeImage src={icon} alt={name} fallbackName={name} className="w-full h-full object-cover" /> : <Coins className="size-3.5 m-auto mt-1.5 text-[var(--color-text-muted)]" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-xs group-hover:text-[var(--color-primary)] transition-colors truncate">{symbol}</span>
                                <span className="text-[10px] text-[var(--color-text-muted)] truncate">{name}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold shrink-0">{parseFloat(f.vaults?.items?.[0]?.amount || '0').toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            {isAddressMode && (
                                <div className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-card-border)]'
                                    }`}>
                                    {sel && <Check className="size-3 text-white" strokeWidth={3} />}
                                </div>
                            )}
                        </div>
                    </button>
                );
            })
    );

    const renderNftItems = () => (
        nonFungibles.length === 0
            ? <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">No se encontraron NFTs</div>
            : nonFungibles.flatMap((nf: ResourceItem) => {
                const name = getMetadataValue(nf.explicit_metadata?.items, 'name') || 'Unknown NFT';
                const icon = getMetadataValue(nf.explicit_metadata?.items, 'icon_url') || '';
                const vault = nf.vaults?.items?.[0];
                if (!vault || !vault.items) return [];
                return vault.items.map((id: string) => {
                    const item: SelectedAsset = { type: 'non_fungible', resourceAddress: nf.resource_address, symbol: 'NFT', name, iconUrl: icon, id };
                    const sel = isItemSelected(item);
                    return (
                        <button
                            key={`${nf.resource_address}-${id}`}
                            type="button"
                            onClick={() => {
                                if (isAddressMode) {
                                    toggleSelectedItem(item);
                                } else {
                                    handleAssetSelect(item);
                                }
                            }}
                            className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg transition-colors group ${sel ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30' : 'hover:bg-[var(--color-bg)]'
                                }`}
                        >
                            <div className="size-7 rounded-lg bg-[var(--color-card-border)] overflow-hidden shrink-0">
                                {icon ? <SafeImage src={icon} alt={name} fallbackName={name} className="w-full h-full object-cover" /> : <ImageIcon className="size-3.5 m-auto mt-1.5 text-[var(--color-text-muted)]" />}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="font-semibold text-xs group-hover:text-[var(--color-primary)] transition-colors truncate">{name}</span>
                                <span className="text-[9px] font-mono text-[var(--color-text-muted)] truncate">{id.length > 20 ? id.slice(0, 8) + '...' + id.slice(-8) : id}</span>
                            </div>
                            {isAddressMode && (
                                <div className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-card-border)]'
                                    }`}>
                                    {sel && <Check className="size-3 text-white" strokeWidth={3} />}
                                </div>
                            )}
                        </button>
                    );
                });
            })
    );

    const renderPoolUnitItems = () => (
        poolUnits.length === 0
            ? <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">No se encontraron Pool Units</div>
            : poolUnits.map((pu: ResourceItem) => {
                const name = getMetadataValue(pu.explicit_metadata?.items, 'name') || 'Pool Unit';
                const symbol = getMetadataValue(pu.explicit_metadata?.items, 'symbol') || 'POOL';
                const icon = getMetadataValue(pu.explicit_metadata?.items, 'icon_url') || '';
                const item: SelectedAsset = { type: 'pool_unit', resourceAddress: pu.resource_address, symbol, name, iconUrl: icon };
                const sel = isItemSelected(item);
                return (
                    <button
                        key={pu.resource_address}
                        type="button"
                        onClick={() => {
                            if (isAddressMode) {
                                toggleSelectedItem(item);
                            } else {
                                handleAssetSelect(item);
                            }
                        }}
                        className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg transition-colors group ${sel ? 'bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30' : 'hover:bg-[var(--color-bg)]'
                            }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="size-7 rounded-full bg-[var(--color-card-border)] overflow-hidden shrink-0">
                                {icon ? <SafeImage src={icon} alt={name} fallbackName={name} className="w-full h-full object-cover" /> : <Layers className="size-3.5 m-auto mt-1.5 text-[var(--color-text-muted)]" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-xs group-hover:text-[var(--color-primary)] transition-colors truncate">{symbol}</span>
                                <span className="text-[10px] text-[var(--color-text-muted)] truncate">{name}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold shrink-0">{parseFloat(pu.vaults?.items?.[0]?.amount || '0').toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            {isAddressMode && (
                                <div className={`size-4 rounded border flex items-center justify-center shrink-0 transition-colors ${sel ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-card-border)]'
                                    }`}>
                                    {sel && <Check className="size-3 text-white" strokeWidth={3} />}
                                </div>
                            )}
                        </div>
                    </button>
                );
            })
    );

    function getValueOrLsu(metadataItems: MetadataItem[] | undefined, fallback: string): string {
        return isLsuToken(metadataItems) ? 'LSU' : fallback;
    }

    return (
        <div ref={containerRef} className="flex flex-col gap-3 pb-2 relative">
            {/* Global dest tree */}
            <div className="flex flex-col">
                {/* Destination input + popup (wrapped together for popup positioning) */}
                <div className="relative">
                    {/* Destination Address Input with embedded + */}
                    <div className="relative z-10">
                        <input
                            type="text"
                            placeholder="Dirección de destino (account_...)"
                            value={destinationAddress}
                            onChange={(e) => setDestinationAddress(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-colors pr-16 border-[var(--color-border)] focus:border-[var(--color-primary)] bg-[var(--color-bg)] text-[var(--color-text-main)] placeholder-[var(--color-text-muted)]"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => handleOpenPopup('address')}
                                className="size-7 flex items-center justify-center rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all"
                                title="Seleccionar dirección"
                            >
                                <Plus className="size-3.5" strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    {/* Validation text below input */}
                    {!validatingAddress && isAddressValid === false && destinationAddress.length > 10 && (
                        <p className="text-[11px] text-red-400 mt-1.5 px-1">{navT.wallet_invalid_address || 'Dirección inválida'}</p>
                    )}
                    {validatingAddress && (
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5 px-1">{navT.wallet_validating || 'Validando...'}</p>
                    )}

                    {/* Asset Selection Popup (floating, right below destination input) */}
                    <AnimatePresence>
                        {popupOpen && (
                            <m.div
                                initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 8, scale: 0.97 }}
                                transition={{ duration: 0.15 }}
                                className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl overflow-hidden"
                            >
                                {/* Search */}
                                <div className="p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
                                        <input
                                            type="text"
                                            placeholder={popupMode === 'address' ? 'Buscar dirección...' : 'Buscar activo...'}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                        />
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="px-3 pt-3 flex gap-3 overflow-x-auto custom-scrollbar border-b border-[var(--color-card-border)]">
                                    {tabs.map(tab => (
                                        <button
                                            key={tab.type}
                                            type="button"
                                            onClick={() => setActiveTab(tab.type)}
                                            className={`pb-2 text-[10px] font-semibold tracking-wider uppercase transition-colors relative border-b-2 whitespace-nowrap ${activeTab === tab.type
                                                ? 'text-[var(--color-primary)] border-[var(--color-primary)]'
                                                : 'text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-main)]'
                                                }`}
                                        >
                                            {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                                        </button>
                                    ))}
                                </div>

                                {/* Content */}
                                <div className="p-2 max-h-56 overflow-y-auto custom-scrollbar">
                                    {isLoadingAssets ? (
                                        <div className="flex justify-center items-center h-20 text-[var(--color-text-muted)] text-xs">Cargando...</div>
                                    ) : (
                                        <div className="space-y-1">
                                            {activeTab === 'address' && renderAddressTab()}
                                            {activeTab === 'fungible' && renderFungibleItems()}
                                            {activeTab === 'non_fungible' && renderNftItems()}
                                            {activeTab === 'pool_unit' && renderPoolUnitItems()}
                                        </div>
                                    )}
                                </div>

                                {/* Confirm button (only in address mode with selections) */}
                                {isAddressMode && (popupDestTarget !== null ? hasSelectedAssets : (hasSelectedAssets || addressCount > 0)) && (
                                    <div className="p-3 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                                        <button
                                            type="button"
                                            onClick={handleConfirmSelection}
                                            className="w-full py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] hover:opacity-90 transition-opacity"
                                        >
                                            {popupDestTarget !== null
                                                ? `Agregar`
                                                : `Agregar${selectedCount > 0 ? ` (${selectedCount})` : ` (${addressCount})`}`
                                            }
                                        </button>
                                    </div>
                                )}
                            </m.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Global dest assets (without per-row destination) */}
                <div className="flex flex-col gap-2 mt-1.5">
                    {assets.filter(a => a.destAddress === undefined).map((asset, index) => {
                        const showRowActions = index > 0;
                        return (
                            <div key={asset.internalId} className="relative flex">
                                <div className="relative w-6 shrink-0">
                                    <div className="absolute left-1/2 -translate-x-1/2 top-[-36px] bottom-1/2 w-[2px] bg-[var(--color-card-border)]"></div>
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-[var(--color-card-border)]"></div>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 size-[7px] rounded-full bg-[var(--color-card-border)]"></div>
                                </div>
                                <div className="flex items-stretch flex-1">
                                    <div className="flex-1 min-w-0">
                                        {asset.type === 'non_fungible' ? (
                                            <div className="w-full bg-[var(--color-bg)]/50 border border-[var(--color-card-border)] border-r-0 rounded-l-xl py-2 pl-4 text-sm text-[var(--color-text-main)] opacity-70 font-mono h-[56px] flex items-center">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium">{asset.name}</span>
                                                    <span className="text-[11px] text-[var(--color-text-muted)] font-mono">{asset.nftId ? `${asset.nftId.slice(0, 16)}...${asset.nftId.slice(-8)}` : 'Sin ID'}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                placeholder="0.00"
                                                value={asset.amount}
                                                onChange={(e) => updateAmount(asset.internalId, e.target.value)}
                                                className="w-full bg-[var(--color-surface)] border border-[var(--color-card-border)] border-r-0 rounded-l-xl py-2.5 pl-4 text-sm text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50 transition-all font-mono h-[42px]"
                                            />
                                        )}
                                    </div>
                                    <div className={`flex items-center gap-0 ${asset.type === 'non_fungible' ? 'bg-[var(--color-bg)]/50' : 'bg-[var(--color-surface)]'} border-r border-y border-[var(--color-card-border)] rounded-r-xl ${asset.type === 'non_fungible' ? 'h-[56px]' : 'h-[42px]'} px-1.5 shrink-0`}>
                                        <button
                                            type="button"
                                            onClick={() => handleOpenPopup('asset', asset.internalId)}
                                            className="flex items-center gap-1.5 h-[28px] bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-lg px-2 hover:bg-[var(--color-bg)] transition-colors"
                                            title="Cambiar Activo"
                                        >
                                            {asset.iconUrl ? (
                                                <div className="size-4 rounded-full overflow-hidden shrink-0 bg-[var(--color-bg)]">
                                                    <SafeImage src={asset.iconUrl} alt={asset.symbol} fallbackName={asset.symbol} className="w-full h-full object-cover" />
                                                </div>
                                            ) : null}
                                            <span className="font-semibold text-[10px]">{asset.symbol}</span>
                                        </button>
                                        {showRowActions && (
                                            <button
                                                type="button"
                                                onClick={() => removeAsset(asset.internalId)}
                                                className="size-6 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-[var(--color-bg)] transition-colors"
                                            >
                                                <X className="size-3" strokeWidth={3} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Per-dest groups */}
            {(() => {
                const groups = new Map<string, AssetItem[]>();
                assets.filter(a => a.groupId !== undefined).forEach(a => {
                    const list = groups.get(a.groupId!) || [];
                    list.push(a);
                    groups.set(a.groupId!, list);
                });
                return [...groups.entries()].map(([groupId, items]) => {
                    const header = items[0];
                    return (
                        <div key={groupId} className="flex flex-col">
                            <div className="relative z-10">
                                <input
                                    type="text"
                                    placeholder="Destino (account_...)"
                                    value={header.destAddress || ''}
                                    onChange={(e) => updateGroupDestAddress(groupId, e.target.value)}
                                    className="w-full border rounded-lg px-2.5 py-2 text-xs focus:outline-none transition-colors border-[var(--color-border)] focus:border-[var(--color-primary)] bg-[var(--color-bg)] text-[var(--color-text-main)] placeholder-[var(--color-text-muted)]/50 font-mono"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleOpenPopup('address', undefined, groupId)}
                                        className="size-7 flex items-center justify-center rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all"
                                        title="Vincular activos"
                                    >
                                        <Plus className="size-3.5" strokeWidth={3} />
                                    </button>
                                </div>
                            </div>
                            {items.map((item) => (
                                <div key={item.internalId} className="relative flex items-stretch mt-1.5">
                                    <div className="relative w-6 shrink-0">
                                        <div className="absolute left-1/2 -translate-x-1/2 top-[-36px] bottom-1/2 w-[2px] bg-[var(--color-card-border)]"></div>
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-[var(--color-card-border)]"></div>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 size-[7px] rounded-full bg-[var(--color-card-border)]"></div>
                                    </div>
                                    <div className="flex items-stretch flex-1">
                                        <div className="flex-1 min-w-0">
                                            {item.type === 'non_fungible' ? (
                                                <div className="w-full bg-[var(--color-bg)]/50 border border-[var(--color-card-border)] border-r-0 rounded-l-xl py-2 pl-4 text-sm text-[var(--color-text-main)] opacity-70 font-mono h-[56px] flex items-center">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-medium">{item.name}</span>
                                                        <span className="text-[11px] text-[var(--color-text-muted)] font-mono">{item.nftId ? `${item.nftId.slice(0, 16)}...${item.nftId.slice(-8)}` : 'Sin ID'}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="any"
                                                    placeholder="0.00"
                                                    value={item.amount}
                                                    onChange={(e) => updateAmount(item.internalId, e.target.value)}
                                                    className="w-full bg-[var(--color-surface)] border border-[var(--color-card-border)] border-r-0 rounded-l-xl py-2.5 pl-4 text-sm text-[var(--color-text-main)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/50 transition-all font-mono h-[42px]"
                                                />
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-0 ${item.type === 'non_fungible' ? 'bg-[var(--color-bg)]/50' : 'bg-[var(--color-surface)]'} border-r border-y border-[var(--color-card-border)] rounded-r-xl ${item.type === 'non_fungible' ? 'h-[56px]' : 'h-[42px]'} px-1.5 shrink-0`}>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenPopup('asset', item.internalId)}
                                                className="flex items-center gap-1.5 h-[28px] bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-lg px-2 hover:bg-[var(--color-bg)] transition-colors"
                                                title="Cambiar Activo"
                                            >
                                                {item.iconUrl ? (
                                                    <div className="size-4 rounded-full overflow-hidden shrink-0 bg-[var(--color-bg)]">
                                                        <SafeImage src={item.iconUrl} alt={item.symbol} fallbackName={item.symbol} className="w-full h-full object-cover" />
                                                    </div>
                                                ) : null}
                                                <span className="font-semibold text-[10px]">{item.symbol}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeAsset(item.internalId)}
                                                className="size-6 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-[var(--color-bg)] transition-colors"
                                            >
                                                <X className="size-3" strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                });
            })()}

            <button
                type="button"
                onClick={handleSend}
                disabled={isTransacting || validatingAddress}
                className="w-full font-bold py-3 px-4 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] text-white flex justify-center items-center gap-2"
            >
                {isTransacting ? (
                    <>
                        <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Enviando...</span>
                    </>
                ) : (
                    <span>Enviar Transacción</span>
                )}
            </button>

            {error && (
                <div className="text-red-400 text-xs font-medium px-2 bg-red-400/10 py-2 rounded-lg border border-red-400/20">
                    {error}
                </div>
            )}
        </div>
    );
}
