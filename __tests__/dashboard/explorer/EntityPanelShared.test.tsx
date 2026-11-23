import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const capturedLayoutIds: string[] = [];

vi.mock('motion/react', () => ({
    m: {
        button: ({ children, whileHover: _wh, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { whileHover?: unknown }) => (
            <button {...props}>{children}</button>
        ),
        div: ({ children, layoutId, variants: _v, initial: _i, transition: _t, ...props }: React.HTMLAttributes<HTMLDivElement> & { layoutId?: string; variants?: unknown; initial?: unknown; transition?: unknown }) => {
            if (layoutId) capturedLayoutIds.push(layoutId);
            return <div data-layout-id={layoutId} {...props}>{children}</div>;
        },
    },
}));

vi.mock('@/features/dashboard/explorador/components/EntityBadge', () => ({
    AddressDisplay: ({ address }: { address: string }) => <div data-testid="address-display">{address}</div>,
}));

import { PanelTabBar, PanelMetadataTab } from '@/features/dashboard/explorador/components/EntityPanelShared';
import type { MetadataItem } from '@/features/dashboard/types/shared.types';

describe('EntityPanelShared', () => {
    it('gives each PanelTabBar instance a unique layoutId so sibling cards never collide', () => {
        capturedLayoutIds.length = 0;
        const tabs = [
            { key: 'summary', label: 'Summary' },
            { key: 'metadata', label: 'Metadata' },
        ];

        const { container } = render(
            <div>
                <PanelTabBar tabs={tabs} activeTab="summary" onTabChange={vi.fn()} />
                <PanelTabBar tabs={tabs} activeTab="metadata" onTabChange={vi.fn()} />
            </div>
        );

        expect(capturedLayoutIds).toHaveLength(2);
        expect(capturedLayoutIds[0]).not.toBe(capturedLayoutIds[1]);

        const tabBars = container.querySelectorAll('.overflow-x-auto');
        expect(tabBars).toHaveLength(2);
        for (const bar of tabBars) {
            expect(bar.className).toContain('custom-scrollbar');
            expect(bar.className).not.toContain('hide-scrollbar');
        }
    });

    it('wraps long unbreakable metadata URLs and text inside min-w-0 flex items', () => {
        const items: MetadataItem[] = [
            {
                key: 'icon_url',
                is_locked: false,
                last_updated_at_state_version: 1,
                value: {
                    typed: {
                        type: 'Url',
                        value: 'https://assets.radixdlt.com/icons/very-long-unbreakable-path-segment-that-must-wrap.png',
                    },
                },
            },
            {
                key: 'custom_hash',
                is_locked: false,
                last_updated_at_state_version: 1,
                value: {
                    typed: {
                        type: 'String',
                        value: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
                    },
                },
            },
        ];

        const { container } = render(<PanelMetadataTab metadataItems={items} tt={{}} />);
        const rows = container.querySelectorAll('.group\\/meta-item');
        expect(rows).toHaveLength(2);
        for (const row of rows) {
            expect(row.className).toContain('min-w-0');
        }

        const link = container.querySelector('a');
        expect(link?.className).toContain('min-w-0');
        expect(link?.className).toContain('[overflow-wrap:anywhere]');

        const textSpan = rows[1].querySelector('span');
        expect(textSpan?.className).toContain('min-w-0');
        expect(textSpan?.className).toContain('[overflow-wrap:anywhere]');
    });
});
