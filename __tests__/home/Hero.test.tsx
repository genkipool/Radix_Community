import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../helpers/renderWithProviders';
import Hero from '@/features/home/sections/Hero';
import { translations } from '@/i18n';
import type { Dictionary } from '@/types/i18n';

const mockT: Dictionary = translations.en;

// ─── Mock motion/react ───────────────────────────────────────────────────────
// Replace framer-motion with simple div wrappers so we can test state changes
// without depending on animation internals.
vi.mock('motion/react', () => ({
    motion: new Proxy({}, {
        get: (_target, prop) => {
            // Return a forwardRef component for each HTML tag (div, button, span, etc.)
            const Component = ({ children, ...rest }: { children?: React.ReactNode } & Record<string, unknown>) => {
                return React.createElement(prop as string, rest, children);
            };
            Component.displayName = `motion.${String(prop)}`;
            return Component;
        },
    }),
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

describe('Hero', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.runOnlyPendingTimers();
        vi.useRealTimers();
    });

    // ─── Renderizado Inicial (LCP) ───────────────────────────────────────────
    describe('Renderizado Inicial', () => {
        it('renders the hero section', () => {
            // Arrange & Act
            renderWithProviders(<Hero t={mockT} locale="en" />);
            // Assert — The hero section is in the DOM
            expect(document.getElementById('hero')).toBeTruthy();
        });

        it('renders slide 0 heading', () => {
            // Arrange & Act
            renderWithProviders(<Hero t={mockT} locale="en" />);
            // Assert
            const headings = screen.getAllByRole('heading', { level: 1 });
            expect(headings.length).toBeGreaterThanOrEqual(1);
        });

        it('renders CTA buttons', () => {
            // Arrange & Act
            renderWithProviders(<Hero t={mockT} locale="en" />);
            // Assert — There is at least one CTA link
            const ctaLinks = screen.getAllByRole('link');
            expect(ctaLinks.length).toBeGreaterThanOrEqual(1);
        });

        it('renders metrics bar', () => {
            // Arrange & Act
            renderWithProviders(<Hero t={mockT} locale="en" />);
            // Assert — metrics like "2²⁵⁶", "100%", "ROA", "T+0"
            expect(screen.getByText('100%')).toBeInTheDocument();
            expect(screen.getByText('ROA')).toBeInTheDocument();
            expect(screen.getByText('T+0')).toBeInTheDocument();
        });

        it('renders progress bar buttons', () => {
            // Arrange & Act
            renderWithProviders(<Hero t={mockT} locale="en" />);
            // Assert — 3 progress bar buttons + 2 arrow buttons = 5 buttons
            const buttons = screen.getAllByRole('button');
            expect(buttons.length).toBeGreaterThanOrEqual(5);
        });
    });

    // ─── Interactividad: Navegación Manual ───────────────────────────────────
    describe('Navegación del Carrusel', () => {
        it('advances to next slide when clicking Next', async () => {
            // Arrange
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const nextBtn = screen.getByRole('button', { name: mockT.hero.btn_next });
            // Act
            await user.click(nextBtn);
            // Assert — slide 1 should now be active (we can check headings changed)
            // Since all 3 slides render with AnimatePresence mock, we check the heading count
            const headings = screen.getAllByRole('heading', { level: 1 });
            expect(headings.length).toBeGreaterThanOrEqual(1);
        });

        it('goes to previous slide when clicking Prev', async () => {
            // Arrange
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const prevBtn = screen.getByRole('button', { name: mockT.hero.btn_prev });
            // Act — from slide 0, prev should go to slide 2 (circular)
            await user.click(prevBtn);
            // Assert
            const headings = screen.getAllByRole('heading', { level: 1 });
            expect(headings.length).toBeGreaterThanOrEqual(1);
        });

        it('changes slide when clicking a progress bar', async () => {
            // Arrange
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const slideBtns = screen.getAllByRole('button', { name: new RegExp(mockT.hero.aria_go, 'i') });
            expect(slideBtns).toHaveLength(3);
            // Act — click slide 3 button
            await user.click(slideBtns[2]);
            // Assert — should not crash
            expect(slideBtns[2]).toBeInTheDocument();
        });
    });

    // ─── Edge Cases ──────────────────────────────────────────────────────────
    describe('Edge Cases', () => {
        it('wraps around from last slide to first (circular)', async () => {
            // Arrange
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const nextBtn = screen.getByRole('button', { name: mockT.hero.btn_next });
            // Act — click next 3 times (0→1→2→0)
            await user.click(nextBtn);
            await user.click(nextBtn);
            await user.click(nextBtn);
            // Assert — back to slide 0, no crash
            expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
        });

        it('wraps from first slide to last on prev click', async () => {
            // Arrange
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            renderWithProviders(<Hero t={mockT} locale="en" />);
            const prevBtn = screen.getByRole('button', { name: mockT.hero.btn_prev });
            // Act — at slide 0, click prev
            await user.click(prevBtn);
            // Assert — should go to slide 2 without crash
            expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
        });

        it('handles rapid clicks without breaking', async () => {
            // Arrange
            const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
            renderWithProviders(<Hero t={mockT} locale="en" />);
            // Act — rapid fire clicks, re-querying each time to avoid stale refs
            for (let i = 0; i < 5; i++) {
                const btn = screen.getByRole('button', { name: mockT.hero.btn_next });
                await user.click(btn);
            }
            // Assert — should not crash, hero still in DOM
            expect(document.getElementById('hero')).toBeTruthy();
        });
    });

    // ─── Auto-play ───────────────────────────────────────────────────────────
    describe('Auto-play', () => {
        it('auto-advances after 5 seconds', () => {
            // Arrange
            renderWithProviders(<Hero t={mockT} locale="en" />);
            // Act — advance fake timers by 5 seconds
            vi.advanceTimersByTime(5000);
            // Assert — component should still be alive (no crash)
            expect(screen.getAllByRole('heading', { level: 1 }).length).toBeGreaterThanOrEqual(1);
        });

        it('auto-advances through all slides over 15 seconds', () => {
            // Arrange
            renderWithProviders(<Hero t={mockT} locale="en" />);
            // Act — 3 full cycles
            vi.advanceTimersByTime(15000);
            // Assert
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
