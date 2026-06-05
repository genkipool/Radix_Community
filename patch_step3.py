import re

with open('features/wallet/components/TransactionBuilder.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Find the AnimatePresence block inside TransactionBuilder
popup_start = code.find('{/* Asset Selection Popup (floating, right below destination input) */}')
if popup_start != -1:
    end_tag = '</AnimatePresence>'
    popup_end = code.find(end_tag, popup_start) + len(end_tag)
    popup_block = code[popup_start:popup_end]
    
    # We want to extract the content inside <m.div>
    mdiv_start = popup_block.find('<m.div')
    mdiv_end = popup_block.find('</m.div>') + len('</m.div>')
    mdiv_content = popup_block[mdiv_start:mdiv_end]
    
    # Define the renderPopupFor helper before renderAddressTab
    render_address_idx = code.find('    const renderAddressTab = () => {')
    
    helper = f"""    const renderPopupFor = (type: 'main_dest' | 'group_dest' | 'asset', id?: string) => {{
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

"""
    code = code[:render_address_idx] + helper + code[render_address_idx:]
    
    # Now replace the original popup block with the call for main_dest
    code = code.replace(popup_block, "{renderPopupFor('main_dest')}")

# Now insert the other renderPopupFor calls

# group_dest
group_dest_str = """                                </div>
                            </div>
                            {items.map((item) => ("""
new_group_dest_str = """                                </div>
                                {renderPopupFor('group_dest', groupId)}
                            </div>
                            {items.map((item) => ("""
code = code.replace(group_dest_str, new_group_dest_str)

# global_asset
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

# group_asset
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

