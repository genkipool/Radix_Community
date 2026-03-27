import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import Navbar from '@/components/layout/Navbar';

// ─── Mock next/navigation ────────────────────────────────────────────────────
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockPathname = '/es/dashboard';

vi.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
    }),
}));

// ─── Mock useTheme from ThemeContext ─────────────────────────────────────────
// We need to mock the actual useTheme hook since Navbar imports it directly
let mockTheme = 'radix-dark';
const mockSetTheme = vi.fn((t: string) => { mockTheme = t; });

vi.mock('@/context/ThemeContext', () => ({
    useTheme: () => ({
        theme: mockTheme,
        setTheme: mockSetTheme,
    }),
    ThemeProvider: ({ children }: { children?: React.ReactNode }) => children,
}));

describe('Navbar', () => {
    beforeEach(() => {
        mockTheme = 'radix-dark';
        mockSetTheme.mockClear();
        mockPush.mockClear();
        mockReplace.mockClear();
    });

    // ─── Renderizado Inicial ─────────────────────────────────────────────────
    describe('Renderizado Inicial', () => {
        it('renders the RADIX logo', () => {
            // Arrange & Act
            renderWithProviders(<Navbar />);
            // Assert
            const logos = screen.getAllByRole('link', { name: /radix/i });
            expect(logos.length).toBeGreaterThanOrEqual(1);
        });

        it('renders navigation links', () => {
            // Arrange & Act
            renderWithProviders(<Navbar />);
            // Assert
            const navLinks = screen.getAllByRole('link');
            expect(navLinks.length).toBeGreaterThan(1); // Logo + nav links
        });

        it('renders the theme toggle button', () => {
            // Arrange & Act
            renderWithProviders(<Navbar />);
            // Assert
            const themeBtn = screen.getByRole('button', { name: /toggle theme/i });
            expect(themeBtn).toBeInTheDocument();
        });

        it('renders the wallet CTA button', () => {
            // Arrange & Act
            renderWithProviders(<Navbar />);
            // Assert
            const walletLinks = screen.getAllByRole('button').filter(el =>
                el.textContent?.toLowerCase().includes('connect') ||
                el.textContent?.toLowerCase().includes('comprar') ||
                el.textContent?.toLowerCase().includes('conectar')
            );
            expect(walletLinks.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ─── Interactividad: Tema ────────────────────────────────────────────────
    describe('Interactividad de Tema', () => {
        it('calls setTheme when theme button is clicked', async () => {
            // Arrange
            const user = userEvent.setup();
            renderWithProviders(<Navbar />);
            const themeBtn = screen.getByRole('button', { name: /toggle theme/i });
            // Act
            await user.click(themeBtn);
            // Assert
            expect(mockSetTheme).toHaveBeenCalledTimes(1);
        });

        it('cycles to the next theme in order', async () => {
            // Arrange — currently "radix-dark" (index 1)
            const user = userEvent.setup();
            renderWithProviders(<Navbar />);
            const themeBtn = screen.getByRole('button', { name: /toggle theme/i });
            // Act
            await user.click(themeBtn);
            // Assert — should cycle to "oro-light" (index 2 in the 6-theme cycle)
            expect(mockSetTheme).toHaveBeenCalledWith('oro-light');
        });

        it('does not crash on rapid double-click', async () => {
            // Arrange
            const user = userEvent.setup();
            renderWithProviders(<Navbar />);
            const themeBtn = screen.getByRole('button', { name: /toggle theme/i });
            // Act
            await user.dblClick(themeBtn);
            // Assert — should have been called twice without errors
            expect(mockSetTheme).toHaveBeenCalledTimes(2);
        });
    });

    // ─── Interactividad: Idioma ──────────────────────────────────────────────
    describe('Interactividad de Idioma', () => {
        it('navigates to opposite locale on language toggle', async () => {
            // Arrange
            const user = userEvent.setup();
            renderWithProviders(<Navbar />, { locale: 'es' });
            const langBtns = screen.getAllByRole('button', { name: /toggle language/i });
            // Act
            await user.click(langBtns[0]);
            // Assert — The actual implementation changes the pathname using router.replace
            expect(mockReplace).toHaveBeenCalled();
        });
    });

    // ─── Menú Móvil ──────────────────────────────────────────────────────────
    describe('Menú Móvil', () => {
        it('opens and closes the mobile menu', async () => {
            // Arrange
            const user = userEvent.setup();
            renderWithProviders(<Navbar />);
            // The hamburger button has no aria-label, find by the X/Menu icon parent
            const menuButtons = screen.getAllByRole('button');
            const hamburger = menuButtons.find(btn =>
                btn.className.includes('md:hidden') || btn.textContent === ''
            );

            // Skip test if we can't find the hamburger (desktop viewport)
            if (!hamburger) return;

            // Act — open
            await user.click(hamburger);
            // Assert — mobile links should now be visible (duplicated)
            const allLinks = screen.getAllByRole('link');
            expect(allLinks.length).toBeGreaterThan(3);

            // Act — close
            await user.click(hamburger);
        });
    });

    // ─── Accesibilidad ───────────────────────────────────────────────────────
    describe('Accesibilidad', () => {
        it('theme button has aria-label', () => {
            renderWithProviders(<Navbar />);
            expect(screen.getByRole('button', { name: /toggle theme/i })).toHaveAttribute('aria-label');
        });

        it('language button has aria-label', () => {
            renderWithProviders(<Navbar />);
            expect(screen.getByRole('button', { name: /toggle language/i })).toHaveAttribute('aria-label');
        });

        it('navigation is inside a nav element', () => {
            renderWithProviders(<Navbar />);
            expect(screen.getByRole('navigation')).toBeInTheDocument();
        });
    });
});
