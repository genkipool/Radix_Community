import re

with open('features/wallet/components/TransactionBuilder.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove destContainerRef
code = code.replace("const destContainerRef = useRef<HTMLDivElement>(null);\n", "")

# 2. Modify handleOpenPopup
old_handle = """    const handleOpenPopup = (mode: PopupMode, assetId?: string, destTarget?: string) => {
        const targetDest = destTarget ?? null;
        const targetAsset = assetId ?? null;

        if (popupOpen && popupMode === mode && popupDestTarget === targetDest && editingAssetId === targetAsset) {
            setPopupOpen(false);
            setPopupDestTarget(null);
            setEditingAssetId(null);
            return;
        }"""
new_handle = """    const handleOpenPopup = (e: React.MouseEvent, mode: PopupMode, assetId?: string, destTarget?: string) => {
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
        }"""
code = code.replace(old_handle, new_handle)

# 3. Update onClick handlers
code = code.replace("onClick={() => handleOpenPopup('address')}", "onClick={(e) => handleOpenPopup(e, 'address')}")
code = code.replace("onClick={() => handleOpenPopup('asset', asset.internalId)}", "onClick={(e) => handleOpenPopup(e, 'asset', asset.internalId)}")
code = code.replace("onClick={() => handleOpenPopup('address', undefined, groupId)}", "onClick={(e) => handleOpenPopup(e, 'address', undefined, groupId)}")
code = code.replace("onClick={() => handleOpenPopup('asset', item.internalId)}", "onClick={(e) => handleOpenPopup(e, 'asset', item.internalId)}")

# 4. Remove useEffect for popupDirection
effect_match = re.search(r"useEffect\(\(\) => \{\n\s*if \(popupOpen && destContainerRef\.current\) \{[\s\S]*?\}, \[popupOpen\]\);\n\n", code)
if effect_match:
    code = code.replace(effect_match.group(0), "")

# 5. Extract AnimatePresence to renderPopupFor helper
# We need to find the AnimatePresence block starting at line 851.
start_str = "                    {/* Asset Selection Popup (floating, right below destination input) */}\n                    <AnimatePresence>"
end_str = "                    </AnimatePresence>"

popup_match = re.search(r"(\s*)\{\/\* Asset Selection Popup[\s\S]*?<\/AnimatePresence>", code)
if popup_match:
    popup_block = popup_match.group(0)
    
    # We replace it with {renderPopupFor('main_dest')} in the main input
    # But wait, we need to DEFINE renderPopupFor earlier, right above `return (`
    
    # Let's extract the inside of <AnimatePresence> which is just {popupOpen && ( ... )}
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

    return ("""

    code = code.replace("    return (", helper_code)
    
    # Replace the original popup block with the main_dest call
    main_dest_call = popup_match.group(1) + "{renderPopupFor('main_dest')}"
    code = code.replace(popup_block, main_dest_call)

# 6. Insert renderPopupFor into other places
# After `title="Cambiar Activo"` and `</button>` -> wait, they are inside flex containers.
# We need to render the popup *relative* to the button. The button's wrapper must be relative!
# Let's write the updated code back.

with open('features/wallet/components/TransactionBuilder.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

