import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NetworkHealthSection } from '@/features/dashboard/components/NetworkHealthSection';
import { translations } from '@/i18n';
import type { Validator } from '@/types/radix';

const dt = translations.en.dashboard;

const validator = (version: string, provider: string | null): Validator => ({
    address: `validator_rdx1${Math.random().toString(36).slice(2)}`,
    status: 'active',
    version,
    provider: '',
    country: '',
    countryCode: '',
    delegatedStake: 1000,
    node: provider ? { countryCode: 'DE', online: true, acceptsConnections: true, version, commit: null, lastSeen: Date.now(), provider } : null,
} as Validator);

const many = (n: number, version: string, provider: string | null) => Array.from({ length: n }, () => validator(version, provider));

/** GitHub's latest release, as /api/node-release answers; null makes it fail. */
let release: string | null = null;
vi.mock('@/features/dashboard/services/apiClient', () => ({
    apiFetchNodeRelease: async () => {
        if (!release) throw new Error('unavailable');
        return { version: release, name: release, publishedAt: '', url: '' };
    },
}));

const renderSection = (validators: Validator[]) =>
    render(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
            <NetworkHealthSection validators={validators} dt={dt} locale="en" />
        </QueryClientProvider>,
    );

describe('NetworkHealthSection', () => {
    it('shows how many run the latest version, as a count and a share, in a card', () => {
        renderSection([...many(5, 'v1.4.0.0', 'Hetzner'), ...many(5, 'v1.3.0.2', 'AWS')]);
        expect(screen.getByText('5/10 · 50.00%')).toBeInTheDocument();
    });

    it('measures against the release published on GitHub once it arrives', async () => {
        release = 'v1.5.0.0';
        renderSection([...many(5, 'v1.4.0.0', 'Hetzner'), ...many(5, 'v1.5.0.0', 'AWS')]);
        // Until the release arrives the highest the validators run stands in: the same 5/10 here.
        expect(await screen.findByTitle(/latest Radix node release published on GitHub/)).toBeInTheDocument();
        expect(screen.getByText('5/10 · 50.00%')).toBeInTheDocument();
        release = null;
    });

    it('names the biggest providers with their share of the validators', () => {
        renderSection([...many(10, 'v1.4.0.0', 'Hetzner'), ...many(60, 'v1.4.0.0', 'AWS'), ...many(30, 'v1.4.0.0', 'OVH')]);
        expect(screen.getByText('AWS 60% · OVH 30% · Hetzner 10%')).toBeInTheDocument();
    });

    it('gives a verdict, and the reasoning in words', () => {
        renderSection([...many(10, 'v1.4.0.0', 'Hetzner'), ...many(60, 'v1.4.0.0', 'AWS'), ...many(30, 'v1.4.0.0', 'OVH')]);
        expect(screen.getAllByText('Concentrated').length).toBeGreaterThan(0);
        expect(screen.getAllByText(/AWS hosts 60% of the active validators/).length).toBeGreaterThan(0);
    });

    it('does not give a verdict while the providers are unknown', () => {
        renderSection(many(20, 'v1.4.0.0', null));
        expect(screen.getAllByText('Not enough data').length).toBeGreaterThan(0);
        expect(screen.queryByText('Concentrated')).not.toBeInTheDocument();
    });
});
