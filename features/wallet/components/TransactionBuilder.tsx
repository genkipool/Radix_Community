'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Search, Check } from 'lucide-react';
import { m, AnimatePresence } from "motion/react";
import { useRadixWallet } from '@/features/wallet/hooks/useRadixWallet';
import { getOrCreateToolkit } from '@/features/wallet/lib/radix-toolkit';
import { RadixNetworkId } from '@/features/wallet/constants/network';
import { RADIX_TOKEN_ADDRESSES } from '@/features/wallet/constants/radix-addresses';
import { buildMultiTransferManifest, TransferGroup } from '@/features/wallet/lib/manifest-builders';
import { apiFetchEntityDetails, apiFetchTransactionDetails, apiFetchNonFungibleData } from '@/features/dashboard/services/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeImage } from '@/components/ui/SafeImage';
import { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';
import { invalidateAccountStakingData } from '@/features/dashboard/utils/cacheInvalidation';
import { dashboardKeys } from '@/features/dashboard/utils/entityCache';

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
    claimAmount?: string;
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
            total_count?: number;
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
    claimAmount?: string;
}

function getMetadataValue(items: MetadataItem[] | undefined, key: string): string | undefined {
    return items?.find((m: MetadataItem) => m.key === key)?.value?.typed?.value;
}

function isLsuToken(metadataItems: MetadataItem[] | undefined): boolean {
    return !!metadataItems?.some((m: MetadataItem) => m.key === 'validator');
}

const transactionStateCache = new Map<string, { destinationAddress: string; assets: AssetItem[] }>();

export function TransactionBuilder({ accountAddress, t }: TransactionBuilderProps) {
    const navT = (t?.nav || {}) as Record<string, string>;
    const { activeNetworkId, activeNetwork, accounts } = useRadixWallet();
    const network = activeNetwork || 'mainnet';
    const xrdAddress = RADIX_TOKEN_ADDRESSES[activeNetworkId || RadixNetworkId.Mainnet].XRD;

    const { data: validatorsData } = useValidatorsQuery(network);

    const cacheKey = `${network}-${accountAddress}`;
    const cachedState = transactionStateCache.get(cacheKey);

    const [destinationAddress, setDestinationAddress] = useState(cachedState?.destinationAddress ?? '');
    const [addressValidity, setAddressValidity] = useState<Record<string, boolean>>({});

    const [assets, setAssets] = useState<AssetItem[]>(cachedState?.assets ?? [
        {
            internalId: 'default-xrd',
            type: 'fungible',
            resourceAddress: xrdAddress,
            symbol: 'XRD',
            name: 'Radix',
            amount: '',
        }
    ]);

    useEffect(() => {
        transactionStateCache.set(cacheKey, { destinationAddress, assets });
    }, [cacheKey, destinationAddress, assets]);

    const [popupOpen, setPopupOpen] = useState(false);
    const [popupMode, setPopupMode] = useState<PopupMode>('asset');
    const [editingAssetId, setEditingAssetId] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<AssetType>('fungible');

    const [isTransacting, setIsTransacting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const queryClient = useQueryClient();

    // Focus state for address formatting
    const [isDestFocused, setIsDestFocused] = useState(false);
    const [focusedGroupId, setFocusedGroupId] = useState<string | null>(null);

    // Multi-selection state (only used in 'address' mode)
    const [selectedItems, setSelectedItems] = useState<SelectedAsset[]>([]);
    const [addressCount, setAddressCount] = useState(0);
    const [popupDestTarget, setPopupDestTarget] = useState<string | null>(null);

    const formatAddress = (addr: string, isFocused: boolean) => {
        if (isFocused || !addr || addr.length <= 32) return addr;
        return `${addr.slice(0, 24)}...${addr.slice(-8)}`;
    };

    const assetsRef = useRef(assets);

    useEffect(() => {
        assetsRef.current = assets;
    }, [assets]);

    const containerRef = useRef<HTMLDivElement>(null);

    const [popupDirection, setPopupDirection] = useState<'down' | 'up'>('down');


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



    // Validate all destination addresses (no loading state to avoid flashing "Validando...")
    useEffect(() => {
        const timer = setTimeout(async () => {
            const allAddresses = Array.from(new Set([destinationAddress, ...assets.map(a => a.destAddress)].filter(Boolean) as string[]));
            const newValidity: Record<string, boolean> = {};
            
            for (const addr of allAddresses) {
                if (addr.length < 10) continue;
                try {
                    if (addr.startsWith('account_')) {
                        await apiFetchEntityDetails(addr, network);
                        newValidity[addr] = true;
                    } else {
                        newValidity[addr] = false;
                    }
                } catch (_err) {
                    newValidity[addr] = false;
                }
            }
            setAddressValidity(prev => ({ ...prev, ...newValidity }));
        }, 800);
        return () => clearTimeout(timer);
    }, [destinationAddress, assets, network]);

    // Fetch entity data for popup asset selection and initial rendering
    const { data: entityData, isLoading: isLoadingAssets } = useQuery({
        queryKey: dashboardKeys.entities.detail(accountAddress, network),
        queryFn: () => apiFetchEntityDetails(accountAddress, network),
    });

    // Derive XRD icon URL from entity data at render time (avoid cascading setState in effects)
    const xrdIconUrl = (() => {
        if (!entityData?.fungible_resources?.items) return '';
        const xrdResource = entityData.fungible_resources.items.find(
            (f: ResourceItem) => f.resource_address === xrdAddress
        );
        if (!xrdResource) return '';
        return getMetadataValue(xrdResource.explicit_metadata?.items, 'icon_url') || '';
    })();

    const hasAnyTokens = !!entityData && (
        (entityData.fungible_resources?.items?.length || 0) > 0 ||
        (entityData.non_fungible_resources?.items?.length || 0) > 0
    );

    const isWalletEmpty = !!entityData && !hasAnyTokens;

    // Default asset replacement logic when data is loaded
    useEffect(() => {
        if (!entityData || assets.length !== 1 || assets[0].internalId !== 'default-xrd' || assets[0].amount !== '') return;

        let timeoutId: ReturnType<typeof setTimeout>;

        const xrdResource = entityData.fungible_resources?.items?.find((f: ResourceItem) => f.resource_address === xrdAddress);
        if (!xrdResource && hasAnyTokens) {
            // No XRD found. Pick the first available fungible or non-fungible.
            const firstFungible = entityData.fungible_resources?.items?.[0];
            if (firstFungible) {
                timeoutId = setTimeout(() => {
                    setAssets([{
                        internalId: 'default-xrd', // Keep same internalId to not break other assumptions
                        type: 'fungible',
                        resourceAddress: firstFungible.resource_address,
                        symbol: getMetadataValue(firstFungible.explicit_metadata?.items, 'symbol') || 'TOKEN',
                        name: getMetadataValue(firstFungible.explicit_metadata?.items, 'name') || 'Token',
                        iconUrl: getMetadataValue(firstFungible.explicit_metadata?.items, 'icon_url') || '',
                        amount: '',
                    }]);
                }, 0);
            } else {
                const firstNonFungible = entityData.non_fungible_resources?.items?.[0];
                if (firstNonFungible) {
                    const firstId = firstNonFungible.vaults?.items?.[0]?.items?.[0];
                    timeoutId = setTimeout(() => {
                        setAssets([{
                            internalId: 'default-xrd', // Keep same internalId
                            type: 'non_fungible',
                            resourceAddress: firstNonFungible.resource_address,
                            symbol: getMetadataValue(firstNonFungible.explicit_metadata?.items, 'symbol') || 'NFT',
                            name: getMetadataValue(firstNonFungible.explicit_metadata?.items, 'name') || 'NFT',
                            iconUrl: getMetadataValue(firstNonFungible.explicit_metadata?.items, 'icon_url') || '',
                            amount: '',
                            nftId: firstId,
                        }]);
                    }, 0);
                }
            }
        }
        
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [entityData, xrdAddress, assets, hasAnyTokens]);

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
                claimAmount: selected.claimAmount,
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
                claimAmount: selected.claimAmount,
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
            if (item.type === 'address') {
                const groupExisting = assets.filter(a => a.groupId === popupDestTarget);
                const currentGroupDest = groupExisting.length > 0 ? groupExisting[0].destAddress : '';
                const isCurrent = currentGroupDest === item.resourceAddress;
                return isCurrent ? !inSelected : inSelected;
            }

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
                assetsRef.current.reduce<string[]>((acc, a) => {
                    if (a.groupId === popupDestTarget) {
                        acc.push(a.nftId ? `${a.resourceAddress}-${a.nftId}` : a.resourceAddress);
                    }
                    return acc;
                }, [])
            );

            // Items user toggled ON that are NOT already in the group → add
            const added = selectedItems.filter(s => s.type !== 'address' && !initialGroupKeys.has(assetKey(s)));

            // Items user toggled OFF that ARE in the group → remove
            const removedKeys = new Set(
                selectedItems.reduce<string[]>((acc, s) => {
                    if (s.type !== 'address' && initialGroupKeys.has(assetKey(s))) {
                        acc.push(assetKey(s));
                    }
                    return acc;
                }, [])
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

            const addressDelta = selectedItems.filter(s => s.type === 'address');
            if (addressDelta.length > 0) {
                const groupExisting = assetsRef.current.filter(a => a.groupId === popupDestTarget);
                const currentGroupDest = groupExisting.length > 0 ? groupExisting[0].destAddress : '';
                const toggledOn = addressDelta.filter(s => s.resourceAddress !== currentGroupDest);
                
                let nextGroupDest = currentGroupDest;
                if (toggledOn.length > 0) {
                    nextGroupDest = toggledOn[toggledOn.length - 1].resourceAddress;
                } else if (addressDelta.some(s => s.resourceAddress === currentGroupDest)) {
                    nextGroupDest = '';
                }

                if (nextGroupDest !== currentGroupDest) {
                    setAssets(prev => prev.map(a => a.groupId === popupDestTarget ? { ...a, destAddress: nextGroupDest } : a));
                }
            }

            if (addressCount > 0) {
                setAssets(prev => {
                    const pairs = Array.from({ length: addressCount }, () => ({
                        internalId: Math.random().toString(36).substring(7),
                        type: 'fungible' as const,
                        resourceAddress: xrdAddress,
                        symbol: 'XRD',
                        name: 'Radix',
                        iconUrl: xrdIconUrl,
                        amount: '',
                        destAddress: '',
                        groupId: Math.random().toString(36).substring(7),
                    }));
                    return [...prev, ...pairs];
                });
            }
        } else {
            const assetKey = (s: { resourceAddress: string; id?: string }) => s.id ? `${s.resourceAddress}-${s.id}` : s.resourceAddress;

            // --- 1. Identify selected addresses vs existing addresses ---
            const selectedAddresses = selectedItems.reduce<string[]>((acc, s) => {
                if (s.type === 'address') acc.push(s.resourceAddress);
                return acc;
            }, []);
            const formAddresses = [
                destinationAddress,
                ...assetsRef.current.map(a => a.destAddress).filter(Boolean)
            ].filter((addr): addr is string => Boolean(addr && accounts.some(acc => acc.address === addr))); // Only consider known accounts

            const toAddAddrs = selectedAddresses.filter(addr => !formAddresses.includes(addr));
            const toRemoveAddrs = formAddresses.filter(addr => !selectedAddresses.includes(addr));

            // --- 2. Process removals and additions for destinationAddress state ---
            let nextDestAddr = destinationAddress;
            if (toRemoveAddrs.includes(destinationAddress)) {
                nextDestAddr = '';
                toRemoveAddrs.splice(toRemoveAddrs.indexOf(destinationAddress), 1);
            }
            if (nextDestAddr === '' && toAddAddrs.length > 0) {
                nextDestAddr = toAddAddrs.shift()!;
            }
            setDestinationAddress(nextDestAddr);

            // --- 3. Diff-based logic for global assets ---
            const selectedAssetItems = selectedItems.filter(s => s.type !== 'address');
            const existingGlobalKeys = new Set(
                assetsRef.current.reduce<string[]>((acc, a) => {
                    if (a.groupId === undefined) acc.push(a.nftId ? `${a.resourceAddress}-${a.nftId}` : a.resourceAddress);
                    return acc;
                }, [])
            );

            const toAddAssets = selectedAssetItems.filter(s => !existingGlobalKeys.has(assetKey(s)));
            const selectedKeys = new Set(selectedAssetItems.map(assetKey));
            const toRemoveKeys = new Set([...existingGlobalKeys].filter(k => !selectedKeys.has(k)));

            // --- 4. Apply changes to assets (groups and globals) ---
            setAssets(prev => {
                let next = [...prev];

                // Remove deselected global assets
                if (toRemoveKeys.size > 0) {
                    next = next.filter(a => {
                        if (a.groupId !== undefined) return true;
                        const aKey = a.nftId ? `${a.resourceAddress}-${a.nftId}` : a.resourceAddress;
                        return !toRemoveKeys.has(aKey);
                    });
                }

                // Add new global assets
                if (toAddAssets.length > 0) {
                    const newAssets = toAddAssets.map(s => ({
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

                // Process removed addresses (clear group destAddress)
                for (const addr of toRemoveAddrs) {
                    const groupItemIndex = next.findIndex(a => a.destAddress === addr);
                    if (groupItemIndex !== -1) {
                        const groupId = next[groupItemIndex].groupId;
                        next = next.map(a => a.groupId === groupId ? { ...a, destAddress: '' } : a);
                    }
                }

                // Process added addresses (fill empty groups or create new)
                for (const addr of toAddAddrs) {
                    const emptyGroupIds = new Set(
                        next.reduce<string[]>((acc, a) => {
                            if (a.groupId !== undefined && !a.destAddress) acc.push(a.groupId);
                            return acc;
                        }, [])
                    );
                    if (emptyGroupIds.size > 0) {
                        const groupIdToFill = Array.from(emptyGroupIds)[0];
                        next = next.map(a => a.groupId === groupIdToFill ? { ...a, destAddress: addr } : a);
                    } else {
                        next.push({
                            internalId: Math.random().toString(36).substring(7),
                            type: 'fungible' as const,
                            resourceAddress: xrdAddress,
                            symbol: 'XRD',
                            name: 'Radix',
                            iconUrl: xrdIconUrl,
                            amount: '',
                            destAddress: addr,
                            groupId: Math.random().toString(36).substring(7),
                        });
                    }
                }

                // Handle empty address inputs count
                if (addressCount > 0) {
                    const pairs = Array.from({ length: addressCount }, () => ({
                        internalId: Math.random().toString(36).substring(7),
                        type: 'fungible' as const,
                        resourceAddress: xrdAddress,
                        symbol: 'XRD',
                        name: 'Radix',
                        iconUrl: xrdIconUrl,
                        amount: '',
                        destAddress: '',
                        groupId: Math.random().toString(36).substring(7),
                    }));
                    next = [...next, ...pairs];
                }

                return next;
            });
        }

        setSelectedItems([]);
        setAddressCount(0);
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
            if (!toolkit) {
                setError('Radix Toolkit no inicializado');
                setIsTransacting(false);
                return;
            }

            const result = await toolkit.walletApi.sendTransaction({
                transactionManifest: manifest,
                version: 1,
            });

            if (result.isErr()) {
                setError('Transacciones rechazadas o fallidas.');
                setIsTransacting(false);
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

                // Polling logic to wait for transaction to be committed before invalidating cache
                const hash = result.value.transactionIntentHash;
                const netName = activeNetworkId === RadixNetworkId.Mainnet ? 'mainnet' : 'stokenet';
                const maxAttempts = 15;

                const pollOnce = async (attempt: number) => {
                    if (attempt > maxAttempts) {
                        invalidateAccountStakingData(queryClient, accountAddress, netName);
                        setIsTransacting(false);
                        return;
                    }
                    try {
                        const details = await apiFetchTransactionDetails(hash, netName);
                        if (details && (details.transaction_status === 'CommittedSuccess' || details.transaction_status === 'Committed')) {
                            // Wait 2 seconds for Gateway to sync new ledger state before refetching
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            for (const acc of accounts || []) {
                                try {
                                    await apiFetchEntityDetails(acc.address, netName, true);
                                    invalidateAccountStakingData(queryClient, acc.address, netName);
                                } catch (e) {
                                    console.error('Failed to pre-fetch entity details after transaction for', acc.address, e);
                                }
                            }
                            setIsTransacting(false);
                            return;
                        } else if (details && details.transaction_status === 'CommittedFailure') {
                            setError('Transacción fallida.');
                            setIsTransacting(false);
                            return;
                        } else if (details && details.transaction_status === 'Rejected') {
                            setError('Transacción rechazada.');
                            setIsTransacting(false);
                            return;
                        }
                    } catch (err) {
                        console.error('Error polling transaction', err);
                    }
                    setTimeout(() => pollOnce(attempt + 1), 2000);
                };
                pollOnce(1);
            }
        } catch (err: unknown) {
            setError((err as Error).message || 'Ocurrió un error al enviar la transacción.');
            setIsTransacting(false);
        }
    };

    const handleOpenPopup = (mode: PopupMode, assetId?: string, destTarget?: string, triggerElement?: HTMLElement) => {
        const targetDest = destTarget ?? null;
        const targetAsset = assetId ?? null;

        if (popupOpen && popupMode === mode && popupDestTarget === targetDest && editingAssetId === targetAsset) {
            setPopupOpen(false);
            setPopupDestTarget(null);
            setEditingAssetId(null);

            return;
        }

        setPopupMode(mode);
        setPopupDestTarget(targetDest);

        if (mode === 'address') {
            setActiveTab('address');
        } else {
            setActiveTab('fungible');
        }
        setEditingAssetId(targetAsset);
        setSearchQuery('');
        setAddressCount(0);

        const el = triggerElement;
        if (el) {
            const rect = el.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            if (spaceBelow < 400 && spaceAbove > spaceBelow) {
                setPopupDirection('up');
            } else {
                setPopupDirection('down');
            }
        }

        // For global address popup: initialize selection from already-added assets
        // so previously added items appear checked when reopening.
        // For per-dest popup: start empty — isItemSelected uses diff-based XOR
        // that derives selection from live group assets automatically.
        if (mode === 'address' && destTarget === undefined) {
            const existingSelection: SelectedAsset[] = assets
                .filter(a => a.groupId === undefined)
                .map(a => ({
                    type: a.type === 'fungible' ? 'fungible' as const : 'non_fungible' as const,
                    resourceAddress: a.resourceAddress,
                    symbol: a.symbol,
                    name: a.name,
                    iconUrl: a.iconUrl,
                    id: a.nftId,
                }));

            // Also include all current destination addresses as selected address items
            const allDestAddresses = new Set([destinationAddress, ...assets.map(a => a.destAddress)].filter(Boolean));
            allDestAddresses.forEach(addr => {
                const matchingAccount = accounts.find(acc => acc.address === addr);
                if (matchingAccount) {
                    existingSelection.push({
                        type: 'address',
                        resourceAddress: matchingAccount.address,
                        symbol: 'ADDR',
                        name: matchingAccount.label,
                    });
                }
            });

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

    const hasAvailableBalance = (resource: ResourceItem) => {
        if (!resource.vaults?.items || resource.vaults.items.length === 0) return false;
        let totalAmount = 0;
        resource.vaults.items.forEach(v => {
            if (v.amount) {
                totalAmount += parseFloat(v.amount);
            } else if (v.total_count) {
                totalAmount += v.total_count;
            } else if (v.items && Array.isArray(v.items)) {
                totalAmount += v.items.length;
            }
        });
        return totalAmount > 0;
    };

    const fungibles = (() => {
        if (!entityData?.fungible_resources?.items) return [];
        return entityData.fungible_resources.items.filter((f: ResourceItem) => {
            if (!hasAvailableBalance(f)) return false;
            const name = getMetadataValue(f.explicit_metadata?.items, 'name') || 'Unknown';
            const symbol = getMetadataValue(f.explicit_metadata?.items, 'symbol') || 'Unknown';
            return name.toLowerCase().includes(query) || symbol.toLowerCase().includes(query);
        });
    })();

    const nonFungibles = (() => {
        if (!entityData?.non_fungible_resources?.items) return [];
        return entityData.non_fungible_resources.items.filter((nf: ResourceItem) => {
            if (!hasAvailableBalance(nf)) return false;

            const rawName = getMetadataValue(nf.explicit_metadata?.items, 'name') || 'Unknown NFT';
            const valAddrFromMeta = getMetadataValue(nf.explicit_metadata?.items, 'validator');
            const isClaim = !!nf.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'claim_nft') || !!valAddrFromMeta || !!validatorsData?.validators.find(v => v.claimTokenResourceAddress === nf.resource_address);
            const isOwnerBadgeCollection = rawName.toLowerCase().includes('owner badge');

            let searchableText = rawName.toLowerCase();

            if (isClaim) {
                const valByClaim = validatorsData?.validators.find(v => v.claimTokenResourceAddress === nf.resource_address);
                const fallbackVal = valAddrFromMeta ? validatorsData?.validators.find(v => v.address === valAddrFromMeta) : undefined;
                const finalValName = valByClaim?.name || fallbackVal?.name;
                if (finalValName) searchableText += ` ${finalValName.toLowerCase()}`;
            } else if (isOwnerBadgeCollection) {
                const vault = nf.vaults?.items?.[0];
                if (vault?.items) {
                    vault.items.forEach(id => {
                        const valByOwnerBadge = validatorsData?.validators.find(v => v.ownerBadge === id);
                        if (valByOwnerBadge) searchableText += ` ${valByOwnerBadge.name.toLowerCase()}`;
                    });
                }
            }

            return searchableText.includes(query);
        });
    })();

    const poolUnits = (() => {
        const ed = entityData as { pool_units?: { items?: ResourceItem[] } } | undefined;
        if (!ed?.pool_units?.items) return [];
        return ed.pool_units.items.filter((pu: ResourceItem) => {
            if (!hasAvailableBalance(pu)) return false;
            const name = getMetadataValue(pu.explicit_metadata?.items, 'name') || 'Pool Unit';
            return name.toLowerCase().includes(query);
        });
    })();

    const getIndividualNftCount = () => {
        let count = 0;
        if (!entityData?.non_fungible_resources?.items) return 0;
        entityData.non_fungible_resources.items.forEach((nf: ResourceItem) => {
            if (!hasAvailableBalance(nf)) return;
            if (nf.vaults?.items && nf.vaults.items.length > 0) {
                nf.vaults.items.forEach(v => {
                    if (v.items && Array.isArray(v.items)) {
                        count += v.items.length;
                    } else if (v.total_count) {
                        count += v.total_count;
                    }
                });
            }
        });
        return count;
    };

    const allTabs: { type: AssetType; label: string; count?: number }[] = [
        { type: 'address', label: 'Direcciones', count: availableAddresses.length },
        { type: 'fungible', label: 'Tokens', count: entityData?.fungible_resources?.items?.filter(hasAvailableBalance).length || 0 },
        { type: 'non_fungible', label: 'NFTs', count: getIndividualNftCount() },
        { type: 'pool_unit', label: 'Pools', count: ((entityData as { pool_units?: { items?: ResourceItem[] } } | undefined)?.pool_units?.items?.filter(hasAvailableBalance).length) || 0 },
    ];
    const tabs = popupMode === 'asset' ? allTabs.filter(t => t.type !== 'address') : allTabs;

    const getAvailableBalance = (resourceAddress: string) => {
        let initialAmount = 0;
        
        const f = entityData?.fungible_resources?.items?.find((i) => i.resource_address === resourceAddress) as unknown as ResourceItem | undefined;
        if (f && f.vaults?.items) {
            f.vaults.items.forEach(v => {
                if (v.amount) initialAmount += parseFloat(v.amount);
            });
        } else {
            const ed = entityData as { pool_units?: { items?: ResourceItem[] } } | undefined;
            const pu = ed?.pool_units?.items?.find((i) => i.resource_address === resourceAddress) as unknown as ResourceItem | undefined;
            if (pu && pu.vaults?.items) {
                pu.vaults.items.forEach(v => {
                    if (v.amount) initialAmount += parseFloat(v.amount);
                });
            }
        }

        let usedAmount = 0;
        assets.forEach(a => {
            if ((a.type === 'fungible' || a.type === 'pool_unit') && a.resourceAddress === resourceAddress) {
                const amt = parseFloat(a.amount || '0');
                if (!isNaN(amt)) {
                    usedAmount += amt;
                }
            }
        });

        const available = initialAmount - usedAmount;
        return available;
    };

    const isAddressMode = popupMode === 'address';

    const renderAddressTab = () => {
        if (!isAddressMode) return null;

        const inputAddresses = new Map<string | null, string>();
        if (destinationAddress) inputAddresses.set(null, destinationAddress);
        assets.forEach(a => {
            if (a.groupId && a.destAddress) {
                inputAddresses.set(a.groupId, a.destAddress);
            }
        });

        return (
            <>
                {/* Add destination input section */}
                <div className="flex items-end justify-between px-1 mb-2 border-b border-[var(--color-card-border)] pb-3">
                    <span className="text-xs text-[var(--color-text-main)] font-medium mb-1">{navT.wallet_add_dest_input || 'Añadir input dirección de destino'}</span>
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
                        // eslint-disable-next-line react-hooks/refs
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleConfirmSelection();
                            }
                        }}
                        className="w-14 h-8 text-center bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg px-1 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        title="Cantidad de inputs"
                    />
                </div>
                {/* Account list */}
                {availableAddresses.length === 0
                    ? <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">No se encontraron direcciones</div>
                    : availableAddresses.map(acc => {
                        const addr = acc.address;
                        
                        let isUsedByOther = false;
                        let isUsedByCurrent = false;

                        for (const [groupId, destAddr] of inputAddresses.entries()) {
                            if (destAddr === addr) {
                                if (groupId === popupDestTarget) {
                                    isUsedByCurrent = true;
                                } else {
                                    isUsedByOther = true;
                                }
                            }
                        }

                        const inSelected = selectedItems.some(s => s.type === 'address' && s.resourceAddress === addr);

                        let isAddrSelectedVisually = false;
                        let isDisabled = false;

                        if (popupDestTarget !== null) {
                            if (isUsedByOther) {
                                isAddrSelectedVisually = true;
                                isDisabled = true;
                            } else if (isUsedByCurrent) {
                                isAddrSelectedVisually = !inSelected;
                                isDisabled = false;
                            } else {
                                isAddrSelectedVisually = inSelected;
                                isDisabled = false;
                            }
                        } else {
                            if (isUsedByOther) {
                                isAddrSelectedVisually = true;
                                isDisabled = true;
                            } else {
                                isAddrSelectedVisually = inSelected;
                                isDisabled = false;
                            }
                        }

                        return (
                            <button
                                key={acc.address}
                                type="button"
                                disabled={isDisabled}
                                onClick={() => {
                                    if (isDisabled) return;
                                    const addrItem: SelectedAsset = { type: 'address', resourceAddress: acc.address, symbol: 'ADDR', name: acc.label };
                                    toggleSelectedItem(addrItem);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (!isDisabled) {
                                            // eslint-disable-next-line react-hooks/refs
                                            handleConfirmSelection();
                                        }
                                    }
                                }}
                                className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg transition-colors group ${
                                    isAddrSelectedVisually 
                                        ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' 
                                        : 'hover:bg-[var(--color-bg)]'
                                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className={`text-xs transition-colors ${isAddrSelectedVisually && !isDisabled ? '' : isDisabled ? 'opacity-80' : 'font-semibold group-hover:text-[var(--color-primary)]'}`}>{acc.label}</span>
                                    <span className={`text-[10px] truncate ${isAddrSelectedVisually && !isDisabled ? 'text-[var(--color-primary)]/80 font-normal' : isDisabled ? 'opacity-60' : 'text-[var(--color-text-muted)]'}`}>{acc.address}</span>
                                </div>
                                {isAddrSelectedVisually && <Check className={`size-4 shrink-0 ml-2 ${isDisabled ? 'opacity-50' : ''}`} strokeWidth={2} />}
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
                let symbol = getMetadataValue(f.explicit_metadata?.items, 'symbol') || 'Unknown';

                if (isLsuToken(f.explicit_metadata?.items)) {
                    const valAddr = getMetadataValue(f.explicit_metadata?.items, 'validator');
                    const valName = validatorsData?.validators?.find(v => v.address === valAddr)?.name;
                    symbol = valName ? `${valName} LSU` : 'LSU';
                }

                const icon = getMetadataValue(f.explicit_metadata?.items, 'icon_url') || '';
                const item: SelectedAsset = { type: 'fungible', resourceAddress: f.resource_address, symbol, name, iconUrl: icon };
                
                let sel = isAddressMode ? selectedItems.some(s => s.type === 'fungible' && s.resourceAddress === f.resource_address) : isItemSelected(item);
                const liveAmount = getAvailableBalance(f.resource_address);
                const isDisabled = liveAmount <= 0 && !sel;

                return (
                    <button
                        key={f.resource_address}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                            if (isDisabled) return;
                            if (isAddressMode) {
                                toggleSelectedItem(item);
                            } else {
                                handleAssetSelect(item);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (isDisabled) return;
                                if (isAddressMode) {
                                    // eslint-disable-next-line react-hooks/refs
                                    handleConfirmSelection();
                                } else {
                                    handleAssetSelect(item);
                                }
                            }
                        }}
                        className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg transition-colors group ${sel && !isDisabled ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-bg)]'
                            }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="size-7 rounded-full bg-[var(--color-card-border)] overflow-hidden shrink-0">
                                <SafeImage src={icon} alt={name} fallbackName={name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className={`text-xs transition-colors truncate ${sel && !isDisabled ? '' : isDisabled ? 'opacity-80' : 'font-semibold group-hover:text-[var(--color-primary)]'}`}>{symbol}</span>
                                <span className={`text-[10px] truncate ${sel && !isDisabled ? 'text-[var(--color-primary)]/80 font-normal' : isDisabled ? 'opacity-60' : 'text-[var(--color-text-muted)]'}`}>{name}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono shrink-0 ${sel && !isDisabled ? '' : isDisabled ? 'opacity-60' : 'font-bold'}`}>{liveAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            {isAddressMode && sel && <Check className={`size-4 shrink-0 ml-2 ${isDisabled ? 'opacity-50' : ''}`} strokeWidth={2} />}
                        </div>
                    </button>
                );
            })
    );

    const [claimAmounts, setClaimAmounts] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!entityData?.non_fungible_resources?.items) return;

        const fetchClaims = async () => {
            const newAmounts = { ...claimAmounts };
            let hasChanges = false;

            for (const nf of entityData.non_fungible_resources!.items!) {
                const valAddrFromMeta = getMetadataValue(nf.explicit_metadata?.items, 'validator');
                const isClaim = !!nf.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'claim_nft') || !!valAddrFromMeta || !!validatorsData?.validators.find(v => v.claimTokenResourceAddress === nf.resource_address);

                if (isClaim && nf.vaults?.items?.[0]?.items) {
                    const idsToFetch = nf.vaults.items[0].items.filter(id => !newAmounts[`${nf.resource_address}-${id}`]);
                    if (idsToFetch.length > 0) {
                        try {
                            const nftData = await apiFetchNonFungibleData(nf.resource_address, idsToFetch, network);
                            
                            type NftField = { field_name: string; value: string };
                            type NftPayload = { programmatic_json?: { fields?: NftField[] } };
                            type NftResponseItem = { non_fungible_id?: string; details?: NftPayload; data?: NftPayload };

                            (nftData as NftResponseItem[]).forEach((item) => {
                                const id = item.non_fungible_id;
                                const data = item.details || item.data;
                                const amountRaw = data?.programmatic_json?.fields?.find((f: NftField) => f.field_name === 'claim_amount')?.value;
                                if (id && amountRaw) {
                                    newAmounts[`${nf.resource_address}-${id}`] = parseFloat(amountRaw).toLocaleString(undefined, { maximumFractionDigits: 4 });
                                    hasChanges = true;
                                }
                            });
                        } catch (e) {
                            console.error('Error fetching claim amounts', e);
                        }
                    }
                }
            }

            if (hasChanges) {
                setClaimAmounts(newAmounts);
            }
        };

        fetchClaims();
    }, [entityData, network, validatorsData, claimAmounts]);

    const renderNftItems = () => {
        if (nonFungibles.length === 0) {
            return <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">No se encontraron NFTs</div>;
        }

        const nftOwners = new Map<string, string | null>();
        assets.forEach(a => {
            if (a.type === 'non_fungible' && a.nftId) {
                const key = `${a.resourceAddress}-${a.nftId}`;
                nftOwners.set(key, a.groupId ?? null);
            }
        });

        let currentOwner: string | null | undefined = undefined;
        if (isAddressMode) {
            currentOwner = popupDestTarget;
        } else if (editingAssetId) {
            const editingAsset = assets.find(a => a.internalId === editingAssetId);
            if (editingAsset) {
                currentOwner = editingAsset.groupId ?? null;
            }
        }

        return nonFungibles.flatMap((nf: ResourceItem) => {
            const baseName = getMetadataValue(nf.explicit_metadata?.items, 'name') || 'Unknown NFT';
            const icon = getMetadataValue(nf.explicit_metadata?.items, 'icon_url') || '';
            const vault = nf.vaults?.items?.[0];
            if (!vault || !vault.items) return [];

            const valAddrFromMeta = getMetadataValue(nf.explicit_metadata?.items, 'validator');
            const isClaim = !!nf.explicit_metadata?.items?.find((m: MetadataItem) => m.key === 'claim_nft') || !!valAddrFromMeta || !!validatorsData?.validators.find(v => v.claimTokenResourceAddress === nf.resource_address);
            const isOwnerBadgeCollection = baseName.toLowerCase().includes('owner badge');

            return vault.items.map((id: string) => {
                let finalName = baseName;
                let amt: string | undefined = undefined;
                if (isClaim) {
                    const valByClaim = validatorsData?.validators.find(v => v.claimTokenResourceAddress === nf.resource_address);
                    const fallbackVal = valAddrFromMeta ? validatorsData?.validators.find(v => v.address === valAddrFromMeta) : undefined;
                    const finalValName = valByClaim?.name || fallbackVal?.name;
                    if (finalValName) finalName = `Stake Claim (${finalValName})`;

                    amt = claimAmounts[`${nf.resource_address}-${id}`];
                } else if (isOwnerBadgeCollection) {
                    const valByOwnerBadge = validatorsData?.validators.find(v => v.ownerBadge === id);
                    if (valByOwnerBadge) finalName = `Owner Badge (${valByOwnerBadge.name})`;
                }

                const key = `${nf.resource_address}-${id}`;
                const owner = nftOwners.get(key);
                
                let isUsedByOther = false;
                let isUsedByCurrent = false;

                if (owner !== undefined) {
                    if (owner === currentOwner) {
                        isUsedByCurrent = true;
                    } else {
                        isUsedByOther = true;
                    }
                }

                const selItem: SelectedAsset = { type: 'non_fungible', resourceAddress: nf.resource_address, symbol: 'NFT', name: finalName, iconUrl: icon, id, claimAmount: amt };
                
                let sel = false;
                let isDisabled = false;

                if (isAddressMode) {
                    const inSelected = selectedItems.some(s => s.type === 'non_fungible' && s.resourceAddress === nf.resource_address && s.id === id);
                    if (popupDestTarget !== null) {
                        if (isUsedByOther) {
                            sel = true;
                            isDisabled = true;
                        } else if (isUsedByCurrent) {
                            sel = !inSelected;
                        } else {
                            sel = inSelected;
                        }
                    } else {
                        if (isUsedByOther) {
                            sel = true;
                            isDisabled = true;
                        } else {
                            sel = inSelected;
                        }
                    }
                } else {
                    sel = isItemSelected(selItem);
                    if (isUsedByOther) {
                        isDisabled = true;
                    }
                }

                return (
                    <button
                        key={`${nf.resource_address}-${id}`}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                            if (isDisabled) return;
                            if (isAddressMode) {
                                toggleSelectedItem(selItem);
                            } else {
                                handleAssetSelect(selItem);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (isDisabled) return;
                                if (isAddressMode) {
                                    // eslint-disable-next-line react-hooks/refs
                                    handleConfirmSelection();
                                } else {
                                    handleAssetSelect(selItem);
                                }
                            }
                        }}
                        className={`w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg transition-colors group ${
                            sel ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : 'hover:bg-[var(--color-bg)]'
                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <div className="size-7 rounded-lg bg-[var(--color-card-border)] overflow-hidden shrink-0">
                            <SafeImage src={icon} alt={finalName} fallbackName={finalName} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className={`text-xs transition-colors truncate ${sel && !isDisabled ? '' : isDisabled ? 'opacity-80' : 'font-semibold group-hover:text-[var(--color-primary)]'}`} title={finalName}>
                                {finalName}
                                {amt && <span className="ml-1 text-[var(--color-primary)]">{amt} XRD</span>}
                            </span>
                            <span className={`text-[9px] font-mono truncate ${sel && !isDisabled ? 'text-[var(--color-primary)]/80 font-normal' : isDisabled ? 'opacity-60' : 'text-[var(--color-text-muted)]'}`}>{id.length > 20 ? id.slice(0, 8) + '...' + id.slice(-8) : id}</span>
                        </div>
                        {isAddressMode && sel && <Check className={`size-4 shrink-0 ml-2 ${isDisabled ? 'opacity-50' : ''}`} strokeWidth={2} />}
                    </button>
                );
            });
        });
    };

    const renderPoolUnitItems = () => (
        poolUnits.length === 0
            ? <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">No se encontraron Pool Units</div>
            : poolUnits.map((pu: ResourceItem) => {
                const name = getMetadataValue(pu.explicit_metadata?.items, 'name') || 'Pool Unit';
                const symbol = getMetadataValue(pu.explicit_metadata?.items, 'symbol') || 'POOL';
                const icon = getMetadataValue(pu.explicit_metadata?.items, 'icon_url') || '';
                const item: SelectedAsset = { type: 'pool_unit', resourceAddress: pu.resource_address, symbol, name, iconUrl: icon };
                
                let sel = isAddressMode ? selectedItems.some(s => s.type === 'pool_unit' && s.resourceAddress === pu.resource_address) : isItemSelected(item);
                const liveAmount = getAvailableBalance(pu.resource_address);
                const isDisabled = liveAmount <= 0 && !sel;

                return (
                    <button
                        key={pu.resource_address}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                            if (isDisabled) return;
                            if (isAddressMode) {
                                toggleSelectedItem(item);
                            } else {
                                handleAssetSelect(item);
                            }
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (isDisabled) return;
                                if (isAddressMode) {
                                    // eslint-disable-next-line react-hooks/refs
                                    handleConfirmSelection();
                                } else {
                                    handleAssetSelect(item);
                                }
                            }
                        }}
                        className={`w-full text-left flex items-center justify-between p-2.5 rounded-lg transition-colors group ${sel && !isDisabled ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold' : isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[var(--color-bg)]'
                            }`}
                    >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="size-7 rounded-full bg-[var(--color-card-border)] overflow-hidden shrink-0">
                                <SafeImage src={icon} alt={name} fallbackName={name} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className={`text-xs transition-colors truncate ${sel && !isDisabled ? '' : isDisabled ? 'opacity-80' : 'font-semibold group-hover:text-[var(--color-primary)]'}`}>{symbol}</span>
                                <span className={`text-[10px] truncate ${sel && !isDisabled ? 'text-[var(--color-primary)]/80 font-normal' : isDisabled ? 'opacity-60' : 'text-[var(--color-text-muted)]'}`}>{name}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono shrink-0 ${sel && !isDisabled ? '' : isDisabled ? 'opacity-60' : 'font-bold'}`}>{liveAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            {isAddressMode && sel && <Check className={`size-4 shrink-0 ml-2 ${isDisabled ? 'opacity-50' : ''}`} strokeWidth={2} />}
                        </div>
                    </button>
                );
            })
    );
    const getSelectionPopup = (context: { assetId?: string | null, destTarget?: string | null }) => {
        const targetDest = context.destTarget ?? null;
        const targetAsset = context.assetId ?? null;
        const isMatch = popupMode === (context.assetId ? 'asset' : 'address') &&
            popupDestTarget === targetDest &&
            editingAssetId === targetAsset;

        return (
            <AnimatePresence>
                {(isMatch && popupOpen) && (
                    <m.div
                        initial={{ opacity: 0, y: popupDirection === 'up' ? -8 : 8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: popupDirection === 'up' ? -8 : 8, scale: 0.97 }}
                        transition={{ duration: 0.15 }}
                        className={`absolute left-0 right-0 z-50 ${popupDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'} rounded-xl border border-[var(--color-card-border)] bg-[var(--color-surface)]/95 backdrop-blur-xl shadow-2xl overflow-hidden`}
                    >
                        {/* Tabs and Close */}
                        <div className="px-3 pt-3 flex items-center justify-between border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                            <div className="flex gap-3 overflow-x-auto no-scrollbar flex-1">
                                {tabs.map(tab => (
                                    <div
                                        key={tab.type}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => setActiveTab(tab.type)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab(tab.type); }}
                                        className="relative py-2 px-1 cursor-pointer outline-none flex items-center justify-center group"
                                    >
                                        <span className={`text-[10px] font-bold tracking-wider uppercase whitespace-nowrap transition-opacity duration-200 ${activeTab === tab.type
                                            ? 'text-[var(--color-primary)] opacity-100'
                                            : 'text-[var(--color-text-muted)] opacity-80 group-hover:opacity-100'
                                            }`}>
                                            {tab.label} {tab.count !== undefined ? `(${tab.count})` : ''}
                                        </span>
                                        {activeTab === tab.type && (
                                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-primary)] rounded-t-full" />
                                        )}
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setPopupOpen(false);
                                    setPopupDestTarget(null);

                                }}
                                className="size-6 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-surface)] transition-colors shrink-0 ml-2"
                                title="Cerrar"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-3 border-b border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-text-muted)]" />
                                <input
                                    type="text"
                                    placeholder={popupMode === 'address' ? 'Buscar dirección...' : 'Buscar activo...'}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && isAddressMode) {
                                            e.preventDefault();
                                            // eslint-disable-next-line react-hooks/refs
                                            handleConfirmSelection();
                                        }
                                    }}
                                    className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                />
                            </div>
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

                        {/* Confirm button */}
                        {isAddressMode && (
                            <div className="p-3 border-t border-[var(--color-card-border)] bg-[var(--color-bg)]/50">
                                <button
                                    type="button"
                                    onClick={handleConfirmSelection}
                                    className="w-full flex items-center justify-center py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 transition-colors"
                                >
                                    {navT.wallet_confirm_selection || 'Agregar'}
                                </button>
                            </div>
                        )}
                    </m.div>
                )}
            </AnimatePresence>
        );
    };

    return (
        <div ref={containerRef} className="flex flex-col gap-3 pb-2 relative">
            {/* Global dest tree */}
            <div className="flex flex-col">
                {/* Destination input + popup (wrapped together for popup positioning) */}
                <div className="relative">
                    {/* Destination Address Input with embedded + */}
                    <div className="relative z-10">
                        {(() => {
                            const acc = accounts.find(a => a.address === destinationAddress);
                            const hasLabel = acc && acc.label;
                            return (
                                <>
                                    {hasLabel && (
                                        <div className="absolute left-3 top-1.5 text-[10px] text-[var(--color-text-main)] font-bold opacity-80 pointer-events-none">
                                            {acc.label}
                                        </div>
                                    )}
                                    <input
                                        type="text"
                                        placeholder={navT.wallet_dest_placeholder || 'Dirección de destino (account_...)'}
                                        value={formatAddress(destinationAddress, isDestFocused)}
                                        onFocus={() => setIsDestFocused(true)}
                                        onBlur={() => setIsDestFocused(false)}
                                        onChange={(e) => setDestinationAddress(e.target.value)}
                                        className={`w-full border rounded-lg px-3 ${hasLabel ? 'pt-5 pb-1.5' : 'py-2'} text-sm focus:outline-none transition-colors pr-16 border-[var(--color-border)] focus:border-[var(--color-primary)] bg-[var(--color-bg)] ${addressValidity[destinationAddress] === false ? 'text-red-500' : 'text-[var(--color-text-main)]'} placeholder:text-[var(--color-text-muted)] placeholder:opacity-70 truncate`}
                                    />
                                </>
                            );
                        })()}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                                type="button"
                                disabled={isWalletEmpty}
                                onClick={(e) => handleOpenPopup('address', undefined, undefined, e.currentTarget)}
                                className="size-7 flex items-center justify-center rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Seleccionar dirección"
                            >
                                <Plus className="size-3.5" strokeWidth={3} />
                            </button>
                        </div>
                    </div>

                    {/* Validation text removed here, moved to the bottom */}

                    {getSelectionPopup({ destTarget: null })}
                </div>

                {/* Global dest assets (without per-row destination) */}
                <div className="flex flex-col gap-2 mt-1.5">
                    {assets.filter(a => a.destAddress === undefined).map((asset, index) => {
                        const showRowActions = index > 0;
                        return (
                            <div key={asset.internalId} className="relative flex">
                                <div className="relative w-6 shrink-0">
                                    <div className="absolute left-1/2 -translate-x-1/2 top-[-45px] bottom-1/2 w-[2px] bg-[var(--color-card-border)]"></div>
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-[var(--color-card-border)]"></div>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 size-[7px] rounded-full bg-[var(--color-card-border)]"></div>
                                </div>
                                <div className="flex items-stretch flex-1 min-w-0">
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        {asset.type === 'non_fungible' ? (
                                            (() => {
                                                const dynClaimAmt = asset.claimAmount || (asset.nftId ? claimAmounts[`${asset.resourceAddress}-${asset.nftId}`] : undefined);
                                                return (
                                                    <div className={`w-full h-full bg-[var(--color-bg)]/50 border border-[var(--color-card-border)] border-r-0 rounded-l-xl py-3 pl-4 text-sm text-[var(--color-text-main)] opacity-70 font-mono flex items-center min-w-0 overflow-hidden`}>
                                                        <div className="flex flex-col min-w-0 w-full gap-0.5 justify-center">
                                                            <span className="text-xs font-medium truncate" title={asset.name}>{asset.name}</span>
                                                            <span className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">{asset.nftId ? `${asset.nftId.slice(0, 16)}...${asset.nftId.slice(-8)}` : 'Sin ID'}</span>
                                                            {dynClaimAmt && (
                                                                <span className="text-xs font-bold text-[var(--color-primary)] truncate mt-0.5">{dynClaimAmt} XRD</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                            (() => {
                                                const availBalance = getAvailableBalance(asset.resourceAddress);
                                                const isError = availBalance < 0;
                                                return (
                                                    <div className="relative w-full h-[42px]">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="any"
                                                            placeholder="0.00"
                                                            value={asset.amount}
                                                            disabled={isWalletEmpty}
                                                            onChange={(e) => updateAmount(asset.internalId, e.target.value)}
                                                            className={`w-full h-full bg-[var(--color-surface)] border-y border-l rounded-l-xl py-2.5 pl-4 pr-16 text-sm focus:outline-none transition-all font-mono disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-[var(--color-card-border)] focus:border-[var(--color-primary)]/50 ${isError ? 'text-red-500 placeholder:text-red-500/70' : 'text-[var(--color-text-main)] placeholder-[var(--color-text-muted)]'}`}
                                                        />
                                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-end">
                                                            <span className={`text-[10px] font-mono ${isError ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>{availBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        )}
                                    </div>
                                    <div className={`flex items-center gap-0 ${asset.type === 'non_fungible' ? 'bg-[var(--color-bg)]/50 h-full' : 'bg-[var(--color-surface)] h-[42px]'} border-r border-y border-[var(--color-card-border)] rounded-r-xl px-1.5 shrink-0`}>
                                        <button
                                            type="button"
                                            disabled={isWalletEmpty}
                                            onClick={(e) => handleOpenPopup('asset', asset.internalId, undefined, e.currentTarget)}
                                            className="flex items-center gap-1.5 h-[28px] bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-lg px-2 hover:bg-[var(--color-bg)] transition-colors max-w-[110px] disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Cambiar Activo"
                                        >
                                            <div className="size-4 rounded-full overflow-hidden shrink-0 bg-[var(--color-bg)]">
                                                <SafeImage src={asset.resourceAddress === xrdAddress ? (xrdIconUrl || asset.iconUrl) : asset.iconUrl} alt={asset.symbol} fallbackName={asset.name || asset.symbol} className="w-full h-full object-cover" />
                                            </div>
                                            <span className="font-semibold text-[10px] truncate">{asset.symbol}</span>
                                        </button>
                                        {showRowActions && (
                                            <button
                                                type="button"
                                                disabled={isWalletEmpty}
                                                onClick={() => removeAsset(asset.internalId)}
                                                className="size-6 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-[var(--color-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <X className="size-3" strokeWidth={3} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {getSelectionPopup({ assetId: asset.internalId })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Per-dest groups */}
            {(() => {
                const groups = new Map<string, AssetItem[]>();
                assets.forEach(a => {
                    if (a.groupId !== undefined) {
                        const list = groups.get(a.groupId) || [];
                        list.push(a);
                        groups.set(a.groupId, list);
                    }
                });
                return [...groups.entries()].map(([groupId, items]) => {
                    const header = items[0];
                    return (
                        <div key={groupId} className="flex flex-col">
                            <div className={`relative ${popupDestTarget === groupId ? 'z-50' : 'z-10'}`}>
                                {(() => {
                                    const acc = accounts.find(a => a.address === (header.destAddress || ''));
                                    const hasLabel = acc && acc.label;
                                    return (
                                        <>
                                            {hasLabel && (
                                                <div className="absolute left-3 top-1.5 text-[10px] text-[var(--color-text-main)] font-bold opacity-80 pointer-events-none">
                                                    {acc.label}
                                                </div>
                                            )}
                                            <input
                                                type="text"
                                                placeholder={navT.wallet_dest_placeholder || 'Dirección de destino (account_...)'}
                                                value={formatAddress(header.destAddress || '', focusedGroupId === groupId)}
                                                onFocus={() => setFocusedGroupId(groupId)}
                                                onBlur={() => setFocusedGroupId(null)}
                                                disabled={isWalletEmpty}
                                                onChange={(e) => updateGroupDestAddress(groupId, e.target.value)}
                                                className={`w-full border rounded-lg px-3 ${hasLabel ? 'pt-5 pb-1.5' : 'py-2'} text-sm focus:outline-none transition-colors pr-16 border-[var(--color-border)] focus:border-[var(--color-primary)] bg-[var(--color-bg)] ${(header.destAddress && addressValidity[header.destAddress] === false) ? 'text-red-500' : 'text-[var(--color-text-main)]'} placeholder:text-[var(--color-text-muted)] placeholder:opacity-70 truncate disabled:opacity-50 disabled:cursor-not-allowed`}
                                            />
                                        </>
                                    );
                                })()}
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={isWalletEmpty}
                                        onClick={(e) => handleOpenPopup('address', undefined, groupId, e.currentTarget)}
                                        className="size-7 flex items-center justify-center rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Vincular activos"
                                    >
                                        <Plus className="size-3.5" strokeWidth={3} />
                                    </button>
                                </div>
                                {getSelectionPopup({ destTarget: groupId })}
                            </div>
                            {items.map((item) => (
                                <div key={item.internalId} className="relative flex items-stretch mt-1.5">
                                    <div className="relative w-6 shrink-0">
                                        <div className="absolute left-1/2 -translate-x-1/2 top-[-45px] bottom-1/2 w-[2px] bg-[var(--color-card-border)]"></div>
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-[var(--color-card-border)]"></div>
                                        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 size-[7px] rounded-full bg-[var(--color-card-border)]"></div>
                                    </div>
                                    <div className="flex items-stretch flex-1 min-w-0">
                                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                                            {item.type === 'non_fungible' ? (
                                                (() => {
                                                    const dynClaimAmt = item.claimAmount || (item.nftId ? claimAmounts[`${item.resourceAddress}-${item.nftId}`] : undefined);
                                                    return (
                                                        <div className={`w-full h-full bg-[var(--color-bg)]/50 border border-[var(--color-card-border)] border-r-0 rounded-l-xl py-3 pl-4 text-sm text-[var(--color-text-main)] opacity-70 font-mono flex items-center min-w-0 overflow-hidden`}>
                                                            <div className="flex flex-col min-w-0 w-full gap-0.5 justify-center">
                                                                <span className="text-xs font-medium truncate" title={item.name}>{item.name}</span>
                                                                <span className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">{item.nftId ? `${item.nftId.slice(0, 16)}...${item.nftId.slice(-8)}` : 'Sin ID'}</span>
                                                                {dynClaimAmt && (
                                                                    <span className="text-xs font-bold text-[var(--color-primary)] truncate mt-0.5">{dynClaimAmt} XRD</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()
                                            ) : (
                                                (() => {
                                                    const availBalance = getAvailableBalance(item.resourceAddress);
                                                    const isError = availBalance < 0;
                                                    return (
                                                        <div className="relative w-full h-[42px]">
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="any"
                                                                placeholder="0.00"
                                                                value={item.amount}
                                                                disabled={isWalletEmpty}
                                                                onChange={(e) => updateAmount(item.internalId, e.target.value)}
                                                                className={`w-full h-full bg-[var(--color-surface)] border-y border-l rounded-l-xl py-2.5 pl-4 pr-16 text-sm focus:outline-none transition-all font-mono disabled:opacity-50 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none border-[var(--color-card-border)] focus:border-[var(--color-primary)]/50 ${isError ? 'text-red-500 placeholder:text-red-500/70' : 'text-[var(--color-text-main)] placeholder-[var(--color-text-muted)]'}`}
                                                            />
                                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-end">
                                                                <span className={`text-[10px] font-mono ${isError ? 'text-red-500' : 'text-[var(--color-text-muted)]'}`}>{availBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()
                                            )}
                                        </div>
                                        <div className={`flex items-center gap-0 ${item.type === 'non_fungible' ? 'bg-[var(--color-bg)]/50 h-full' : 'bg-[var(--color-surface)] h-[42px]'} border-r border-y border-[var(--color-card-border)] rounded-r-xl px-1.5 shrink-0`}>
                                            <button
                                                type="button"
                                                disabled={isWalletEmpty}
                                                onClick={(e) => handleOpenPopup('asset', item.internalId, undefined, e.currentTarget)}
                                                className="flex items-center gap-1.5 h-[28px] bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-lg px-2 hover:bg-[var(--color-bg)] transition-colors max-w-[110px] disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Cambiar Activo"
                                            >
                                                <div className="size-4 rounded-full overflow-hidden shrink-0 bg-[var(--color-bg)]">
                                                    <SafeImage src={item.resourceAddress === xrdAddress ? (xrdIconUrl || item.iconUrl) : item.iconUrl} alt={item.symbol} fallbackName={item.name || item.symbol} className="w-full h-full object-cover" />
                                                </div>
                                                <span className="font-semibold text-[10px] truncate">{item.symbol}</span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isWalletEmpty}
                                                onClick={() => removeAsset(item.internalId)}
                                                className="size-6 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-[var(--color-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <X className="size-3" strokeWidth={3} />
                                            </button>
                                        </div>
                                    </div>
                                    {getSelectionPopup({ assetId: item.internalId })}
                                </div>
                            ))}
                        </div>
                    );
                });
            })()}
            {/* Compute global states inline or use a precomputed variable */}
            {(() => {
                const isAnyOverdrawn = assets.some(a => a.type === 'fungible' && getAvailableBalance(a.resourceAddress) < 0);
                const hasAnyInvalidAddress = (destinationAddress && addressValidity[destinationAddress] === false) ||
                                             assets.some(a => a.destAddress && addressValidity[a.destAddress] === false);
                
                return (
                    <>
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={isTransacting || isWalletEmpty || isAnyOverdrawn || hasAnyInvalidAddress}
                            className="w-full font-bold py-3 px-4 rounded-xl shadow-lg transition-all duration-300 transform-gpu origin-center will-change-transform [backface-visibility:hidden] [-webkit-font-smoothing:antialiased] [&:not(:disabled):hover]:brightness-110 [&:not(:disabled):hover]:shadow-xl [&:not(:disabled):active]:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-primary)] to-[var(--color-secondary)] text-white flex justify-center items-center gap-2"
                        >
                            {isTransacting ? (
                                <>
                                    <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>{navT.wallet_sending || 'Enviando...'}</span>
                                </>
                            ) : (
                                <span>{navT.wallet_send_transaction || 'Enviar Transacción'}</span>
                            )}
                        </button>

                        {isAnyOverdrawn && (
                            <div className="text-red-400 text-xs font-medium px-2 bg-red-400/10 py-2 rounded-lg border border-red-400/20 text-center">
                                {navT.wallet_insufficient_balance || 'Saldo insuficiente'}
                            </div>
                        )}

                        {hasAnyInvalidAddress && !isAnyOverdrawn && (
                            <div className="text-red-400 text-xs font-medium px-2 bg-red-400/10 py-2 rounded-lg border border-red-400/20 text-center">
                                {navT.wallet_invalid_address || 'Dirección inválida'}
                            </div>
                        )}

                        {error && !isAnyOverdrawn && (
                            <div className="text-red-400 text-xs font-medium px-2 bg-red-400/10 py-2 rounded-lg border border-red-400/20 text-center">
                                {error}
                            </div>
                        )}
                    </>
                );
            })()}
        </div>
    );
}
