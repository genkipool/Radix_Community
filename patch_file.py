import re

with open('features/wallet/components/TransactionBuilder.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. State Persistence
code = code.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nconst transactionStateCache = new Map<string, any>();")
code = code.replace("const [destinationAddress, setDestinationAddress] = useState('');", "const [destinationAddress, setDestinationAddress] = useState<string>(transactionStateCache.get('destinationAddress') || '');")
old_assets_state = """    const [assets, setAssets] = useState<AssetItem[]>([
        {
            internalId: 'default-xrd',
            type: 'fungible',
            resourceAddress: xrdAddress,
            symbol: 'XRD',
            name: 'Radix',
            amount: '',
        }
    ]);"""
new_assets_state = """    const [assets, setAssets] = useState<AssetItem[]>(transactionStateCache.get('assets') || [
        {
            internalId: 'default-xrd',
            type: 'fungible',
            resourceAddress: xrdAddress,
            symbol: 'XRD',
            name: 'Radix',
            amount: '',
        }
    ]);"""
code = code.replace(old_assets_state, new_assets_state)

# Add cache updates inside component
cache_effect = """    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { transactionStateCache.set('destinationAddress', destinationAddress); }, [destinationAddress]);
    useEffect(() => { transactionStateCache.set('assets', assets); }, [assets]);"""
code = code.replace("    const containerRef = useRef<HTMLDivElement>(null);", cache_effect)

# 2. LSU Validator Name
code = code.replace("import { SafeImage } from '@/components/ui/SafeImage';", "import { SafeImage } from '@/components/ui/SafeImage';\nimport { useValidatorsQuery } from '@/features/dashboard/staking/hooks/useValidatorsQuery';")
code = code.replace("const network = activeNetwork || 'mainnet';", "const network = activeNetwork || 'mainnet';\n    const { data: validatorsData } = useValidatorsQuery(network);")

# Update getSymbol logic inside renderFungibleItems
symbol_str = "const symbol = getMetadataValue(f.explicit_metadata?.items, 'symbol') || 'Unknown';"
new_symbol_str = """let symbol = getMetadataValue(f.explicit_metadata?.items, 'symbol') || 'Unknown';
                if (isLsuToken(f.explicit_metadata?.items)) {
                    const valAddr = getMetadataValue(f.explicit_metadata?.items, 'validator');
                    const valName = validatorsData?.validators?.find(v => v.address === valAddr)?.name;
                    symbol = valName ? `${valName} LSU` : 'LSU';
                }"""
code = code.replace(symbol_str, new_symbol_str)

# 3. Intelligent Popup Logic, Toggle, and Max-width
old_handle = """    const handleOpenPopup = (mode: PopupMode, assetId?: string, destTarget?: string) => {
        setPopupMode(mode);
        setPopupDestTarget(destTarget ?? null);
        if (mode === 'address' && destTarget === undefined) {
            setActiveTab('address');
        } else {
            setActiveTab('fungible');
        }
        setEditingAssetId(assetId ?? null);
        setSearchQuery('');
        setAddressCount(0);
        setPopupOpen(true);
    };"""

new_handle = """    const [popupDirection, setPopupDirection] = useState<'down' | 'up'>('down');
    
    const handleOpenPopup = (e: React.MouseEvent, mode: PopupMode, assetId?: string, destTarget?: string) => {
        e.stopPropagation();
        const targetDest = destTarget ?? null;
        const targetAsset = assetId ?? null;

        if (popupOpen && popupMode === mode && popupDestTarget === targetDest && editingAssetId === targetAsset) {
            setPopupOpen(false);
            setPopupDestTarget(null);
            setEditingAssetId(null);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 400 && spaceAbove > spaceBelow) {
            setPopupDirection('up');
        } else {
            setPopupDirection('down');
        }

        setPopupMode(mode);
        setPopupDestTarget(targetDest);
        if (mode === 'address' && destTarget === undefined) {
            setActiveTab('address');
        } else {
            setActiveTab('fungible');
        }
        setEditingAssetId(targetAsset);
        setSearchQuery('');
        setAddressCount(0);
        setPopupOpen(true);
    };"""
code = code.replace(old_handle, new_handle)

# Replace onClick handlers
code = code.replace("onClick={() => handleOpenPopup('address')}", "onClick={(e) => handleOpenPopup(e, 'address')}")
code = code.replace("onClick={() => handleOpenPopup('asset', asset.internalId)}", "onClick={(e) => handleOpenPopup(e, 'asset', asset.internalId)}")
code = code.replace("onClick={() => handleOpenPopup('address', undefined, groupId)}", "onClick={(e) => handleOpenPopup(e, 'address', undefined, groupId)}")
code = code.replace("onClick={() => handleOpenPopup('asset', item.internalId)}", "onClick={(e) => handleOpenPopup(e, 'asset', item.internalId)}")

# Add max-width to the asset symbol buttons
code = code.replace('className="flex items-center gap-1.5 h-[28px] bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-lg px-2 hover:bg-[var(--color-bg)] transition-colors"', 'className="flex items-center gap-1.5 h-[28px] bg-[var(--color-surface)] border border-[var(--color-card-border)] rounded-lg px-2 hover:bg-[var(--color-bg)] transition-colors max-w-[110px]"')
code = code.replace('<span className="font-semibold text-[10px]">{asset.symbol}</span>', '<span className="font-semibold text-[10px] truncate">{asset.symbol}</span>')
code = code.replace('<span className="font-semibold text-[10px]">{item.symbol}</span>', '<span className="font-semibold text-[10px] truncate">{item.symbol}</span>')

# Enter key for confirm
input_search = """                                        <input
                                            type="text"
                                            placeholder={popupMode === 'address' ? 'Buscar dirección...' : 'Buscar activo...'}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                        />"""
input_replace = """                                        <input
                                            type="text"
                                            placeholder={popupMode === 'address' ? 'Buscar dirección...' : 'Buscar activo...'}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && isAddressMode) {
                                                    e.preventDefault();
                                                    handleConfirmSelection();
                                                }
                                            }}
                                            className="w-full bg-[var(--color-bg)] border border-[var(--color-card-border)] rounded-lg py-2 pl-9 pr-3 text-xs text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors placeholder:text-[var(--color-text-muted)]/50"
                                        />"""
code = code.replace(input_search, input_replace)


# 4. Extract renderPopupFor helper safely
# Let's find the exact block of the popup
popup_match = re.search(r"(\s*)\{\/\* Asset Selection Popup[\s\S]*?<\/AnimatePresence>", code)
if popup_match:
    popup_block = popup_match.group(0)
    
    # Replace the top-level block with `{renderPopupFor('main_dest')}`
    main_dest_call = popup_match.group(1) + "{renderPopupFor('main_dest')}"
    code = code.replace(popup_block, main_dest_call)
    
    # We need to insert the definition of renderPopupFor BEFORE `return (` of TransactionBuilder
    # To do this safely, we will find `    const renderAddressTab = () => (`
    # and insert `renderPopupFor` right above it!
    
    mdiv_content = re.search(r"\{popupOpen && \(([\s\S]*?)\)\}", popup_block).group(1)
    
    helper_code = f"""
    const renderPopupFor = (type: 'main_dest' | 'group_dest' | 'asset', id?: string) => {{
        let isActive = false;
        if (type === 'main_dest') isActive = popupOpen && popupDestTarget === null && editingAssetId === null;
        else if (type === 'group_dest') isActive = popupOpen && popupDestTarget === id && editingAssetId === null;
        else if (type === 'asset') isActive = popupOpen && editingAssetId === id;

        return (
            <AnimatePresence>
                {{isActive && (
{mdiv_content}
                )}}
            </AnimatePresence>
        );
    }};

    const renderAddressTab = () => ("""
    
    code = code.replace("    const renderAddressTab = () => (", helper_code)

# 5. Insert renderPopupFor into other places
group_dest_str = """                                </div>
                            </div>
                            {items.map((item) => ("""
new_group_dest_str = """                                </div>
                                {renderPopupFor('group_dest', groupId)}
                            </div>
                            {items.map((item) => ("""
code = code.replace(group_dest_str, new_group_dest_str)

global_asset_str = """                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>"""
new_global_asset_str = """                                        )}
                                    </div>
                                </div>
                                {renderPopupFor('asset', asset.internalId)}
                            </div>
                        );
                    })}
                </div>"""
code = code.replace(global_asset_str, new_global_asset_str)

group_asset_str = """                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>"""
new_group_asset_str = """                                            </button>
                                        </div>
                                    </div>
                                    {renderPopupFor('asset', item.internalId)}
                                </div>
                            ))}
                        </div>"""
code = code.replace(group_asset_str, new_group_asset_str)

with open('features/wallet/components/TransactionBuilder.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

