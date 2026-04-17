/* ═══════ Unified Tag Color Map ═══════ */
export type TagPalette = { colorClass?: string; bgClass?: string };

/**
 * UNIFIED THEME-AWARE PALETTE
 * All tags now use the same high-contrast, theme-aware style by default.
 * This simplifies the code and ensures consistency across Blog, Forum, and dApps.
 */
export const defaultTagPalette: TagPalette = {
    colorClass: "text-[var(--color-text-main)]",
    bgClass: "bg-[var(--color-bg-alt)] border-[var(--color-border)]"
};

// We keep the empty objects for backward compatibility with existing components
// while we transition to direct LabelBadge usage with defaults.
export const tagColor: Record<string, TagPalette> = {};
export const dappTagColor: Record<string, TagPalette> = {};
