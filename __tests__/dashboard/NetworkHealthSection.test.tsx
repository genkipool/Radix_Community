import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
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
    node: provider ? { countryCode: 'DE', online: true, acceptsConnections: true, version: null, commit: null, lastSeen: 1, provider } : null,
} as Validator);

const many = (n: number, version: string, provider: string | null) => Array.from({ length: n }, () => validator(version, provider));

const renderSection = (validators: Validator[]) => render(<NetworkHealthSection validators={validators} dt={dt} locale="en" />);

describe('NetworkHealthSection', () => {
    it('shows how many run the latest version, as a count and a share, in a card', () => {
        renderSection([...many(5, 'v1.4.0.0', 'Hetzner'), ...many(5, 'v1.3.0.2', 'AWS')]);
        expect(screen.getByText('5/10 · 50%')).toBeInTheDocument();
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
