function getMetaValue(metadataItems, key) {
    const item = metadataItems.find((m) => m.key === key);
    if (!item || !item.value || !item.value.typed) return null;
    return item.value.typed.value;
}
