import re

with open('features/wallet/components/TransactionBuilder.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove ref={destContainerRef} from the main input relative div
code = code.replace('<div className="relative" ref={destContainerRef}>', '<div className="relative">')

# 2. Add renderPopupFor('group_dest', groupId) to the group destination wrapper
group_dest_str = """                                </div>
                            </div>
                            {items.map((item) => ("""
new_group_dest_str = """                                </div>
                                {renderPopupFor('group_dest', groupId)}
                            </div>
                            {items.map((item) => ("""
code = code.replace(group_dest_str, new_group_dest_str)

# 3. Add renderPopupFor('asset', asset.internalId) to the global asset row
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

# 4. Add renderPopupFor('asset', item.internalId) to the group asset row
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

