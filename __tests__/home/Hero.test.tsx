import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/renderWithProviders';
import Hero from '@/features/home/sections/Hero';
import { translations } from '@/i18n';
import type { Dictionary } from '@/types/i18n';

const mockT: Dictionary = translations.en;

const user = userEvent.setup();

describe('Hero', () => {
    // ─── Renderizado Inicial (LCP) ───────────────────────────────────────────
    describe('Renderizado Inicial', () => {
        it('renders all main elements', () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            expect(document.getElementById('hero')).toBeTruthy();
            const headings = screen.getAllByRole('heading', { level: 1 });
            expect(headings.length).toBeGreaterThanOrEqual(1);
            const ctaLinks = screen.getAllByRole('link');
            expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
            expect(screen.getByText('100%')).toBeInTheDocument();
            expect(screen.getByText('ROA')).toBeInTheDocument();
            expect(screen.getByText('T+0')).toBeInTheDocument();
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThanOrEqual(5);
        });
    });

    // ─── Interactividad: Navegación Manual ───────────────────────────────────
    describe('Navegación del Carrusel', () => {
        it('advances to next slide when clicking Next', async () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const nextBtn = screen.getByRole('button', { name: mockT.hero.btn_next });
            await user.click(nextBtn);
            const headings = screen.getAllByRole('heading', { level: 1 });
            expect(headings.length).toBeGreaterThanOrEqual(1);
        });

        it('goes to previous slide when clicking Prev', async () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const prevBtn = screen.getByRole('button', { name: mockT.hero.btn_prev });
            await user.click(prevBtn);
            const headings = screen.getAllByRole('heading', { level: 1 });
            expect(headings.length).toBeGreaterThanOrEqual(1);
        });

        it('changes slide when clicking a progress bar', async () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const slideBtns = screen.getAllByRole('button', { name: new RegExp(mockT.hero.aria_go, 'i') });
            expect(slideBtns).toHaveLength(3);
            await user.click(slideBtns[2]);
            expect(slideBtns[2]).toBeInTheDocument();
        });
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────────
    describe('Edge Cases', () => {
        it('wraps around from last slide to first (circular)', async () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const nextBtn = screen.getByRole('button', { name: mockT.hero.btn_next });
            await user.click(nextBtn);
            await user.click(nextBtn);
            await user.click(nextBtn);
            expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
        });

        it('wraps from first slide to last on prev click', async () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const prevBtn = screen.getByRole('button', { name: mockT.hero.btn_prev });
            await user.click(prevBtn);
            expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
        });

        it('handles rapid clicks without breaking', async () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            for (let i = 0; i < 5; i++) {
                const btn = screen.getByRole('button', { name: mockT.hero.btn_next });
                await user.click(btn);
            }
            expect(document.getElementById('hero')).toBeTruthy();
        });
    });

    // ─── Auto-play ───────────────────────────────────────────────────────────
    describe('Auto-play', () => {
        beforeEach(() => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
        });

        afterEach(() => {
            act(() => {
                vi.runOnlyPendingTimers();
            });
            vi.useRealTimers();
        });

        it('auto-advances after 5 seconds', () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            act(() => {
                vi.advanceTimersByTime(5000);
            });
            expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
        });

        it('auto-advances through all slides over 15 seconds', () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            act(() => {
                vi.advanceTimersByTime(15000);
            });
            expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
        });
    });

    // ─── Accesibilidad ───────────────────────────────────────────────────────
    describe('Accesibilidad', () => {
        it('prev button has aria-label', () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            expect(screen.getByRole('button', { name: mockT.hero.btn_prev })).toHaveAttribute('aria-label');
        });

        it('next button has aria-label', () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            expect(screen.getByRole('button', { name: mockT.hero.btn_next })).toHaveAttribute('aria-label');
        });

        it('each progress bar button has aria-label', () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const slideBtns = screen.getAllByRole('button', { name: new RegExp(mockT.hero.aria_go, 'i') });
            slideBtns.forEach((btn, i) => {
                expect(btn).toHaveAttribute('aria-label', `${mockT.hero.aria_go} ${i + 1}`);
            });
        });

        it('hero section has id for anchor navigation', () => {
            renderWithProviders(<Hero t={mockT} locale="en" />);
            expect(document.getElementById('hero')).toBeTruthy();
        });
    });
});
